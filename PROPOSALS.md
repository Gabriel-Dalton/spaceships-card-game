# Proposed rules

Six candidate rules for Spaceships, each measured against the game we have.

Every rule in [RULES.md](RULES.md) was argued for with arithmetic, so a
proposed rule should have to clear the same bar. Each one below is implemented
in `ml/engine.py` behind a flag that is **off by default**, and run against the
standard rules over 20,000 games at two, three and four players:

```
python3 -m ml.proposals
```

Two survive. Three are rejected on the evidence, and one of those is rejected
in a way that argues for keeping the existing rule exactly as it is — which is
worth as much as an adoption.

## What the numbers mean

| column | what it measures |
| --- | --- |
| **deal decides it** | how often the biggest starting health total simply wins. Random is 0.50 at two players, 0.33 at three, 0.25 at four. Health is the one handicap RULES.md says you can never repair, so this is how much of the game is over before it starts. |
| **opener wins** | first-mover advantage. The turn-order rule hands the first turn to the lowest health total specifically to offset it, so *fair* is the same random baseline. |
| **disarms/game** | charges destroyed by somebody else's attack. The design notes say the game's whole rhythm is produced by the threat of this and by nothing else. |
| **charge share** | the fraction of all turns spent banking rather than doing anything. |
| **blocked share** | the fraction of attacks that bounce off a shield with no effect at all. |

## The baseline, and the two problems in it

| players | median turns | deal decides it | opener wins | charge share |
| --- | --- | --- | --- | --- |
| 2 | 13 | 0.552 *(fair 0.500)* | 0.444 *(fair 0.500)* | 0.726 |
| 3 | 22 | 0.458 *(fair 0.333)* | 0.212 *(fair 0.333)* | 0.726 |
| 4 | 31 | 0.348 *(fair 0.250)* | 0.154 *(fair 0.250)* | 0.730 |

Two things stand out, and they are what the proposals are aimed at.

**Nearly three turns in four are spent banking.** The tempo triangle in the
design notes produces a game whose dominant move is *charge*, and the numbers
agree: 73% of all turns, at every player count, are a player drawing a card
face down and doing nothing else. Firing is 18–20%. For a human at the table
that is a lot of turns with one obvious move.

**Above two players the deal is doing more work than the play.** At four
players the biggest starting health total wins 35% of the time against a fair
25%, and the opening player — handed the first turn precisely as compensation
for being dealt worst — wins 15% against a fair 25%. The compensation is
under-paying at three and four players, and the notes are explicit that this
was reasoned out for a duel and never checked at a bigger table. **It doesn't
hold.**

---

## 1. Salvage — *adopt for playtest*

> **When you break through, take one of the destroyed charges into your own
> bank.** It stays face down and unlooked-at, exactly as it was in front of
> its previous owner. The rest of their bank is discarded as usual.

The design notes call the free disarm shot the thing holding the game
together, and then leave it as a pure act of denial: you spend a turn, they
lose a stockpile, and you gain nothing you can spend. Salvage makes the disarm
shot *constructive* — you are boarding the wreck, not just blowing it up —
without touching the arithmetic of any other action.

| | median turns | deal decides it | opener wins | charge share |
| --- | --- | --- | --- | --- |
| standard (4p) | 31 | 0.348 | 0.154 | 0.730 |
| **salvage 1 (4p)** | **27** | **0.287** | **0.189** | **0.694** |
| standard (3p) | 22 | 0.458 | 0.212 | 0.726 |
| **salvage 1 (3p)** | **19** | **0.390** | **0.272** | **0.690** |

At three and four players it moves *both* fairness numbers towards fair at
once — the deal decides less, and the compensated opening player is closer to
even — while shortening the game and cutting the banking share. That is the
best result in this document.

**The catch, stated plainly:** at two players it overshoots. The opener goes
from 0.444 to 0.545, so the first-turn compensation that currently under-pays
starts over-paying. Salvage and the turn-order rule would have to be tuned
together, and the duel is where that shows up.

Salvage 2 (take two cards) is the same effects, larger: 9-turn duels, which is
probably too fast to be a game. **Salvage 1 is the proposal.**

## 2. Charge draws two — *adopt for playtest*

> **A charge draws two cards, not one.** Both go face down, both unlooked-at.
> Everything else is unchanged.

Aimed straight at the 73%. If the problem is that banking eats the game, make
banking twice as productive per turn so fewer turns go into it.

| | median turns | deal decides it | opener wins | charge share | bank when fired |
| --- | --- | --- | --- | --- | --- |
| standard (2p) | 13 | 0.552 | 0.444 | 0.726 | 2.4 |
| **charge draws 2 (2p)** | **7** | **0.476** | **0.521** | **0.618** | **3.3** |
| standard (4p) | 31 | 0.348 | 0.154 | 0.730 | 2.5 |
| **charge draws 2 (4p)** | **19** | **0.322** | **0.185** | **0.626** | **3.4** |

