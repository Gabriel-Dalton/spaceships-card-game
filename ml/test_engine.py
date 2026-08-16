"""Rules tests for the batched engine.

Each test sets up a table by hand and checks one clause of RULES.md. Run with
``python -m ml.test_engine`` (no test framework needed) or with pytest.
"""

from __future__ import annotations

import numpy as np

from .engine import (ATTACK, CHARGE, CHARGE_ATTACK, RANKS, RuleSet, SWAP_SELF,
                     SWAP_TARGET, Spaceships, play)
from .policies import HeuristicPolicy, RandomPolicy


def table(n_games=1, n_players=2, seed=0, rules=None):
    """An empty two-seat table with nothing dealt, ready to be posed."""
    kw = {"rules": rules} if rules is not None else {}
    env = Spaceships(n_games, n_players, rng=np.random.default_rng(seed), **kw)
    env.charges[:] = 0
    env.discard[:] = 0
    env.deck[:] = 4
    env.health[:] = 20
    env.shield[:] = 7
    env.alive[:] = True
    env.turns[:] = 0
    env.done[:] = False
    env.cur[:] = 0
    return env


def bank(env, game, player, ranks):
    for r in ranks:
        env.charges[game, player, r - 1] += 1


def test_shield_is_permanent_and_absorbs():
    env = table()
    env.shield[0, 1] = 6
    env.deck[0] = 0
    env.deck[0, 9] = 1                      # the attacker will draw a 10
    env.step([0], [ATTACK])
    assert env.health[0, 1] == 20 - (10 - 6), "10 against a 6 shield deals 4"
    assert env.shield[0, 1] == 6, "the shield is absorbed, never consumed"


def test_blocked_plain_attack_costs_nothing():
    env = table()
    env.shield[0, 1] = 13
    env.deck[0] = 0
    env.deck[0, 1] = 1                      # a 2 into a King
    bank(env, 0, 0, [5, 5])
    env.step([0], [ATTACK])
    assert env.health[0, 1] == 20
    assert env.charges[0, 0].sum() == 2, "a plain attack never spends charges"


def test_charge_attack_is_binding_even_when_blocked():
    env = table()
    env.shield[0, 1] = 13
    env.deck[0] = 0
    env.deck[0, 0] = 1                      # an Ace plus a bank of 2: blocked
    bank(env, 0, 0, [2])
    env.step([0], [CHARGE_ATTACK])
    assert env.health[0, 1] == 20, "blocked, so no damage"
    assert env.charges[0, 0].sum() == 0, "the bank is gone anyway"


def test_equal_attack_disarms_without_damage():
    env = table()
    env.shield[0, 1] = 7
    env.deck[0] = 0
    env.deck[0, 6] = 1                      # exactly 7 into a 7
    bank(env, 0, 1, [10, 10, 10])
    env.step([0], [ATTACK])
    assert env.health[0, 1] == 20, "equal counts as a breakthrough for 0 damage"
    assert env.charges[0, 1].sum() == 0, "and still wipes their bank"


def test_breakthrough_wipes_defender_bank_not_attacker_bank():
    env = table()
    env.shield[0, 1] = 3
    env.deck[0] = 0
    env.deck[0, 8] = 1
    bank(env, 0, 0, [9, 9])                 # our bank, undeclared
    bank(env, 0, 1, [4, 4])                 # theirs, about to be destroyed
    env.step([0], [ATTACK])
    assert env.charges[0, 1].sum() == 0
    assert env.charges[0, 0].sum() == 2, "undeclared charges are never spent"


def test_charge_is_drawn_face_down_and_banked():
    env = table()
    before = env.deck[0].sum()
    env.step([0], [CHARGE])
    assert env.charges[0, 0].sum() == 1
    assert env.deck[0].sum() == before - 1, "every action draws exactly one card"


def test_swapping_discards_the_old_shield():
    env = table()
    env.shield[0, 0] = 2
    env.step([0], [SWAP_SELF])
    assert env.discard[0, 1] == 1, "the 2 went to the discard"
    assert env.shield[0, 0] != 0

    env = table()
    env.shield[0, 1] = 12
    env.step([0], [SWAP_TARGET])
    assert env.discard[0, 11] == 1, "you can wreck someone else's shield too"


