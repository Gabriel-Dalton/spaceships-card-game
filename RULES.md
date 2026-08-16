# Spaceships — Rules (working draft)

A ship-combat card game played with a standard deck. Each player is a ship with
**health**, a **shield**, and the ability to **charge** weapons before firing.

Status: second pass. Sections marked **[inferred]** are my reading of a point
that hasn't been ruled on yet; **Open questions** at the bottom lists what still
needs deciding.

---

## Components

- One standard deck. Card value = pip value (Ace = 1 … King = 13). **[inferred]**
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

---

## Turn structure

On your turn you take **exactly one** of three actions:

### 1. Attack

Draw a card from the deck. Its value, plus the value of any cards you have
charged, is your **attack value**:

```
attack value = drawn card + sum of your face-down charged cards
```

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
| `attack < shield` | **Blocked.** No damage. Your charges are *not* spent — they stay banked for next turn. |
| `attack >= shield` | **Breakthrough.** The excess comes off their health, their charges are eliminated, and your charges are spent. |

Note that **equal counts as breaking through**. An attack of exactly 7 against a
shield of 7 deals no damage at all, but it still wipes the defender's charges and
still costs you yours — a pure disarm, and occasionally worth doing on purpose
against someone sitting on a big stockpile.

#### On a breakthrough

1. **Damage** (`attack - shield`) is subtracted from the defender's health total
   on the paper.
2. **All of the defender's charged cards are eliminated.** Whatever offence they
   had banked up is gone.
3. **The attacker's charges are spent**, returning them to zero.
4. **The defender's shield is untouched.** It stays exactly as it was, at the
   same value, ready to block the same amount again next time.

### 2. Swap a shield

Swap out a shield for a new card from the deck. You may swap:

- **your own shield** — the standard use, when your shield is below average, or
- **another player's shield** — you can swap someone else's shield.

This is the *only* way a shield ever changes. Swapping an opponent's shield is a
gamble in both directions: you might replace a King with a 2, or hand them a
better shield than the one they had.

### 3. Charge

Draw a card from the deck and keep it **face down** in front of you as a charge.
It is not revealed until it is spent.

Charges accumulate, and they are the only way to build an attack big enough to
clear a high shield — a single drawn card can never beat a King, so a fortress
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

Against that, the three actions form a tempo triangle:

- **Charge** trades a turn for power, and is the only route through a big shield.
- **Swap** trades a turn for defence — or spends it wrecking someone else's.
- **Attack** cashes in.

The breakthrough rule ("break through, lose your charges") is what stops charging
from being a free ride. Everyone can see how many face-down cards you are sitting
on even if they can't see the values, so a big stockpile paints a target on you.
And because a blocked attack *doesn't* cost you your charges, throwing a
speculative attack at a high shield is cheaper than it looks — the punishment for
over-banking comes from other players, not from missing.

---

## Open questions

1. **Starting health total.** Assumed to be the sum of your three dealt health
   cards (≈21). Confirm — the alternative is a flat starting number for everyone,
   with the cards being purely decorative.
2. **Charge cap.** Is there a limit on how many cards you can have charged at
   once? Uncapped, a patient player can bank toward a hit nothing can survive.
3. **Win condition.** Player is out at 0 health, last ship flying wins?
   **[inferred as yes]**
4. **Swap commitment.** When you swap a shield, is the replacement drawn blind
   from the deck and forced (you're stuck with whatever comes up), or can you
   look first? Blind is assumed above.
5. **Deck exhaustion.** Reshuffle the discards, or does the game end?
6. **Player count and turn order.** Written as multiplayer, which the
   swap-someone-else's-shield rule implies. Confirm the intended count.
