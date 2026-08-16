# Spaceships

A ship-combat card game played with one standard 52-card deck and a pen. Each
player is a ship with **health**, a **shield**, and the ability to **charge**
weapons before firing. Two to six players, about a dozen turns for a duel.

Suits are ignored entirely. Only the number on the card matters, Ace = 1 through
King = 13, and where the card sits in front of you: **the shield above, the
health cards below it.**

## The game in one minute

You are dealt three health cards and one shield. Add the health cards up and
write the total on paper — that is the only health you will ever have, because
nothing in this game heals. Your shield is a **standing threshold**: every
attack against you has to clear it, and being attacked never damages or uses
it up. It is not untouchable, though — a swap replaces it with a blind draw,
and *anyone* may spend a turn swapping it, you included. A King is a fortress
until somebody swaps it away; a 3 is a wound you carry until you spend a turn
fixing it.

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
src/                the playable web app: game engine, opponents, table UI
public/             the home-screen icons and the web manifest
tests/              the rules tests, and parity tests against the ML engine
game/index.html     an older single-file version, no build step
analysis/           the arithmetic the rules were designed against
ml/                 a batched engine and a self-play trainer
```

### Play it

The game is a [Next.js](https://nextjs.org) app built to be hosted on
[Vercel](https://vercel.com). You sit at the near seat against one to three
engine opponents:

```
npm install
npm run dev          # play at http://localhost:3000
npm test             # 32 tests: the rules, and parity with the ML engine
```

You choose who you sit down against — the same ladder the ML project measured
itself on:

| opponent | who it is |
| --- | --- |
| **Cadet** | uniform over legal moves — the floor |
| **Gunner** | fires at the first opportunity, the impatience the rules punish |
| **Officer** | the reference heuristic from the analysis scripts |
| **Ace** | the self-play network — 4.1 million games of training |

There is an **Ask the Ace** button on your turn: it shows what the trained
network would do from your seat, with its five action scores, so you can
practice against its judgement and not just its results. The scoreboard in the
top bar keeps your running record against each opponent between sessions.

The table has two uses, switched in the top bar. **Play** is the game: you at
the near edge, learning against the ladder at whatever pace suits you — the
engines take their turns slowly enough to watch, and a seat flashes when a
breakthrough lands on it. **Watch** takes you out of the deal and sits the
engines against each other — Ace against Officer in a duel, the whole ladder
at a bigger table — which is the self-play arena from `ml/` run at a human
pace instead of thirty-five thousand games a second.

Every opponent sees only what you see. Charges are face down to everybody —
the engines are handed the public state of the table, never the values of the
face-down cards, and the test suite asserts exactly that.

#### On a phone

The table is meant to be played standing up on a bus, so on a narrow screen it
stops being a page and becomes one screen you never scroll. The header, the
table and the buttons divide the height between them, and the cards are cut to
whatever the table is left with — so the whole game is in front of you at two,
three or four seats, on a 4.7&Prime; phone as much as on a tablet.

The four things you only want occasionally move out of the way into sheets you
pull up over the table: **Setup** (who you are playing, how many, how fast, and
the rules), **Log** (the play-by-play, with the score sheet), **Ask the Ace**
(which comes down from the top so your buttons stay live under it), and the
rules themselves. Tap a seat to aim, tap away from a sheet to put it back.
Turned on its side the buttons move to a rail down the right-hand edge.

Add it to your home screen and it opens without the browser's chrome, which is
most of a card's height back.

#### Deploy it on Vercel

The app is a fully static export — no server code, nothing to configure:

```
npm i -g vercel && vercel       # or: push the repo and import it on vercel.com
```

Importing the repository at [vercel.com/new](https://vercel.com/new) works as
is: Vercel detects Next.js, runs `next build`, and serves the exported site
from its CDN. The trained network ships as ~20 kB of weights inside the
JavaScript bundle and runs in the browser, so games cost no compute after the
page loads.

#### Is the browser opponent the real one?

Yes, provably. The TypeScript engine is tested against the Python one three
ways (`npm test`):

- the 16 rules tests from `ml/test_engine.py`, ported clause for clause,
- 360 golden positions photographed out of real games by `ml/export_web.py`,
  where target choice, legal moves, all 26 features, the network's five output
  scores and every policy's chosen action must match the Python engine exactly,
- whole-game statistics — median game length and reshuffle rate at every
  player count against the published tables, and the Ace's win rate over the
  Officer, which must still be roughly the trained 81%.

Retrain the checkpoint, run `python3 -m ml.export_web`, and the browser
opponent moves with it.

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

## Roadmap

- **Rule design as a collaboration.** Teach the rules to a model that can also
  simulate them, and ask it to propose new rules that make sense — variants
  that keep the game going, deepen the choices, or close the failure modes the
  design notes worry about (the passive table above all). The tooling for this
  already exists in the repo: a candidate rule goes into `ml/engine.py`, the
  self-play trainer measures what it does to the game's rhythm, and the ones
  that survive the arithmetic graduate to RULES.md and the app.
- **Human results as evidence.** The web app records your results against each
  engine; enough games against the Ace is playtest data the design notes can
  actually use.
- **Finish the progressive web app.** The manifest is there, so a phone will
  already install it to the home screen and open it without browser chrome.
  What is missing is the half that needs a service worker: the game working
  with no signal at all — it is a static export with the opponent's weights in
  the bundle, so there is nothing it needs the network for once it has loaded —
  along with a prompt to install rather than a buried browser menu, and the
  running record surviving a cache clear. Worth doing in that order; offline is
  the one that changes where the game can be played.
