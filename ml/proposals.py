"""Measuring proposed rules against the game we have.

    python3 -m ml.proposals              # the whole report
    python3 -m ml.proposals --games 40000

Every rule in RULES.md was argued for with arithmetic, so a proposed rule
should have to clear the same bar. This runs each candidate in `RuleSet`
against the standard rules and prints what it does to the numbers the design
notes actually care about:

  deal decides it   how often the biggest starting health total simply wins.
                    The one handicap the game says you can never repair, so
                    this is the measure of how much the deal is the game.
  opener wins       first-mover advantage, which the turn-order rule exists
                    to compensate for.
  disarms/game      how often somebody's bank is destroyed. The design notes
                    say the whole rhythm of the game is produced by the threat
                    of this and by nothing else, so it is the number a rule
                    aimed at the passive table has to move.
  charge share      the fraction of all turns spent banking. A game that is
                    90% charging is a game with one decision in it.
  median turns      length, which is what makes a rule playable or a chore.

The verdicts these produce are written up in PROPOSALS.md.

Caveat worth stating plainly: the measurements use the reference heuristic,
not the trained ace, because the ace was fitted against the standard rules and
would be playing a game it was never shown. A rule that survives here is a rule
worth *training* against, which is the next step, not the last word.
"""

from __future__ import annotations

import argparse

import numpy as np

from .engine import (ATTACK, CHARGE, CHARGE_ATTACK, RuleSet, SWAP_SELF,
                     SWAP_TARGET, STANDARD, Spaceships)
from .policies import HeuristicPolicy

ACTION_KEYS = ["charge", "swap self", "attack", "charge attack", "swap theirs"]


def measure(rules, n_players=2, n_games=20000, seed=0, policies=None):
    """Play out a batch and report the numbers the design notes argue about."""
    rng = np.random.default_rng(seed)
    env = Spaceships(n_games, n_players, rng=rng, rules=rules)
    pols = policies or [HeuristicPolicy()]
    seat_policy = np.zeros((n_games, n_players), dtype=int)
    if policies:
        seat_policy[:] = np.arange(n_players) % len(policies)

    start_health = env.health.copy()
    opener = env.cur.copy()
    action_counts = np.zeros(len(ACTION_KEYS))
    disarms = np.zeros(n_games)
    fired_at = []
    attacks = 0
    blocked = 0

    while True:
        rows = env.active
        if not len(rows):
            break
        targets = env.choose_targets(rows)
        obs = env.features(rows, targets)
        legal = env.legal_actions(rows, targets)
        view = env.public_view(rows, targets)
        who = seat_policy[rows, env.cur[rows]]

        actions = np.full(len(rows), -1, dtype=np.int32)
        for pid in np.unique(who):
            sel = np.flatnonzero(who == pid)
            actions[sel] = pols[pid].act(obs[sel], legal[sel],
                                         {k: v[sel] for k, v in view.items()},
                                         rng, rows[sel])
        for a in actions[actions >= 0]:
            action_counts[a] += 1
        fired = actions == CHARGE_ATTACK
        if fired.any():
            fired_at.extend(view["own_charges"][fired].tolist())

        # A disarm is a *defender's* bank destroyed by an attack -- not a bank
        # its owner spent firing, which is why only the target seat is counted.
        before = env.charges[rows].sum(-1)
        health_before = env.health[rows].copy()
        env.step(rows, actions, targets)
        after = env.charges[rows].sum(-1)

        atk = np.flatnonzero((actions == ATTACK) | (actions == CHARGE_ATTACK))
        if len(atk):
            t = targets[atk]
            lost = np.maximum(before[atk, t] - after[atk, t], 0)
            np.add.at(disarms, rows[atk], lost)
            # An attack that changed nothing at all bounced off the shield.
            attacks += len(atk)
            no_damage = health_before[atk, t] == env.health[rows[atk], t]
            blocked += int((no_damage & (lost == 0)).sum())

    winners = env.winners()
    live = winners >= 0
    top_health = start_health.argmax(1)
    total_actions = max(action_counts.sum(), 1)

    return {
        "median turns": float(np.median(env.turns)),
        "deal decides it": float((winners[live] == top_health[live]).mean()),
        "opener wins": float((winners[live] == opener[live]).mean()),
        "disarms/game": float(disarms.mean()),
        "charge share": float(action_counts[CHARGE] / total_actions),
        "swap share": float((action_counts[SWAP_SELF]
                             + action_counts[SWAP_TARGET]) / total_actions),
        "fire share": float((action_counts[ATTACK]
                             + action_counts[CHARGE_ATTACK]) / total_actions),
        "bank when fired": float(np.mean(fired_at)) if fired_at else 0.0,
        "blocked share": float(blocked / attacks) if attacks else 0.0,
        "reshuffles": float(env.reshuffles.mean()),
        "unfinished": float((~live).mean()),
        "start health spread": float(start_health.std()),
    }


