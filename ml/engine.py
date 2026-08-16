"""A batched Spaceships engine.

The whole point of this file is that it never simulates one game. Every array
carries a leading batch axis, so a step advances tens of thousands of tables at
once and the learner in ``train.py`` gets its sample counts from vectorisation
rather than from patience.

The rules implemented here are RULES.md as written. The parts worth stating
plainly, because they are what the arithmetic hangs on:

  * The shield is a permanent threshold. It is absorbed, never consumed, and
    only ever changes when somebody swaps it.
  * A charge attack is all or nothing and the declaration is binding, so the
    bank is spent whether it breaks through or bounces.
  * Any breakthrough -- plain attack or charge attack -- eliminates the
    defender's whole bank.
  * Charges are face down to everybody including their owner, so this is a
    perfect-information stochastic game: the state a policy sees is the state.
  * When the deck runs out the discards are reshuffled. If both are empty, the
    player must fire their whole bank with no drawn card, or pass with no bank.

Two things RULES.md does not rule on, decided here so the engine can run. Both
are flagged in ml/README.md:

  * A destroyed player's shield and live charges go to the discard, so their
    cards keep circulating. Their health cards do not, same as everyone else's.
  * Targeting is not part of the learned policy (see ``choose_targets``).

Cards are only ever counted, never ordered: a deck is a length-13 vector of how
many of each rank remain, and a draw samples a rank in proportion to it. That is
exactly equivalent to shuffling and taking the top card, and it vectorises.
"""

from __future__ import annotations

import numpy as np

RANKS = np.arange(1, 14, dtype=np.int32)      # Ace = 1 .. King = 13
FULL_DECK = np.full(13, 4, dtype=np.int32)    # four of every rank, no jokers
N_ACTIONS = 5

CHARGE, SWAP_SELF, ATTACK, CHARGE_ATTACK, SWAP_TARGET = range(N_ACTIONS)

ACTION_NAMES = ["charge", "swap own shield", "attack", "charge attack",
                "swap their shield"]

# Every feature a policy is allowed to see. All of it is public by construction:
# charge *counts* are on the table, charge *values* are unknown to everyone.
FEATURE_NAMES = [
    "bias",
    "own_health", "own_shield", "own_shield_deficit", "own_charges",
    "own_bank_expected", "own_charges_is_zero",
    "tgt_health", "tgt_shield", "tgt_shield_deficit", "tgt_charges",
    "tgt_bank_expected",
    "expected_plain_damage", "expected_charge_damage",
    "expected_charge_overkill", "charge_attack_kills",
    "n_live_opponents", "max_opp_charges", "min_opp_shield", "mean_opp_shield",
    "min_opp_health", "am_i_lowest_health",
    "deck_left", "discard_left", "pool_mean_rank", "turn",
]
N_FEATURES = len(FEATURE_NAMES)

MEAN_CARD = 7.0


