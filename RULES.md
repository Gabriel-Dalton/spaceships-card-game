# Spaceships — Rules (working draft)

A ship-combat card game played with a standard deck. Each player is a ship with
**health**, a **shield**, and the ability to **charge** weapons before firing.

Status: fourth pass. Sections marked **[inferred]** are my reading of a point
that hasn't been ruled on yet; **Open questions** at the bottom lists what still
needs deciding.

---

## Components

- One standard 52-card deck, no jokers. Card value = pip value, **Ace = 1**
  through King = 13, so there are exactly **four of every value**. Suits are
  ignored entirely — they carry no meaning in any rule.
- Card *orientation* on the table is meaningful and is how you tell the two
  zones apart at a glance:
  - **Vertical (portrait)** = health
  - **Horizontal (landscape)** = shield

## Setup

Each player is dealt:

- **3 health cards**, laid out vertically, face up.
- **1 shield card**, laid horizontally, face up.

You will also need **pen and paper**.

### Health is a running total

The three health cards set your **starting health total** — add them up, and
write the number down. **[inferred]** From then on health lives on the paper,
not on the table: damage is subtracted from your running total, and you are out
when it reaches **0**.

The cards stay face up as a record of where you started, but they are never
individually destroyed. Three average cards means a starting total of around
**21**.

### Reading your shield

Values run 1–13, so the average card is **7**. A shield **below 7 is a
below-average shield**.

This matters more than it first looks, because **the shield is permanent**. It is
not consumed, damaged, or destroyed by being attacked — it is a standing
threshold that every incoming attack has to clear, on every attack, for the whole
game. A shield only ever changes when someone deliberately **swaps** it.

So a 3 is a wound you carry until you spend a turn fixing it, and a King is a
fortress that most attacks simply cannot get through.

## Who goes first

**The player with the lowest starting health total takes the first turn.** Ties
are broken by the lowest shield; if that ties too, deal a card each and low card
starts.

Going first is a real advantage in this game (see the design notes), so the first
turn goes to whoever the deal treated worst — and the worst thing the deal can do
to you is a low health total, because that is the one thing you can never repair.

Play then proceeds clockwise.

---

## Turn structure

On your turn you take **exactly one** of three actions:

### 1. Attack

There are two kinds of attack, and you must **say which one you are making
before you draw**:

- **Attack.** Draw one card. That card's value is your attack value. Your
  charges take no part in it and are not touched.
- **Charge attack.** Say **"charge attack"** out loud first. Draw one card, then
  turn over **all** of your charges and add them in.

```
attack value        = drawn card
charge attack value = drawn card + every charged card you hold
```

**Charges are all or nothing.** You cannot spend three of your five, or hold one
back. A charge attack commits the entire stockpile; a plain attack commits none
of it. If you are not spending your charges, your attack is just the single card
you drew — that one draw is the whole of it.

Because the declaration comes before the draw, and because you may not look at
your own charges (see *Charge* below), the call is made blind. You are betting on
a count, not adding up a number. Declaring after seeing your draw would hand the
decision back the certainty the face-down rule took away — you would keep the bank
every time the draw happened to be enough on its own, which is over half the time
against an average shield.

Choose an opponent. The attack resolves against **their shield value**.

#### Resolving the attack

**The shield blocks damage equal to its printed value, and the rest comes off the
defender's health total.**

```
damage to health = attack value - shield value
```

A 10 against a 6 shield deals 4: the shield soaks 6, the remaining 4 is
subtracted from the defender's running total on the paper. The shield's value is
*absorbed*, not removed from play — it will block that same amount again on the
very next attack.

| Comparison | Result |
| --- | --- |
| `attack < shield` | **Blocked.** No damage. A plain attack costs you nothing; a declared charge attack **still spends its charges**. |
| `attack >= shield` | **Breakthrough.** The excess comes off their health, their charges are eliminated, and any charges you declared are spent. |

Note that **equal counts as breaking through**. An attack of exactly 7 against a
shield of 7 deals no damage at all, but it still wipes the defender's charges — a
pure disarm, and occasionally worth doing on purpose against someone sitting on a
big stockpile.

**Saying "charge attack" is binding.** Once the words are out you draw, you flip
the whole bank, and the bank is gone whatever happens — through the shield or
bounced off it. You cannot take the call back on seeing the draw, and a block is
not a refund. A plain attack, by contrast, risks nothing at all: blocked or not,
your charges are exactly where they were.

That is what stops a charge attack from being a free look at your own stockpile.
If a blocked bank came back to the table you would have flipped it face up for one
turn's rent, and from then on you — and everyone else — would know exactly what it
was worth, which is the one thing the game is built to keep from you.

#### On a breakthrough

1. **Damage** (`attack - shield`) is subtracted from the defender's health total
   on the paper.
