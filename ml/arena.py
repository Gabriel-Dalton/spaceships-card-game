"""Score ships against each other, and read back what a trained one learned.

    python -m ml.arena                          # round-robin the baselines
    python -m ml.arena --checkpoint ml/runs/latest.json
    python -m ml.arena --checkpoint ml/runs/latest.json --profile

The round-robin alternates seats, so the first-turn advantage cancels and 0.500
means genuinely level. ``--profile`` is the more interesting output: it poses
the trained policy a grid of positions and prints what it does, which turns a
thousand weights back into the kind of thresholds the design notes argue about.
"""

from __future__ import annotations

import argparse
import json

import numpy as np

from .engine import ACTION_NAMES, Spaceships, play
from .policies import GreedyPolicy, HeuristicPolicy, MLPPolicy, RandomPolicy


def load_checkpoint(path, temperature=0.0, name=None):
    with open(path) as fh:
        d = json.load(fh)
    pol = MLPPolicy(np.array(d["theta"]), hidden=d["hidden"],
                    temperature=temperature,
                    name=name or f"learned@g{d.get('generation', '?')}")
    return pol, d


def head_to_head(a, b, n_games, n_players, rng, max_turns=400):
    """Win rate of ``a``, with ``a`` taking every seat equally often."""
    env = Spaceships(n_games, n_players, rng=rng, max_turns=max_turns)
    seat = np.arange(n_games) % n_players
    seat_policy = np.ones((n_games, n_players), dtype=int)
    seat_policy[np.arange(n_games), seat] = 0
    winners = play(env, [a, b], seat_policy, rng)
    return float((winners == seat).mean()), env


def round_robin(policies, n_games, n_players, rng):
    n = len(policies)
    grid = np.full((n, n), np.nan)
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            grid[i, j], _ = head_to_head(policies[i], policies[j], n_games,
                                         n_players, rng)
    return grid


def print_grid(policies, grid):
    names = [p.name for p in policies]
    w = max(len(x) for x in names) + 2
    print(" " * w + "".join(f"{n:>12}" for n in names) + f"{'overall':>12}")
    for i, n in enumerate(names):
        row = "".join("      --    " if i == j else f"{grid[i, j]:>12.3f}"
                      for j in range(len(names)))
        overall = np.nanmean(grid[i])
        print(f"{n:<{w}}{row}{overall:>12.3f}")
    print("\n  read as: row's win rate against column, seats alternated")


# ------------------------------------------------------------------ profile

def _posed(n, n_players=2, seed=0):
    """A batch of hand-set positions, all with the mover in seat 0."""
    env = Spaceships(n, n_players, rng=np.random.default_rng(seed))
    env.charges[:] = 0
    env.discard[:] = 0
    env.deck[:] = 4
    env.health[:] = 20
    env.shield[:] = 7
    env.alive[:] = True
    env.turns[:] = 6
    env.done[:] = False
    env.cur[:] = 0
    return env