def test_cards_are_conserved():
    """Nothing is created or destroyed: deck + discard + shields + banks is
    always 52 minus the health cards, which never circulate."""
    rng = np.random.default_rng(3)
    env = Spaceships(200, 3, rng=rng)
    health_cards = 3 * env.n_players
    for _ in range(60):
        rows = env.active
        if not len(rows):
            break
        legal = env.legal_actions(rows)
        acts = np.array([np.flatnonzero(l)[rng.integers(l.sum())] if l.any()
                         else -1 for l in legal])
        env.step(rows, acts)
    total = (env.deck.sum(1) + env.discard.sum(1)
             + env.charges.sum((1, 2)) + (env.shield > 0).sum(1))
    assert (total == 52 - health_cards).all(), total[:5]


def test_reshuffle_when_the_deck_runs_out():
    env = table()
    env.deck[0] = 0
    env.discard[0, 6] = 3                   # three 7s waiting to come back
    assert env.can_draw([0])[0]
    env.step([0], [CHARGE])
    assert env.reshuffles[0] == 1
    assert env.discard[0].sum() == 0
    assert env.deck[0].sum() == 2 and env.charges[0, 0].sum() == 1


def test_forced_fire_when_there_is_nothing_to_draw():
    env = table()
    env.deck[0] = 0
    env.discard[0] = 0
    env.shield[0, 1] = 5
    bank(env, 0, 0, [9, 9])                 # 18, no drawn card
    legal = env.legal_actions([0])
    assert legal[0].tolist() == [False, False, False, True, False], \
        "with no card to draw, firing the bank is the only legal action"
    env.step([0], [CHARGE_ATTACK])
    assert env.health[0, 1] == 20 - (18 - 5)
    assert env.charges[0, 0].sum() == 0


def test_pass_when_there_is_nothing_to_draw_and_no_bank():
    env = table()
    env.deck[0] = 0
    env.discard[0] = 0
    assert not env.legal_actions([0]).any()
    env.step([0], [-1])
    assert env.cur[0] == 1, "the turn still passes to the next player"


def test_everybody_banks_forever_still_finishes():
    """The pathological table the design notes warn about. The backstop turns a
    deadlock into a game that resolves itself."""
    class AlwaysCharge:
        def act(self, obs, legal, view, rng, rows=None):
            scores = np.zeros_like(legal, dtype=float)
            scores[:, CHARGE] = 1.0
            out = np.where(legal[:, CHARGE], CHARGE, -1)
            fire = (~legal[:, CHARGE]) & legal[:, CHARGE_ATTACK]
            return np.where(fire, CHARGE_ATTACK, out).astype(np.int32)

    for p in range(2, 7):
        env = Spaceships(200, p, rng=np.random.default_rng(11), max_turns=4000)
        winners = play(env, [AlwaysCharge()], np.zeros((200, p), int))
        assert (winners >= 0).all(), f"{p} players deadlocked"


def test_lowest_starting_health_moves_first():
    env = Spaceships(500, 3, rng=np.random.default_rng(5))
    key = env.health * 100 + env.shield
    assert (key[np.arange(500), env.cur] == key.min(1)).all()


def test_dead_players_are_skipped_and_the_game_ends():
    env = Spaceships(500, 4, rng=np.random.default_rng(9))
    play(env, [HeuristicPolicy(), RandomPolicy()],
         np.tile([0, 1, 0, 1], (500, 1)))
    assert env.done.all()
    assert (env.alive.sum(1) <= 1).all(), "one ship left flying"
    assert (env.health[env.alive] > 0).all()


def test_no_policy_can_see_a_bank_value():
    """Charge values must not leak into the features. Two tables identical
    except for what is face down have to look identical."""
    a, b = table(seed=1), table(seed=1)
    bank(a, 0, 0, [1, 1, 1])
    bank(b, 0, 0, [13, 13, 13])
    assert np.allclose(a.features(np.array([0])), b.features(np.array([0])))
    assert (a.bank_value(np.array([0]), np.array([0]))
            != b.bank_value(np.array([0]), np.array([0])))


def test_features_are_finite():
    rng = np.random.default_rng(4)
    env = Spaceships(300, 5, rng=rng)
    for _ in range(40):
        rows = env.active
        if not len(rows):
            break
        f = env.features(rows)
        assert np.isfinite(f).all()
        legal = env.legal_actions(rows)
        acts = np.where(legal.any(1), legal.argmax(1), -1)
        env.step(rows, acts)


# ------------------------------------------------- the proposals in PROPOSALS.md
# All of these are off by default; the tests above are the proof of that, since
# they pass against an engine built with no rules argument at all.