2. **All of the defender's charged cards are eliminated.** Whatever offence they
   had banked up is gone. This happens on any breakthrough, whether or not the
   attacker declared a charge attack.
3. **The attacker's charges are spent** — *only if this was a declared charge
   attack*, in which case all of them go, returning the bank to zero. After a
   plain attack the attacker's stockpile is untouched: charges you did not
   declare are never spent.
4. **The defender's shield is untouched.** It stays exactly as it was, at the
   same value, ready to block the same amount again next time.

That third point is worth reading twice, because it makes the plain attack a real
tool rather than a weak version of the charge attack. Sitting on six charges, you
can still throw a single card at a low-shield opponent to wipe *their* bank and
keep your own intact.

### 2. Swap a shield

Swap out a shield for a new card from the deck. You may swap:

- **your own shield** — the standard use, when your shield is below average, or
- **another player's shield** — you can swap someone else's shield.

This is the *only* way a shield ever changes. Swapping an opponent's shield is a
gamble in both directions: you might replace a King with a 2, or hand them a
better shield than the one they had.

### 3. Charge

Draw a card from the deck and place it **face down** in front of you as a
charge — **without looking at it.**

**Nobody may look at charges, and that includes you.** A charge goes from the
deck to the table unseen and stays there until a declared charge attack turns it
over. What the table knows about your stockpile and what *you* know about it are
exactly the same thing: **how many charges you have, never what they are worth.**

Charges accumulate with **no cap** — you may bank as many as you have patience
for, and a long enough build produces an attack that nothing on the table can
survive. They are the only way to build an attack big enough to clear a high
shield — a single drawn card can never beat a King, so a fortress
shield has to be either charged through or swapped away. The cost is a turn spent
doing nothing, and the risk is that anyone who breaks through your shield first
wipes the whole stockpile.

---

## Design notes

The permanent shield is what gives the game its shape. Because a shield is a
standing threshold rather than a consumable, the spread between a 2 and a King is
enormous and lasts all game, which turns the swap action into the real
battlefield:

- Someone sitting behind a King is close to untouchable. You don't out-damage
  that — you spend a turn swapping their shield and hope the deck hands them
  something worse.
- Conversely, swapping is the only repair available, so a player unlucky enough
  to draw a low shield twice is in serious trouble.

### The maths makes charging mandatory

Run the average numbers and the game's engine falls out. An average draw is 7 and
an average shield is 7, so **a plain uncharged attack deals about zero damage**.
Attacking off the top of the deck is close to worthless against a healthy
opponent.

Charging is what makes damage exist at all. Bank two charges (≈14) and attack
(≈7) for 21, against a 7 shield, and you deal ~14 — most of a player's ~21
starting health, off a three-turn cycle. Two of those cycles kills someone, so a
duel runs somewhere around a dozen turns, and every point of shield the defender
carries is a point taken off *every* incoming hit for the rest of the game.

Blind charging doesn't change that arithmetic, because an unseen card is still
worth 7 on average and the expected value of a stockpile is still 7 per card.
What it changes is that you can never wait for a *good* bank, only a *big* one.
Charge counts, not card values, are the entire language of the game.

### The deck is a turn budget, and it decides the player count

Every action in the game draws exactly one card — attack, swap and charge alike.
Setup takes four cards a player. So the number of turns a game can contain is
fixed before anyone acts:

```
turns available = 52 - 4 x players
```

| players | setup | turns in the deck | turns each | median game | ran the deck dry |
| --- | --- | --- | --- | --- | --- |
| 2 | 8 | 44 | 22 | 13 | **0.0%** |
| 3 | 12 | 40 | 13 | 22 | 1.5% |
| 4 | 16 | 36 | 9 | 31 | 28.4% |
| 5 | 20 | 32 | 6 | 33 | 83.1% |
| 6 | 24 | 28 | 4 | 29 | 99.7% |

*(20,000 simulated games each, sensible heuristic play)*

**A duel never runs out.** Not once in 20,000 games — a two-player game uses a
median of 13 turns against a budget of 44, and even the long tail stays well
inside it. Deck exhaustion is a rule a duel will essentially never invoke.

Above three players it stops being a corner case and becomes the way most games
end. At five and six, the deck is the primary win condition, which is not a game
so much as a countdown. **The physical deck therefore caps this at two or three
players**, four with a reshuffle rule and the understanding that the shuffle will
be reached routinely.

### Why the binding declaration costs almost nothing

Making the call binding sounds harsh, and the arithmetic says it is nearly free.
A charge attack only gets blocked when the bank is small, because a bank of any
size clears any shield almost every time:

| charges | vs shield 7 | vs shield 10 | vs shield 13 |
| --- | --- | --- | --- |
| 1 | 8.9% | 21.3% | 39.1% |
| 2 | 0.9% | 3.8% | 10.0% |
| 3 | 0.05% | 0.4% | 1.7% |
| 4 | ~0% | 0.03% | 0.2% |

