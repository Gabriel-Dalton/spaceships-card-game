# Spaceships

A ship-combat card game played with one standard 52-card deck and a pen. Each
player is a ship with **health**, a **shield**, and the ability to **charge**
weapons before firing. Two to six players, about a dozen turns for a duel.

Suits are ignored entirely. Only the number on the card matters, Ace = 1 through
King = 13, and how the card is turned on the table: **vertical is health,
horizontal is shield.**

## The game in one minute

You are dealt three health cards and one shield. Add the health cards up and
write the total on paper — that is the only health you will ever have, because
nothing in this game heals. Your shield is a **permanent threshold**: every
attack against you for the rest of the game has to clear it, and it is never
damaged or used up. A King is a fortress; a 3 is a wound you carry until you
spend a turn swapping it.

On your turn you do exactly one of three things:

| | | |
| --- | --- | --- |
| **Charge** | Draw a card and put it face down in front of you, **without looking at it.** | Trades a turn for power. |
| **Swap a shield** | Replace your shield — or somebody else's — with a blind draw. | Trades a turn for defence, or wrecks theirs. |
| **Attack** | Draw one card. Say *"charge attack"* first and you also flip your entire bank in. | Cashes in. |

Damage is `attack value - their shield`, and it comes off their written total.
Break through and **their whole bank of charges is destroyed**, whether you
charged or not.

Two rules carry the whole game. **Nobody may look at charges, their owner
included** — the count is public, the value is known to no one — so declaring a
charge attack is a bet on a number of cards, not a calculation. And the
declaration is **binding**: say it and the bank is spent whether it lands or
bounces off, which stops a charge attack from being a free peek at your own
stockpile.

The full rules, with the reasoning behind each one, are in **[RULES.md](RULES.md)**.

## What is in here

```
RULES.md            the rules, and the design notes arguing for them
game/index.html     the game, playable in a browser, no build step
analysis/           the arithmetic the rules were designed against
ml/                 a batched engine and a self-play trainer
```

### Play it

```
open game/index.html
```

A single self-contained file — no server, no dependencies. It seats two to four
players around a table, deals, tracks the running health totals for you, and
keeps charges face down where they belong.

### The arithmetic

`analysis/` is four standalone scripts, no dependencies, each answering one
question the rules had to settle. Run any of them directly:

```
python3 analysis/charge_math.py     # when is a charge attack blocked?
python3 analysis/deck_budget.py     # does a 52-card deck last a whole game?
python3 analysis/reshuffle.py       # what the reshuffle rule buys, and the deadlock it fixes
python3 analysis/alliance.py        # one against two, from the photo
```

Their answers are what the design notes in RULES.md are built on: that an
uncharged attack deals about zero damage, that banking would be correct forever
if nobody ever disarmed you, and that the deck is a hard turn budget until you
reshuffle it.

### The machine learning project

`ml/` is where the game learns to play itself. It has a rewritten engine that
simulates **thousands of tables in one array operation**, and a self-play
trainer that improves a policy against a league of its own past selves.

```
pip install numpy
python3 -m ml.test_engine                                # 16 rules tests
python3 -m ml.train --generations 400                    # train
python3 -m ml.arena --checkpoint ml/runs/duel.json --profile
```

Roughly 35,000 complete games per second on one core, which is what makes the
training loop practical: a generation is 10,240 games and takes about a second.
A full run is 4.1 million games in a little over three minutes, after which the
trained ship beats the reference heuristic **81%** of the time with seats
alternated, and random play 96%.

The engine is checked against the hand-written simulations in `analysis/` and
reproduces their published numbers — median game length, reshuffles per game and
deadlock rate — at every player count from two to six.

It has already found something the rules draft got wrong. The design notes
assume the right rhythm is to bank three charges and then fire; self-play fires
at a bank of one, and the ablation confirms it — a heuristic that banks to 2
beats the identical heuristic banking to 3 by 72 games in 100. The reason is the
one the notes themselves identify: everything depends on how readily the table
takes the free disarm shot, and against an opponent who takes it early, a deep
bank never survives to be spent.

See **[ml/README.md](ml/README.md)** for the design — what the policy is allowed
to see, why the search is evolution strategies rather than a gradient method,
and the full profile of what the trained ship does.

## Status

The rules are a fourth-pass working draft. Sections marked **[inferred]** in
RULES.md are readings that have not been ruled on, and the open questions at the
bottom list what is still undecided — the one that matters most is whether a
shield swap is a blind forced draw or a look-first choice, because it changes
the model rather than just the play.