def profile(policy, n_players=2):
    """What does it do, position by position?

    Three sweeps, each holding everything else at the average table: how deep it
    banks against a given shield, when it repairs its own shield, and when it
    spends a turn disarming somebody.
    """
    rng = np.random.default_rng(0)
    banks = range(0, 7)
    shields = [2, 4, 7, 10, 13]

    print("\n1. HOW DEEP DOES IT BANK?")
    print("   Own shield 7, both on 20 health. Rows: their shield. Columns: how")
    print("   many charges we are already sitting on.")
    print(f"   {'their shield':>13}" + "".join(f"{b:>13}" for b in banks))
    for s in shields:
        env = _posed(len(banks), n_players)
        for i, b in enumerate(banks):
            env.shield[i, 1] = s
            env.charges[i, 0, 6] = b          # b sevens: an average bank
        rows = np.arange(len(banks))
        acts = policy.act(env.features(rows), env.legal_actions(rows),
                          env.public_view(rows), rng, rows)
        cells = "".join(f"{_short(a):>13}" for a in acts)
        print(f"   {s:>13}" + cells)

    print("\n2. WHEN DOES IT REPAIR ITS OWN SHIELD?")
    print("   Their shield 7, we hold no charges. Rows: our shield.")
    for s in range(1, 14):
        env = _posed(1, n_players)
        env.shield[0, 0] = s
        rows = np.arange(1)
        act = policy.act(env.features(rows), env.legal_actions(rows),
                         env.public_view(rows), rng, rows)[0]
        bar = "#" * s
        print(f"   our shield {s:>2}  {bar:<13}  {ACTION_NAMES[act]}")

    print("\n3. WHEN IS SOMEBODY ELSE'S BANK WORTH A TURN?")
    print("   Both shields 7. Rows: their charge count. Columns: ours, which")
    print("   decides whether the disarm shot is free or costs us the bank.")
    ours = [0, 1, 2, 4]
    print(f"   {'their charges':>13}" + "".join(f"{'ours ' + str(o):>13}"
                                                for o in ours))
    for c in range(0, 8):
        env = _posed(len(ours), n_players)
        for i, o in enumerate(ours):
            env.charges[i, 0, 6] = o
            env.charges[i, 1, 6] = c
        rows = np.arange(len(ours))
        acts = policy.act(env.features(rows), env.legal_actions(rows),
                          env.public_view(rows), rng, rows)
        print(f"   {c:>13}" + "".join(f"{_short(a):>13}" for a in acts))


def _short(a):
    return ["charge", "swap own", "attack", "CHARGE ATK", "swap theirs"][a]


def behaviour(policy, opponent, n_games, n_players, rng):
    """Action mix over real games, and the bank size it fires at."""
    env = Spaceships(n_games, n_players, rng=rng)
    seat = np.zeros(n_games, dtype=int)
    seat_policy = np.ones((n_games, n_players), dtype=int)
    seat_policy[:, 0] = 0
    counts = np.zeros(len(ACTION_NAMES))
    fired_at = []
    while True:
        rows = env.active
        if not len(rows):
            break
        targets = env.choose_targets(rows)
        obs, legal = env.features(rows, targets), env.legal_actions(rows, targets)
        view = env.public_view(rows, targets)
        mine = np.flatnonzero(env.cur[rows] == 0)
        actions = np.full(len(rows), -1, dtype=np.int32)
        for pid, sel in ((0, mine),
                         (1, np.flatnonzero(env.cur[rows] != 0))):
            if not len(sel):
                continue
            pol = policy if pid == 0 else opponent
            actions[sel] = pol.act(obs[sel], legal[sel],
                                   {k: v[sel] for k, v in view.items()},
                                   rng, rows[sel])
        for a in mine:
            if actions[a] >= 0:
                counts[actions[a]] += 1
                if actions[a] == 3:
                    fired_at.append(view["own_charges"][a])
        env.step(rows, actions, targets)
    total = counts.sum()
    print("\n4. WHAT IT ACTUALLY DOES, over real games")
    for i, n in enumerate(ACTION_NAMES):
        print(f"   {n:<20} {counts[i]/total:>7.1%}")
    if fired_at:
        f = np.array(fired_at)
        print(f"   mean bank when it fires  {f.mean():.2f} charges "
              f"(median {int(np.median(f))})")
    print(f"   games {n_games}, median length {int(np.median(env.turns))} turns")


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--checkpoint", action="append", default=[],
                   help="one or more trained checkpoints to enter")
    p.add_argument("--games", type=int, default=4000)
    p.add_argument("--players", type=int, default=2)
    p.add_argument("--seed", type=int, default=1)
    p.add_argument("--profile", action="store_true",
                   help="print what the first checkpoint learned")
    a = p.parse_args(argv)

    rng = np.random.default_rng(a.seed)
    policies = [RandomPolicy(), GreedyPolicy(), HeuristicPolicy()]
    for path in a.checkpoint:
        pol, _ = load_checkpoint(path)
        policies.append(pol)

    print(f"{a.players}-player round robin, {a.games} games per pairing\n")
    print_grid(policies, round_robin(policies, a.games, a.players, rng))

    if a.profile and a.checkpoint:
        learned = policies[-1]
        profile(learned, a.players)
        behaviour(learned, HeuristicPolicy(), 2000, a.players, rng)


if __name__ == "__main__":
    main()
