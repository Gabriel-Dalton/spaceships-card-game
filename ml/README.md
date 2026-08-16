# Spaceships, played by machines

A batched engine and a self-play trainer for the game in [RULES.md](../RULES.md).
The engine simulates tens of thousands of tables in one array operation, and the
trainer uses that throughput to improve a policy against a league of its own
past selves.

```
pip install numpy

python3 -m ml.test_engine                                  # 16 rules tests
python3 -m ml.train --generations 400                      # train a duellist
python3 -m ml.arena --checkpoint ml/runs/duel.json --profile
```

Nothing here needs a GPU, a framework, or more than one core. `numpy` is the
only dependency.

## Why this game is unusually tractable

Most card games are hard to learn because of hidden information: you hold cards
your opponent cannot see, so there is no single "state", and a solver needs an
equilibrium over beliefs rather than a best move.

Spaceships deliberately has none of that. **Charges are face down to everybody,
including their owner.** Nobody knows what a bank is worth, so every player at
the table is looking at exactly the same position: healths, shields, charge
counts, and what has gone to the discard. That makes it a *perfect-information
stochastic game* — the randomness is all in the deck, none of it in what anyone
knows — and a policy can be a plain function of the visible state.

It also means the engine can be honest about it. `features()` returns only
public information, and there is a test (`test_no_policy_can_see_a_bank_value`)
asserting that two tables identical except for what is face down produce
identical observations. A bank of three Aces and a bank of three Kings look the
same to the network, because they look the same to the players.

## The engine

`engine.py`. Every array has a leading batch axis and a step advances all live
games at once.

A deck is not a shuffled list, it is a length-13 vector of how many of each rank
remain, and a draw samples a rank in proportion to it. That is exactly
equivalent to shuffling and taking the top card, and unlike a list it vectorises
— one `cumsum` and one comparison draws a card for fifty thousand tables.

```
                 shape                what it is
health           [B, P]               the running total on the paper
shield           [B, P]               a permanent threshold, 1..13
charges          [B, P, 13]           how many of each rank are face down
deck, discard    [B, 13]              counts, not order
cur              [B]                  whose turn it is
```

Games in a batch finish at different times; a finished row leaves `active` and
is never stepped again, so a batch costs less as it goes.

**Throughput:** about 35,000 complete two-player games per second on one core,
falling to roughly 8,000 at six players (the games are four times longer). A
training generation of 10,240 games takes about a second.

### Is it the right game?

The engine reproduces the numbers in the RULES.md design notes, which were
produced independently by the plain-Python simulations in `../analysis/`. All
heuristic play, 20,000 games per player count:

| players | median turns | published | reshuffles | published |
| --- | --- | --- | --- | --- |
| 2 | 13 | 13 | 0.00 | 0.00 |
| 3 | 22 | 22 | 0.02 | 0.01 |
| 4 | 31 | 31 | 0.28 | 0.28 |
| 5 | 42 | 42 | 0.88 | 0.91 |
| 6 | 53 | 54 | 1.50 | 1.62 |

The small drift at five and six players is target selection: the batched engine
breaks ties between equal shields by bank size, which the older script did not.

On top of that, `test_engine.py` checks the clauses individually — that a shield
absorbs and is never consumed, that a blocked charge attack still burns the
bank, that an attack of exactly 7 into a 7 shield does no damage but still
disarms, that undeclared charges are never spent, that cards are conserved, that
the discards reshuffle, and that a table where everybody banks forever resolves
itself through the forced-fire backstop instead of deadlocking.

### Two things the rules do not settle

The engine had to decide them anyway, and both are marked in the code:

1. **A destroyed ship's cards.** Its shield and live bank go to the discard, so
   they keep circulating; its health cards do not, same as everybody's. RULES.md
   is silent on this.
2. **Targeting is not learned.** Whom to attack is chosen by a fixed rule —
   softest shield first, and among equal shields the biggest bank, which is the
   disarm shot the design notes say the game depends on somebody taking. With
   two players there is no choice to make. Above two, an action space indexed by
   seat is not permutation-invariant — seat 3 means nothing in common between
   one game and the next — so a learned head over seats would mostly be learning
   noise. The policy learns *what to do*, the rule picks *at whom*.

## The action space

Five actions, which is the whole game:

```
0  charge                 bank a card, face down, unlooked at
1  swap own shield        blind draw, forced
2  attack                 one card; your bank takes no part and is not spent
3  charge attack          one card plus the entire bank; binding, spent either way
4  swap their shield      wreck the target's, blind
```

A charge attack with an empty bank is just a plain attack, so it is never
offered. When the deck and the discard are both empty it is the *only* thing
offered, which is the forced-fire backstop; with no bank either, the turn passes.

## The learner

`policies.py` holds the ships. `RandomPolicy` is the floor. `HeuristicPolicy` is
the reference play from `analysis/reshuffle.py`, action for action — repair a
shield below 5, take the free disarm shot at anyone holding three charges behind
a soft shield, cash in at three charges or when the expected total is already
lethal, otherwise bank. `GreedyPolicy` fires at every opportunity, which the
design notes predict is bad. `MLPPolicy` is the one that learns: 26 public
features → `tanh(32)` → a score per action, masked to the legal ones. About a
thousand parameters.

### Evolution strategies, not policy gradients

`train.py` searches the weights directly. Each generation draws K noise vectors,
builds 2K candidates at `theta ± sigma·eps`, plays every candidate against the
league, ranks them by win rate, and steps `theta` along the noise weighted by
those ranks (Adam, so a flat direction in one weight does not stall the others).