COLUMNS = ["median turns", "deal decides it", "opener wins", "disarms/game",
           "charge share", "blocked share", "bank when fired", "reshuffles"]


def print_table(rows, title):
    print(f"\n{title}")
    name_w = max(len(n) for n, _ in rows) + 2
    print(" " * name_w + "".join(f"{c:>19}" for c in COLUMNS))
    for name, m in rows:
        cells = "".join(f"{m[c]:>19.3f}" for c in COLUMNS)
        print(f"{name:<{name_w}}{cells}")


def head_to_head(rules, n_players, n_games, seed=3):
    """Win rate of seat 0 under a rule set whose seats differ.

    Used for the deal choice: if picking the highest card as your shield beats
    picking the lowest by a mile, the "choice" is not a choice.
    """
    rng = np.random.default_rng(seed)
    env = Spaceships(n_games, n_players, rng=rng, rules=rules)
    pol = HeuristicPolicy()
    from .engine import play
    winners = play(env, [pol], np.zeros((n_games, n_players), dtype=int), rng)
    live = winners >= 0
    return float((winners[live] == 0).mean()), float(env.health.max())


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--games", type=int, default=20000)
    p.add_argument("--players", type=int, nargs="*", default=[2, 3, 4])
    a = p.parse_args(argv)

    print(f"Spaceships rule proposals — {a.games} games per cell, "
          f"reference heuristic play")

    candidates = [
        ("standard", STANDARD),
        ("salvage 1", RuleSet(salvage=1)),
        ("salvage 2", RuleSet(salvage=2)),
        ("ricochet", RuleSet(ricochet=True)),
        ("charge draws 2", RuleSet(charge_draw=2)),
        ("strict breakthrough", RuleSet(strict_breakthrough=True)),
        ("deal four, high", RuleSet(deal_four=True, shield_pick=("high",))),
        ("deal four, mid", RuleSet(deal_four=True, shield_pick=("mid",))),
        ("deal four, low", RuleSet(deal_four=True, shield_pick=("low",))),
        ("salvage 1 + draws 2", RuleSet(salvage=1, charge_draw=2)),
    ]

    for n_players in a.players:
        rows = [(name, measure(rules, n_players, a.games, seed=n_players))
                for name, rules in candidates]
        print_table(rows, f"{n_players} players")

    # Is the deal choice a real decision, or a solved one?
    print("\nTHE DEAL CHOICE, HEAD TO HEAD (seat 0's win rate, 2 players)")
    for a_pick, b_pick in (("high", "low"), ("high", "mid"), ("mid", "low")):
        rate, _ = head_to_head(
            RuleSet(deal_four=True, shield_pick=(a_pick, b_pick)), 2, a.games)
        verdict = ("a real choice" if 0.45 <= rate <= 0.55
                   else f"{a_pick if rate > 0.5 else b_pick} dominates")
        print(f"  {a_pick:>4} against {b_pick:<5} {rate:>7.3f}   {verdict}")


if __name__ == "__main__":
    main()
