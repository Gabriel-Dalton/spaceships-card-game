"""Self-play training by evolution strategies.

The search is deliberately simple, because the interesting engineering here is
the batching rather than the optimiser. Each generation:

  1. Draw K noise vectors and build 2K candidates, theta +/- sigma*eps. Mirrored
     pairs mean every direction is tried both ways, which cancels most of the
     luck in the deal.
  2. Seat every candidate at ``--games`` tables against opponents drawn from the
     league, alternating who moves first so nobody profits from the seat.
  3. Score each candidate by win rate, rank-normalise (so a lucky run of deals
     cannot dominate a generation), and step theta along the weighted noise.

All 2K * games tables are one batch. With the defaults that is 24 * 2 * 96 =
4608 games advancing in lockstep per generation, which is where the throughput
comes from -- not from threads.

Why ES and not a gradient method: the reward here arrives once, at the end of a
game that took thirty turns and several thousand card draws to get to, and the
thing being learned is mostly a handful of thresholds (how deep to bank, when a
shield is worth repairing, when to spend a turn disarming). ES treats the whole
game as a black box, needs no credit assignment through that noise, and
parallelises perfectly across the batch.

The league is what makes it self-improving rather than merely fitting the
heuristic. Snapshots of past selves are added as opponents at a fixed interval,
so beating last week's ship is the moving target.

    python -m ml.train --generations 200
    python -m ml.train --resume ml/runs/latest.json --generations 100
"""

from __future__ import annotations

import argparse
import json
import os
import time

import numpy as np

from .engine import Spaceships, play
from .policies import (GreedyPolicy, HeuristicPolicy, MLPPolicy, RandomPolicy)

BASELINES = {"heuristic": HeuristicPolicy, "random": RandomPolicy,
             "greedy": GreedyPolicy}


# --------------------------------------------------------------- evaluation

def match(theta_a, opponent, n_games, n_players, hidden, rng, temperature=0.0,
          max_turns=400):
    """Win rate of ``theta_a`` against one opponent, seats alternated.

    ``opponent`` is either a Policy or a parameter vector. Every seat rotation
    is played an equal number of times, so the first-turn advantage the rules
    hand to the lowest health total does not end up in the score.
    """
    env = Spaceships(n_games, n_players, rng=rng, max_turns=max_turns)
    learner = MLPPolicy(theta_a, hidden=hidden, temperature=temperature)
    opp = (opponent if hasattr(opponent, "act")
           else MLPPolicy(opponent, hidden=hidden, temperature=temperature))
    seat = np.arange(n_games) % n_players
    seat_policy = np.ones((n_games, n_players), dtype=int)
    seat_policy[np.arange(n_games), seat] = 0
    winners = play(env, [learner, opp], seat_policy, rng)
    return float((winners == seat).mean())


# ----------------------------------------------------------------- training

class Trainer:
    def __init__(self, args):
        self.args = args
        self.rng = np.random.default_rng(args.seed)
        self.hidden = args.hidden
        self.n_params = MLPPolicy.n_params(args.hidden)
        self.theta = MLPPolicy.initial(args.hidden, self.rng)
        self.league = []            # frozen past selves
        self.history = []
        self.gen = 0
        # Adam, so a flat direction in one weight does not stall the rest.
        self.m = np.zeros(self.n_params)
        self.v = np.zeros(self.n_params)

    # -- persistence ---------------------------------------------------
    def save(self, path):
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "w") as fh:
            json.dump({
                "hidden": self.hidden,
                "n_players": self.args.players,
                "generation": self.gen,
                "theta": self.theta.tolist(),
                "league": [t.tolist() for t in self.league[-6:]],
                "history": self.history,
            }, fh)

    def load(self, path):
        with open(path) as fh:
            d = json.load(fh)
        self.hidden = d["hidden"]
        self.n_params = MLPPolicy.n_params(self.hidden)
        self.theta = np.array(d["theta"])
        self.league = [np.array(t) for t in d.get("league", [])]
        self.history = d.get("history", [])
        self.gen = d.get("generation", 0)
        self.m = np.zeros(self.n_params)
        self.v = np.zeros(self.n_params)

    # -- one generation ------------------------------------------------
    def generation(self):
        a = self.args
        K, G, P = a.population, a.games, a.players
        eps = self.rng.normal(size=(K, self.n_params))
        cands = np.concatenate([self.theta + a.sigma * eps,
                                self.theta - a.sigma * eps])
        n_cand = len(cands)
        B = n_cand * G

        # Every row: which candidate is playing, and in which seat.
        row_cand = np.repeat(np.arange(n_cand), G)
        seat = np.arange(B) % P

        # Opponents: part league, part the hand-written baselines. Training
        # only against past selves drifts; only against the heuristic overfits
        # to it. Both, in a fixed mix.
        pool = [("heuristic", None), ("greedy", None), ("random", None)]
        weights = [a.heuristic_frac, a.greedy_frac, a.random_frac]
        if self.league:
            pool.append(("league", None))
            weights.append(a.self_play_frac)
        weights = np.array(weights, dtype=float)
        weights /= weights.sum()
        kind = self.rng.choice(len(pool), size=B, p=weights)

        learner = MLPPolicy(cands, hidden=self.hidden, row_variant=row_cand,
                            temperature=a.temperature)
        league_idx = self.rng.integers(0, max(len(self.league), 1), size=B)
        league_pol = MLPPolicy(
            np.array(self.league) if self.league else self.theta[None],
            hidden=self.hidden, row_variant=league_idx,
            temperature=a.temperature)
        policies = [learner, HeuristicPolicy(), GreedyPolicy(), RandomPolicy(),
                    league_pol]

        seat_policy = np.empty((B, P), dtype=int)
        seat_policy[:] = (kind + 1)[:, None]        # 1..4 as chosen above
        seat_policy[np.arange(B), seat] = 0          # the learner's seat

        env = Spaceships(B, P, rng=self.rng, max_turns=a.max_turns)
        winners = play(env, policies, seat_policy, self.rng)
        won = (winners == seat).astype(np.float64)
        fitness = won.reshape(n_cand, G).mean(1)

        # Rank-normalise to [-0.5, 0.5]: the size of a win-rate gap says less
        # than its sign when each candidate only played G noisy games.
        order = np.argsort(np.argsort(fitness))
        util = order / (n_cand - 1) - 0.5
        signed = util[:K] - util[K:]
        grad = (signed @ eps) / (K * a.sigma)

        # Adam step, ascending.
        self.m = a.beta1 * self.m + (1 - a.beta1) * grad
        self.v = a.beta2 * self.v + (1 - a.beta2) * grad * grad
        t = self.gen + 1
        mhat = self.m / (1 - a.beta1 ** t)
        vhat = self.v / (1 - a.beta2 ** t)
        self.theta += a.lr * mhat / (np.sqrt(vhat) + 1e-8)
        self.theta *= (1 - a.weight_decay)

        self.gen += 1
        return {"fitness_mean": float(fitness.mean()),
                "fitness_best": float(fitness.max()),
                "games": B,
                "turns_median": int(np.median(env.turns))}