def test_standard_rules_are_the_default():
    env = Spaceships(1, 2)
    assert env.rules == RuleSet(), "a plain engine plays RULES.md as written"
    assert env.rules.salvage == 0 and not env.rules.ricochet
    assert env.rules.charge_draw == 1 and not env.rules.deal_four
    assert not env.rules.strict_breakthrough


def test_salvage_takes_a_charge_out_of_the_wreck():
    env = table(rules=RuleSet(salvage=1))
    env.shield[0, 1] = 3
    env.deck[0] = 0
    env.deck[0, 8] = 1                      # a 9 through a 3
    bank(env, 0, 1, [4, 4, 4])              # their bank, about to be wrecked
    env.step([0], [ATTACK])
    assert env.charges[0, 1].sum() == 0, "the defender still loses the lot"
    assert env.charges[0, 0].sum() == 1, "and one card goes to the attacker"
    assert env.charges[0, 0, 3] == 1, "the salvaged card is one of their 4s"
    assert env.discard[0, 3] == 2, "the other two are discarded"


def test_salvage_survives_the_attacker_spending_their_own_bank():
    env = table(rules=RuleSet(salvage=1))
    env.shield[0, 1] = 2
    env.deck[0] = 0
    env.deck[0, 5] = 1
    bank(env, 0, 0, [10])                   # ours, declared and spent
    bank(env, 0, 1, [8, 8])                 # theirs, wrecked
    env.step([0], [CHARGE_ATTACK])
    assert env.charges[0, 0].sum() == 1, "the declared bank went, the salvage stayed"
    assert env.charges[0, 0, 7] == 1


def test_ricochet_arms_the_defender_only_when_blocked():
    env = table(rules=RuleSet(ricochet=True))
    env.shield[0, 1] = 13
    env.deck[0] = 0
    env.deck[0, 1] = 1                      # a 2 into a King: blocked
    env.step([0], [ATTACK])
    assert env.charges[0, 1, 1] == 1, "the defender banks the bounced card"
    assert env.discard[0].sum() == 0

    env = table(rules=RuleSet(ricochet=True))
    env.shield[0, 1] = 2
    env.deck[0] = 0
    env.deck[0, 9] = 1                      # a 10 through a 2: not blocked
    env.step([0], [ATTACK])
    assert env.charges[0, 1].sum() == 0
    assert env.discard[0, 9] == 1, "a landed shot is spent as usual"


def test_charge_draw_banks_more_than_one():
    env = table(rules=RuleSet(charge_draw=2))
    before = env.deck[0].sum()
    env.step([0], [CHARGE])
    assert env.charges[0, 0].sum() == 2
    assert env.deck[0].sum() == before - 2

    # With one card left anywhere, a two-card charge banks the one card.
    env = table(rules=RuleSet(charge_draw=2))
    env.deck[0] = 0
    env.discard[0] = 0
    env.deck[0, 4] = 1
    env.step([0], [CHARGE])
    assert env.charges[0, 0].sum() == 1


def test_strict_breakthrough_holds_at_dead_level():
    env = table(rules=RuleSet(strict_breakthrough=True))
    env.shield[0, 1] = 7
    env.deck[0] = 0
    env.deck[0, 6] = 1                      # exactly 7 into a 7
    bank(env, 0, 1, [10, 10])
    env.step([0], [ATTACK])
    assert env.charges[0, 1].sum() == 2, "equal no longer disarms"
    assert env.health[0, 1] == 20


def test_deal_four_spends_the_same_four_cards():
    for pick in ("high", "low", "mid"):
        env = Spaceships(400, 3, rng=np.random.default_rng(2),
                         rules=RuleSet(deal_four=True, shield_pick=(pick,)))
        # Four cards a player, exactly as the standard deal uses.
        assert env.deck.sum(1).min() == 52 - 4 * 3
        assert (env.shield >= 1).all() and (env.shield <= 13).all()
        assert (env.health >= 3).all()
    high = Spaceships(4000, 2, rng=np.random.default_rng(3),
                      rules=RuleSet(deal_four=True, shield_pick=("high",)))
    low = Spaceships(4000, 2, rng=np.random.default_rng(3),
                     rules=RuleSet(deal_four=True, shield_pick=("low",)))
    assert high.shield.mean() > low.shield.mean() + 4
    assert low.health.mean() > high.health.mean() + 4


def main():
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print(f"  ok  {t.__name__}")
    print(f"\n{len(tests)} rules tests passed")


if __name__ == "__main__":
    main()