Three reasons this fits the game better than a gradient method:

- **The reward arrives once**, at the end of a game that took thirty turns and a
  few hundred card draws to reach. Credit assignment through that much noise is
  exactly what ES sidesteps by treating the game as a black box.
- **What is being learned is mostly thresholds** — how deep to bank, when a
  shield is worth a turn, when somebody else's bank is worth a turn. That is a
  low-dimensional thing to find and it does not need per-step gradients.
- **It matches the batching.** All 2K candidates share one call to the engine:
  `row_variant` tells the policy which parameter set is sitting in which game,
  so a generation is a single batch of `2K × games` tables rather than 2K
  separate runs.

Mirrored pairs (`+eps` and `-eps`) cancel most of the luck in the deal, and
rank-normalising the fitness means a candidate that happened to be dealt three
Kings cannot dominate a generation by the size of its win rate — only by its
order.

### The league is what makes it self-improving

Training only against the heuristic would produce a ship that beats the
heuristic and nothing else. Training only against itself drifts, because there
is nothing anchoring it. So opponents are drawn from a fixed mix:

```
--heuristic-frac 0.35    the reference play
--self-play-frac 0.45    snapshots of past selves, added every 15 generations
--greedy-frac    0.10    the impatient play
--random-frac    0.10    keeps the obvious blunders punished
```

Seats are alternated in every match, so the first-turn advantage the rules hand
to the lowest health total never ends up in anyone's score. A win rate of 0.500
means genuinely level.

Checkpoints are JSON: the weights, the league, and the full evaluation history.
`--resume` picks a run back up.

## What it learned

400 generations — 4.1 million games, 194 seconds on one core. The round robin,
4,000 games per pairing, seats alternated:

```
                    random      greedy   heuristic     learned     overall
random                --         0.215       0.081       0.038       0.111
greedy               0.782        --         0.254       0.139       0.392
heuristic            0.906       0.753        --         0.186       0.615
learned              0.953       0.854       0.812        --         0.873
```

`--profile` poses it a grid of positions and prints what it does, which turns a
thousand weights back into the kind of thresholds the design notes argue about.
Three things came out of it.

**It repairs a shield of 5 or below.** Exactly the threshold the hand-written
heuristic uses, arrived at independently. The design notes predict this one from
the arithmetic — a blind swap has positive expected return below 7 — and the
network stops a little short of 7, which is right, because a swap also costs a
turn.

**It will not try to out-damage a King.** Against a shield of 10 or 13 with a
small bank it spends the turn swapping *their* shield instead of charging
through it, and only charges through once it is already holding three. That is
the design notes' advice ("you don't out-damage that") learned rather than
told, and it is the action the reference heuristic never takes: swapping an
opponent's shield is 11% of the learned policy's moves and 0% of the
heuristic's.

**It banks far more shallowly than the design notes assume** — and this is the
one that disagrees with the draft. It fires at a mean bank of **1.11 charges**
where the heuristic waits for 3. That looked like a bug, so it is worth checking
directly: take the reference heuristic and vary nothing but its banking depth.

| heuristic banks to | vs the learned policy | vs heuristic(3) | vs greedy |
| --- | --- | --- | --- |
| 1 | 0.353 | **0.613** | 0.785 |
| 2 | 0.196 | **0.725** | 0.785 |
| 3 (the reference) | 0.184 | 0.501 | 0.747 |
| 4 | 0.177 | 0.374 | 0.736 |
| 5 | 0.180 | 0.358 | 0.720 |

Banking to 2 beats banking to 3 by 72 games in 100. The design notes are not
wrong about *why* — they derive the optimal bank from the per-turn chance *h* of
being broken through and disarmed, and get 3 at h=10% and 1 at h=35%. What the
draft underestimates is *h* itself. Against an opponent who actually takes the
free disarm shot the moment you hold two charges — which is what the network
learned to do, and what the third profile sweep shows — a deep bank almost never
survives to be spent. The reference heuristic only disarms at three charges, and
pays for the delay.

So the design notes' closing worry, that the game depends on players actually
taking the disarm shot, is the right worry. Self-play just says the threshold is
lower than the draft assumed, and that the correct cycle in a duel is closer to
*bank one, fire* than *bank three, fire*.

## Files

```
engine.py        the batched game. Everything else depends only on this.
policies.py      random, greedy, the reference heuristic, and the network
train.py         self-play by evolution strategies, with a league
arena.py         round-robin scoring, and the behaviour profile
test_engine.py   16 rules tests; python3 -m ml.test_engine
runs/            checkpoints
```

## Where to take it next

- **More than two players.** The engine already seats six and the trainer takes
  `--players`, but kingmaking makes the win rate a poor objective at a full
  table — surviving longer is not the same as playing well when two opponents
  can agree to shoot at you.
- **A solver to check the policy against.** RULES.md argues the game is small
  enough for backward induction, which would give an exact best move to measure
  the network's error against rather than another heuristic's.
- **Learned targeting**, via a per-opponent score rather than a seat-indexed
  head, which is what the current fixed rule is standing in for.
- **Rule search.** The engine is fast enough to run the open questions in
  RULES.md as experiments: settle shield swaps blind or look-first, retune the
  starting health, and see which version produces the longer fight.
- **Feeding the banking result back into the rules.** If the correct duel is
  *bank one, fire*, the charging game is thinner than the draft intends, and the
  fix is a rules question rather than a training one — a cheaper disarm makes it
  worse, a costlier one makes banking safe again.