def evaluate(trainer, n_games=None):
    a = trainer.args
    n = n_games or a.eval_games
    out = {}
    for name, cls in BASELINES.items():
        out[name] = match(trainer.theta, cls(), n, a.players, trainer.hidden,
                          trainer.rng)
    if trainer.league:
        out["past_self"] = match(trainer.theta, trainer.league[-1], n,
                                 a.players, trainer.hidden, trainer.rng)
    return out


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--generations", type=int, default=150)
    p.add_argument("--population", type=int, default=24,
                   help="K noise directions; 2K candidates per generation")
    p.add_argument("--games", type=int, default=96,
                   help="games per candidate per generation")
    p.add_argument("--players", type=int, default=2)
    p.add_argument("--hidden", type=int, default=32)
    p.add_argument("--sigma", type=float, default=0.08)
    p.add_argument("--lr", type=float, default=0.03)
    p.add_argument("--beta1", type=float, default=0.9)
    p.add_argument("--beta2", type=float, default=0.999)
    p.add_argument("--weight-decay", type=float, default=1e-4)
    p.add_argument("--temperature", type=float, default=0.5,
                   help="softmax temperature while training; 0 evaluates greedily")
    p.add_argument("--max-turns", type=int, default=400)
    p.add_argument("--self-play-frac", type=float, default=0.45)
    p.add_argument("--heuristic-frac", type=float, default=0.35)
    p.add_argument("--greedy-frac", type=float, default=0.1)
    p.add_argument("--random-frac", type=float, default=0.1)
    p.add_argument("--snapshot-every", type=int, default=15)
    p.add_argument("--eval-every", type=int, default=10)
    p.add_argument("--eval-games", type=int, default=3000)
    p.add_argument("--seed", type=int, default=20260816)
    p.add_argument("--out", default="ml/runs/latest.json")
    p.add_argument("--resume", default=None)
    a = p.parse_args(argv)

    tr = Trainer(a)
    if a.resume:
        tr.load(a.resume)
        print(f"resumed {a.resume} at generation {tr.gen}")

    print(f"{a.players}-player self-play, {2*a.population} candidates x "
          f"{a.games} games = {2*a.population*a.games} tables per generation")
    print(f"{'gen':>5} {'fit':>6} {'best':>6} {'vs heur':>8} {'vs greedy':>10} "
          f"{'vs rand':>8} {'vs past':>8} {'league':>7} {'sec':>6}")

    start = time.time()
    for _ in range(a.generations):
        t0 = time.time()
        stats = tr.generation()
        line = None
        if tr.gen % a.eval_every == 0 or tr.gen == a.generations:
            ev = evaluate(tr)
            tr.history.append({"generation": tr.gen, **stats, **ev})
            line = ev
        if tr.gen % a.snapshot_every == 0:
            tr.league.append(tr.theta.copy())
            if len(tr.league) > 8:           # keep the first and the recent
                tr.league = tr.league[:1] + tr.league[-7:]
        if line is not None:
            print(f"{tr.gen:>5} {stats['fitness_mean']:>6.3f} "
                  f"{stats['fitness_best']:>6.3f} {line['heuristic']:>8.3f} "
                  f"{line['greedy']:>10.3f} {line['random']:>8.3f} "
                  f"{line.get('past_self', float('nan')):>8.3f} "
                  f"{len(tr.league):>7} {time.time()-t0:>6.1f}")
            tr.save(a.out)

    tr.save(a.out)
    final = evaluate(tr, max(a.eval_games, 6000))
    print(f"\ntrained {a.generations} generations in {time.time()-start:.0f}s")
    print("final win rate, seats alternated, greedy play:")
    for k, v in final.items():
        print(f"    vs {k:<10} {v:.3f}")
    print(f"saved to {a.out}")


if __name__ == "__main__":
    main()