*(chance a declared charge attack is blocked)*

Multiply that by what you forfeit and the expected cost of the binding rule is
under a third of a point once you hold three charges, even against a King. It only
really bites on a one-charge attack into a big shield — which is precisely the
impatient play the rule is there to discourage. So it closes the free-audit hole
completely while costing correct play essentially nothing, which is the best trade
a rule can make.

### Disarming is the only thing holding the game together

The most important number here is one that doesn't converge. Damage per turn for a
"bank *n*, then fire" cycle keeps climbing with every charge you add:

| bank size | 0 | 1 | 2 | 3 | 4 | 6 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dmg/turn vs shield 7 | 1.6 | 3.6 | 4.7 | 5.3 | 5.6 | 6.0 | 6.2 |

It rises towards 7 and never turns over, because a cycle of *n*+1 turns banks
7(*n*+1) of expected attack and pays the shield's toll only once. **In a vacuum,
the correct strategy is to bank forever.** Nothing internal to the charging rules
ever makes you fire.

What makes you fire is other players. Put a per-turn chance *h* of being broken
through and wiped into the same sum and an optimum appears immediately:

| disarm chance *h* | best bank vs shield 7 | vs shield 13 |
| --- | --- | --- |
| 10% | 3 | 4 |
| 20% | 2 | 3 |
| 35% | 1 | 2 |

So the game's whole rhythm — two to four turn cycles, fire before you're robbed —
is produced by the threat of disarm and by nothing else. Two consequences worth
keeping in view. First, the uncapped stockpile is only safe because disarming is
cheap; those two rules have to live or die together, and the free plain-attack
disarm is what keeps *h* high enough to matter. Second, the game needs players who
actually take the disarm shot. At a passive table, or one where everyone is busy
attacking someone else, *h* collapses and the correct play for everybody is to sit
there banking until the deck runs out. That is the failure mode to watch for in
playtesting, and the first thing to check as the player count grows.

### Why going first matters, and why the low health gets it

The charge-elimination rule creates a sharp first-mover advantage. Picture two
players both banking charges: both charge, both charge again, and then whoever
attacks *first* deals full damage **and** wipes the other's stockpile. The loser
of that race spent two turns on nothing. Initiative then flips — the player who
just fired is empty and the other rebuilds — so the game settles into alternating
strike cycles, but the player who struck first in the opening cycle strikes first
in every cycle after it, and lands the killing blow first.

That advantage is worth compensating for, and the principle is: **compensate the
handicap the player cannot fix.**

A bad shield is fixable. Swapping is a blind draw, so it has a positive expected
return whenever your shield is below 7 and a negative one above it — which gives
the game a natural equilibrium where players swap up until they're
above average, then stop. A 3 shield costs you a turn or two and a bit of bad
luck absorbed in the meantime, and then it's simply gone as a problem. The player
has a lever, and they can pull it whenever they like.

A bad health total is forever. There is no healing anywhere in this game: your
three dealt cards are the entire budget you will ever have. Deal one player 3+4+5
and another 11+12+13, and that 27-point gap persists to the end of the game no
matter how well the short-changed player plays. No action on their turn touches
it.

That asymmetry decides it. Handing the first turn to a low-shield player is
mostly letting them fix a fixable problem one turn sooner — the compensation gets
absorbed by the repair rather than offsetting anything permanent. The low-health
player, by contrast, has nothing to repair, so they spend the opening turn
charging and genuinely take the initiative in the first strike cycle. The
compensation arrives undiluted, and it goes to the only deficit that lasts.

(It's tempting to argue the other way from raw numbers — a point of shield is
subtracted from every incoming attack, so it looks several times more valuable
than a point of health. That reasoning only holds if the shield *stays* where the
deal put it, and it doesn't. Transient handicaps don't need compensating;
permanent ones do.)

Health is the better tiebreaker mechanically, too: totals span 3 to 39, so exact
ties are rare, where two players sharing a shield value is common.

### Nobody knows what a stockpile is worth — the owner least of all

Charges being face down to *everyone* splits the information cleanly and evenly:
the **count is public** (the cards are sitting there) while the **total is known
to no one**. That gap is the whole tension of the charging game, and it cuts both
ways across the table.

Three charges average 21 but range from 6 to 39. An opponent looking at your
three face-down cards knows you are probably dangerous without knowing whether
you are lethal, and has to decide whether to spend a whole turn disarming you on
that hunch. Sometimes they burn a turn wiping 6 points of nothing. Sometimes they
don't act and eat 39. The point of the no-peeking rule is that **you are looking
at the same three cards with the same ignorance.** When you say "charge attack"
you are guessing about your own ship.