class Spaceships:
    """``n_games`` independent tables, all on the same turn index.

    Games finish at different times; a finished row is simply excluded from
    ``active`` and never stepped again.
    """

    def __init__(self, n_games, n_players=2, rng=None, max_turns=400):
        if n_players < 2 or n_players > 6:
            raise ValueError("Spaceships seats two to six players")
        self.n_games = int(n_games)
        self.n_players = int(n_players)
        self.max_turns = int(max_turns)
        self.rng = rng if rng is not None else np.random.default_rng()
        self.reset()

    # ------------------------------------------------------------------ setup

    def reset(self):
        B, P = self.n_games, self.n_players
        self.deck = np.tile(FULL_DECK, (B, 1))
        self.discard = np.zeros((B, 13), dtype=np.int32)
        self.charges = np.zeros((B, P, 13), dtype=np.int32)
        self.health = np.zeros((B, P), dtype=np.int32)
        self.shield = np.zeros((B, P), dtype=np.int32)
        self.alive = np.ones((B, P), dtype=bool)
        self.turns = np.zeros(B, dtype=np.int32)
        self.reshuffles = np.zeros(B, dtype=np.int32)
        self.done = np.zeros(B, dtype=bool)

        every = np.arange(B)
        for p in range(P):
            for _ in range(3):                       # three health cards
                self.health[:, p] += self._draw(every)
            self.shield[:, p] = self._draw(every)    # one shield

        # Lowest starting health total goes first; ties on shield, then a deal.
        key = (self.health.astype(np.float64) * 100.0
               + self.shield.astype(np.float64)
               + self.rng.random((B, P)))
        self.cur = np.argmin(key, axis=1).astype(np.int32)
        return self

    # ------------------------------------------------------------------ cards

    def _draw(self, rows):
        """Draw one card for each row, reshuffling the discards if needed.

        Callers must have checked ``can_draw``; a row with nothing anywhere is a
        rules situation (forced fire), not a card to be found.
        """
        if len(rows) == 0:
            return np.zeros(0, dtype=np.int32)
        empty = self.deck[rows].sum(1) == 0
        if empty.any():
            r = rows[empty]
            self.deck[r] = self.discard[r]
            self.discard[r] = 0
            self.reshuffles[r] += 1
        counts = self.deck[rows]
        total = counts.sum(1)
        if (total == 0).any():
            raise RuntimeError("drew from an empty table; check can_draw first")
        cum = np.cumsum(counts, axis=1)
        u = self.rng.random(len(rows)) * total
        idx = (cum <= u[:, None]).sum(1)
        self.deck[rows, idx] -= 1
        return (idx + 1).astype(np.int32)

    def can_draw(self, rows):
        return (self.deck[rows].sum(1) + self.discard[rows].sum(1)) > 0

    def bank_value(self, rows, players):
        """The true total of a bank. Resolution only -- no policy may call this,
        because in the real game nobody, the owner included, can."""
        return (self.charges[rows, players] * RANKS).sum(1)

    def charge_count(self, rows=slice(None)):
        return self.charges[rows].sum(-1)

    # ---------------------------------------------------------------- targets

    def choose_targets(self, rows):
        """Pick whom each row's mover is pointed at.

        Target choice is deliberately *not* learned. With two players there is
        no choice to make, and above two the action space stops being
        permutation-invariant -- seat 3 means nothing in common from one game to
        the next -- so a learned head over seat slots would be learning noise.
        The rule is the one the analysis scripts use: softest shield first, and
        among equal shields the one sitting on the biggest bank, since that is
        the disarm shot the whole game depends on somebody taking.
        """
        me = self.cur[rows]
        counts = self.charges[rows].sum(-1)
        key = (self.shield[rows].astype(np.int64) * 100000
               - np.minimum(counts, 20) * 1000
               + self.health[rows])
        key = np.where(self.alive[rows], key, np.iinfo(np.int64).max)
        key[np.arange(len(rows)), me] = np.iinfo(np.int64).max
        return np.argmin(key, axis=1).astype(np.int32)

    # ------------------------------------------------------------------ views

    @property
    def active(self):
        return np.flatnonzero(~self.done)

    def legal_actions(self, rows, targets=None):
        """[len(rows), 5] mask. An all-False row must pass: it cannot draw and
        has no bank to fire, which is the one dead end the rules allow."""
        if targets is None:
            targets = self.choose_targets(rows)
        me = self.cur[rows]
        draw = self.can_draw(rows)
        banked = self.charges[rows, me].sum(1) > 0
        has_target = self.alive[rows, targets]

        legal = np.zeros((len(rows), N_ACTIONS), dtype=bool)
        legal[:, CHARGE] = draw
        legal[:, SWAP_SELF] = draw
        legal[:, ATTACK] = draw & has_target
        # A charge attack with an empty bank is just a plain attack, so it is
        # not offered. With no card to draw it is the *only* thing offered.
        legal[:, CHARGE_ATTACK] = banked & has_target
        legal[:, SWAP_TARGET] = draw & has_target
        return legal

    def features(self, rows, targets=None):
        """[len(rows), N_FEATURES], from the mover's seat. Public info only."""
        if targets is None:
            targets = self.choose_targets(rows)
        n = len(rows)
        idx = np.arange(n)
        me = self.cur[rows]

        counts = self.charges[rows].sum(-1).astype(np.float64)
        health = self.health[rows].astype(np.float64)
        shield = self.shield[rows].astype(np.float64)
        alive = self.alive[rows]

        own_h, own_s, own_c = health[idx, me], shield[idx, me], counts[idx, me]
        t_h = health[idx, targets]
        t_s = shield[idx, targets]
        t_c = counts[idx, targets]

        opp = alive.copy()
        opp[idx, me] = False
        n_opp = opp.sum(1).astype(np.float64)
        big = 1e9
        min_opp_shield = np.where(opp, shield, big).min(1)
        min_opp_health = np.where(opp, health, big).min(1)
        max_opp_charges = np.where(opp, counts, -big).max(1)
        mean_opp_shield = np.where(n_opp > 0,
                                   np.where(opp, shield, 0).sum(1)
                                   / np.maximum(n_opp, 1), 0.0)

        # An unseen card is worth 7 whoever is holding it, so a bank of n is
        # worth 7n to its owner and to everybody reading it off the table.
        own_bank = MEAN_CARD * own_c
        charge_atk = own_bank + MEAN_CARD
        deck_left = self.deck[rows].sum(1).astype(np.float64)
        discard_left = self.discard[rows].sum(1).astype(np.float64)
        pool = self.deck[rows] + self.discard[rows]
        pool_total = pool.sum(1).astype(np.float64)
        pool_mean = np.where(pool_total > 0,
                             (pool * RANKS).sum(1) / np.maximum(pool_total, 1),
                             MEAN_CARD)

        f = np.empty((n, N_FEATURES), dtype=np.float64)
        f[:, 0] = 1.0
        f[:, 1] = own_h / 20.0
        f[:, 2] = own_s / 13.0
        f[:, 3] = (MEAN_CARD - own_s) / 13.0
        f[:, 4] = own_c / 5.0
        f[:, 5] = own_bank / 20.0
        f[:, 6] = own_c == 0
        f[:, 7] = t_h / 20.0
        f[:, 8] = t_s / 13.0
        f[:, 9] = (MEAN_CARD - t_s) / 13.0
        f[:, 10] = t_c / 5.0
        f[:, 11] = MEAN_CARD * t_c / 20.0
        f[:, 12] = (MEAN_CARD - t_s) / 13.0
        f[:, 13] = (charge_atk - t_s) / 20.0
        f[:, 14] = (charge_atk - t_s - t_h) / 20.0
        f[:, 15] = charge_atk - t_s >= t_h
        f[:, 16] = n_opp / 5.0
        f[:, 17] = np.maximum(max_opp_charges, 0.0) / 5.0
        f[:, 18] = np.where(n_opp > 0, min_opp_shield, MEAN_CARD) / 13.0
        f[:, 19] = mean_opp_shield / 13.0
        f[:, 20] = np.where(n_opp > 0, min_opp_health, 0.0) / 20.0
        f[:, 21] = own_h <= np.where(n_opp > 0, min_opp_health, big)
        f[:, 22] = deck_left / 52.0
        f[:, 23] = discard_left / 52.0
        f[:, 24] = pool_mean / 13.0
        f[:, 25] = self.turns[rows] / 50.0
        return f

    def public_view(self, rows, targets=None):
        """The same numbers as ``features`` but unnormalised and named, for the
        hand-written policies and for anyone reading a game back."""
        if targets is None:
            targets = self.choose_targets(rows)
        idx = np.arange(len(rows))
        me = self.cur[rows]
        counts = self.charges[rows].sum(-1)
        alive = self.alive[rows]
        opp = alive.copy()
        opp[idx, me] = False
        big = np.iinfo(np.int32).max
        return {
            "me": me,
            "target": targets,
            "own_health": self.health[rows][idx, me],
            "own_shield": self.shield[rows][idx, me],
            "own_charges": counts[idx, me],
            "tgt_health": self.health[rows][idx, targets],
            "tgt_shield": self.shield[rows][idx, targets],
            "tgt_charges": counts[idx, targets],
            "max_opp_charges": np.where(opp, counts, 0).max(1),
            "n_opponents": opp.sum(1),
            "can_draw": self.can_draw(rows),
        }

    # ------------------------------------------------------------------- step

    def step(self, rows, actions, targets=None):
        """Apply one action per row, then advance the turn.

        ``actions`` may contain -1 for a forced pass. Anything illegal is
        treated as a pass rather than silently rewritten, so a broken policy
        shows up as a stalled game instead of as quiet cheating.
        """
        rows = np.asarray(rows)
        actions = np.asarray(actions, dtype=np.int32)
        if targets is None:
            targets = self.choose_targets(rows)
        legal = self.legal_actions(rows, targets)
        ok = actions >= 0
        ok[ok] &= legal[np.flatnonzero(ok), actions[ok]]
        actions = np.where(ok, actions, -1)

        me = self.cur[rows]

        # --- charge: deck to table, face down, unlooked at
        m = actions == CHARGE
        if m.any():
            r = rows[m]
            drawn = self._draw(r)
            np.add.at(self.charges, (r, me[m], drawn - 1), 1)

        # --- swap a shield, mine or theirs: the old one is discarded, the new
        #     one comes off the deck blind and you are stuck with it
        for act, who in ((SWAP_SELF, me), (SWAP_TARGET, targets)):
            m = actions == act
            if m.any():
                r = rows[m]
                w = who[m]
                np.add.at(self.discard, (r, self.shield[r, w] - 1), 1)
                self.shield[r, w] = self._draw(r)

        # --- attacks
        m = (actions == ATTACK) | (actions == CHARGE_ATTACK)
        if m.any():
            r = rows[m]
            mm, tt = me[m], targets[m]
            declared = actions[m] == CHARGE_ATTACK
            drawn = np.zeros(len(r), dtype=np.int32)
            can = self.can_draw(r)
            if can.any():
                drawn[can] = self._draw(r[can])

            bank = (self.charges[r, mm] * RANKS).sum(1)
            attack = drawn + np.where(declared, bank, 0)
            t_shield = self.shield[r, tt]
            through = attack >= t_shield

            if through.any():
                hr, ht = r[through], tt[through]
                # Equal counts as breaking through: no damage, but the bank goes.
                self.health[hr, ht] -= (attack[through] - t_shield[through])
                self.discard[hr] += self.charges[hr, ht]
                self.charges[hr, ht] = 0

            if can.any():
                np.add.at(self.discard, (r[can], drawn[can] - 1), 1)

            if declared.any():
                dr, dm = r[declared], mm[declared]
                self.discard[dr] += self.charges[dr, dm]
                self.charges[dr, dm] = 0

        self._resolve_deaths(rows)
        self._advance(rows)
        return self.done[rows]

    def _resolve_deaths(self, rows):
        dead = self.alive[rows] & (self.health[rows] <= 0)
        if not dead.any():
            return
        gi, pi = np.nonzero(dead)
        r = rows[gi]
        # A destroyed ship's shield and live bank fall back into circulation.
        np.add.at(self.discard, (r, self.shield[r, pi] - 1), 1)
        np.add.at(self.discard, r, self.charges[r, pi])
        self.charges[r, pi] = 0
        self.shield[r, pi] = 0
        self.alive[r, pi] = False

    def _advance(self, rows):
        self.turns[rows] += 1
        # Clockwise to the next ship still flying. A row whose whole table is
        # dead cannot happen: the game is over before the last seat empties.
        nxt = (self.cur[rows] + 1) % self.n_players
        for _ in range(self.n_players):
            bad = ~self.alive[rows, nxt]
            if not bad.any():
                break
            nxt = np.where(bad, (nxt + 1) % self.n_players, nxt)
        self.cur[rows] = nxt
        self.done[rows] |= ((self.alive[rows].sum(1) <= 1)
                            | (self.turns[rows] >= self.max_turns))

    # --------------------------------------------------------------- outcomes

    def winners(self):
        """Seat index per game, or -1 for a game that hit the turn cap."""
        n_alive = self.alive.sum(1)
        return np.where(n_alive == 1, np.argmax(self.alive, axis=1), -1)


def play(env, policies, seat_policy, rng=None):
    """Run every table to the end.

    ``seat_policy`` is [n_games, n_players] of indices into ``policies``, so a
    single batch can hold many different match-ups at once -- which is how the
    trainer evaluates a whole generation of candidates in one go.

    Each policy is handed the global row ids it is deciding for, so a policy
    whose parameters vary by game can look up which variant it is being.
    """
    rng = rng if rng is not None else env.rng
    seat_policy = np.asarray(seat_policy)
    while True:
        rows = env.active
        if len(rows) == 0:
            break
        targets = env.choose_targets(rows)
        obs = env.features(rows, targets)
        legal = env.legal_actions(rows, targets)
        view = env.public_view(rows, targets)
        who = seat_policy[rows, env.cur[rows]]

        actions = np.full(len(rows), -1, dtype=np.int32)
        for pid in np.unique(who):
            sel = np.flatnonzero(who == pid)
            actions[sel] = policies[pid].act(
                obs[sel], legal[sel], {k: v[sel] for k, v in view.items()},
                rng, rows[sel])
        env.step(rows, actions, targets)
    return env.winners()