It improves almost everything at once. The banking share drops eleven points,
both fairness numbers move towards fair at every player count, and the bank
being fired is *bigger* — 3.4 cards against 2.5 — so charge attacks become the
dramatic events the rules always described and rarely produced.

**The catch:** a 7-turn duel is three or four turns each. Some of the
improvement here is just the game ending before the deal has time to matter,
which is not the same as the deal mattering less. Before adopting, this wants
either a bigger starting health budget (deal four health cards?) or a look at
whether a four-turn duel is satisfying to actually play. It is unambiguously
the right fix for the banking problem; whether it is the right length is a
playtest question, not an arithmetic one.

**Salvage 1 and charge-draws-2 together** are the best cell in the table at
four players — 18 turns, deal decides 0.284, opener 0.210, charge share 0.594 —
and they do not fight each other.

## 3. Ricochet — *rejected*

> A blocked attack is not discarded: the defender takes the card you drew as a
> charge. Your shot bounces off their shield and they bank the energy.

Thematically the best of the six, and it does nothing at all.

| | median turns | deal decides it | disarms/game | charge share |
| --- | --- | --- | --- | --- |
| standard (4p) | 31 | 0.348 | 9.73 | 0.730 |
| ricochet (4p) | 31 | 0.345 | 9.83 | 0.728 |

Every column is inside the noise. The reason is the **blocked share**: only
9–11% of attacks are blocked at all, because sensible play either fires a bank
big enough to clear the shield or takes the disarm shot at somebody soft. A
rule that fires on one attack in ten, and moves one average card when it does,
cannot reach the numbers that matter. Rejected — not because it is a bad idea
but because it is a rule about a situation the game hardly ever reaches.

## 4. Strict breakthrough — *rejected, and the current rule vindicated*

> An attack must **exceed** the shield to break through. Dead level is blocked.

RULES.md deliberately makes equal count as a breakthrough, which creates the
pure disarm — 7 into a 7 for no damage that still destroys a bank. Worth
checking whether that is load-bearing or just charming.

| | median turns | deal decides it | disarms/game | blocked share |
| --- | --- | --- | --- | --- |
| standard (4p) | 31 | 0.348 | 9.73 | 0.091 |
| strict (4p) | 31 | 0.351 | 9.48 | 0.112 |

The exact-match case is about 2% of attacks, so removing it costs a quarter of
a disarm per game and changes nothing else. **Keep the existing rule.** It is
free, it is characterful, and the alternative buys nothing — which is the
answer the design notes should record rather than leave open.

## 5. Deal four, choose your shield — *rejected as written*

> Deal **four** cards. Choose one to be your shield; the other three are your
> health. Same four cards the standard deal uses — one decision added.

The most attractive proposal on paper: it costs no extra cards, and it turns
the setup from a thing that happens to you into the game's first real
decision. A King is either a fortress or thirteen health, and you cannot have
both.

It is not a decision. Head to head over 20,000 duels, one seat choosing each
way:

| | | seat 0 wins |
| --- | --- | --- |
| highest as shield | against lowest as shield | **0.661** |
| highest as shield | against closest to 7 | **0.594** |
| closest to 7 | against lowest as shield | 0.528 |

**Always take your highest card as your shield** — by a two-to-one margin.
A choice with a known right answer is a rule that costs a sentence and buys
nothing, and it is *actively harmful* at a full table: with everyone shielded
behind their best card, "deal decides it" at four players jumps from 0.348 to
0.510 and the banking share rises to 0.804. It makes both problems worse.

Rejected as written. The idea might survive in a form where the choice is
genuinely two-sided — choosing between only two of the four, or the shield
being fixed and the *health* cards chosen — but not this one.

## 6. What this could not test

Every proposal here leaves the five actions alone, because the trained
opponent's output layer has exactly five and the browser port is pinned to it
by golden fixtures. Rules that would add a sixth action are out of scope for
this pass and want their own:

- **Strafe** — spend a turn destroying exactly one of a target's charges, no
  draw, no damage, no chance of failure. The most direct possible answer to
  the passive-table failure mode: it makes disarming reliable rather than a
  gamble on a drawn card.
- **Brace** — spend a turn to double your shield against the next attack only.
  Gives the player who is being ground down something to do that is not
  swapping.

## Caveats

All measurements use the **reference heuristic**, not the trained ace, because
the ace was fitted against the standard rules and would be playing a game it
was never shown. This matters most for the deal-choice result: the heuristic
repairs any shield of 5 or below, which may undervalue the low-shield,
high-health build.

A rule that survives here is a rule worth *training* against, not a rule that
is right. The next step for salvage and charge-draws-2 is a self-play run
under each, and then a human at the table — which is the one measurement none
of this can substitute for.