Turning charges face up to the table would collapse that into arithmetic — the
table could price your threat exactly and disarm you on precisely the turn you
became a problem, never a turn early or late. But letting the *owner* look, with
the table kept in the dark, is nearly as bad in the other direction. That version
hands the charging player perfect information about when to fire: you peek, see
that you're holding 31, and strike the moment the bank goes lethal, while
everyone else is still estimating. The charging player would never mistime a
strike, and the defender's disarm decision would be a guess against someone who
wasn't guessing.

Blind charges take that certainty away from everyone at once. Declaring a charge
attack is a bet that the count is enough, made against the same odds the table is
reading off the same cards. It also means the game has no informed bluffing: you
cannot represent a stockpile you know to be junk, because you don't know it's
junk. A pile of six face-down cards is an honest threat by construction, and the
only thing anyone — including its owner — can say about it is that it's probably
around 42.

**All or nothing** is what keeps the count meaningful. If you could spend three of
your five, charges would be a currency you meter out, and every attack would be
tuned to the exact shield in front of it. Committing the whole bank makes charging
one escalating bet: each card you add raises the payoff and raises what you lose
if someone breaks through you first, and the decision is only ever *now or one
more turn*.

Against that, the three actions form a tempo triangle:

- **Charge** trades a turn for power, and is the only route through a big shield.
- **Swap** trades a turn for defence — or spends it wrecking someone else's.
- **Attack** cashes in, for one card or for everything.

The breakthrough rule ("break through, lose your charges") is what stops charging
from being a free ride. Everyone can see how many face-down cards you are sitting
on even if nobody can see the values, so a big stockpile paints a target on you.

The declaration is what makes that target easy to shoot at. Because a plain attack
never spends your own charges, a player holding a large bank can still take cheap
shots — one card at a weak shield, purely to wipe someone else's stockpile — while
their own build continues uninterrupted. Disarming is no longer something you pay
for out of your own offence, so the correct response to a rival counting up to six
charges is usually to fire a single card at them and keep banking. Over-banking is
punished by the table, and now the table can punish it for free.

A speculative *plain* attack is cheap in the other direction too: blocked, it
costs nothing but the turn. A speculative charge attack is not cheap at all, and
that asymmetry is deliberate — probing is what the single card is for, and cashing
in is what the bank is for.

---

## Open questions

1. **Starting health total.** Assumed to be the sum of your three dealt health
   cards (≈21). Confirm — the alternative is a flat starting number for everyone,
   with the cards being purely decorative.
2. **Win condition.** Player is out at 0 health, last ship flying wins?
   **[inferred as yes]**
3. **Swap commitment.** When you swap a shield, is the replacement drawn blind
   from the deck and forced (you're stuck with whatever comes up), or can you
   look first? Blind is assumed above.
4. **Deck exhaustion.** Reshuffle the discards, or does the game end? Recommend
   reshuffle. A duel reached it in 0 of 20,000 simulated games, so at two players
   the rule costs nothing and never fires; it only starts mattering at four.
5. **Player count.** Written as multiplayer, which the swap-someone-else's-shield
   rule implies. The deck answers this on its own — see *The deck is a turn
   budget*. Two or three players fits comfortably, four needs the reshuffle, and
   five or six turns the deck into a countdown timer. Recommend **2–3, duel
   preferred**, which is also where the first-turn compensation maths holds.

### Settled since the last pass

- **Blocked charge attacks burn the bank**, so a charge attack can never be used
  as a cheap audit of your own stockpile. Costs correct play under 0.3 points of
  expected damage from three charges up.
- **Declaration happens before the draw**, so the fire-or-hold decision is read
  off the table rather than off a card you just flipped.

### Still needed before a solver can be written

Only **swap commitment (3)** now changes the model rather than the play. Blind-and-
forced is assumed throughout; look-first would make swapping a far stronger action
and move the shield equilibrium, so the solver needs that one settled first.

Everything else is precise enough to compute on. Two properties of the finished
rules make an exact engine realistic, and both come from the face-down charge
rule:

- **There is no private information.** Nobody, the owner included, knows what a
  charge is worth, so every player sees an identical game state: healths, shields,
  charge counts, and the discards. That makes this a perfect-information
  stochastic game, solvable by backward induction into a single best move per
  position — not an imperfect-information game needing an equilibrium solver and
  mixed strategies. Letting owners peek at their own charges would have cost this
  outright.
- **Unknown cards stay exchangeable.** Face-down charges are never observed, so
  they remain statistically identical to cards still in the deck. The unseen pool
  is just *deck + all face-down charges*, every draw is uniform from it, and its
  composition is common knowledge. A duel ends with a median of 31 of 52 cards
  still unidentified, so counting stays weak and the uniform 1–13 model is a sound
  evaluation function throughout — typical error under 2% early, around 5% late.
