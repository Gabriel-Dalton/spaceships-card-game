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

| Comparison | Result |
| --- | --- |
| `attack < shield` | **Blocked.** Nothing happens. Your charges are *not* spent — they stay banked for next turn. |
| `attack >= shield` | **Breakthrough.** Overflow damage hits their health, their charges are eliminated, and your charges are spent. |

Note that **equal breaks through** — an attack of exactly 7 gets past a shield of
7.

#### On a breakthrough

1. **Overflow damage** is dealt to the defender's health:

   ```
   damage = attack value - shield value
   ```

   The shield's value is subtracted, not removed from play. A 10 against a 6
   shield deals 4.

2. That damage **destroys one of the defender's health cards whose value it meets
   or exceeds**. Damage of 4 can take out a 4, a 3, an Ace — but bounces off a
   9. If the defender has no health card the damage can reach, the attack breaks
   through for nothing. **[inferred]** — see open question 1 on who chooses the
   card and whether leftover damage carries over.

3. **All of the defender's charged cards are eliminated.** Whatever offence they
   had banked up is gone.

4. **The attacker's charges are spent**, returning them to zero.

5. **The defender's shield is untouched.** It stays exactly as it was, at the
   same value, ready to block the next attack.

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

1. **Health damage detail.** Confirmed: overflow damage destroys a health card it
   meets or exceeds. Still open: does the *defender* choose which qualifying card
   dies, or the attacker? And if damage exceeds the card destroyed, does the
   remainder carry to a second card or is it wasted?
2. **Charge cap.** Is there a limit on how many cards you can have charged at
   once?
3. **Win condition.** Player is out when all 3 health cards are gone, last ship
   flying wins? **[inferred as yes]**
4. **Swap commitment.** When you swap a shield, is the replacement drawn blind
   from the deck and forced (you're stuck with whatever comes up), or can you
   look first? Blind is assumed above.
5. **Deck exhaustion.** Reshuffle the discards, or does the game end?
6. **Player count and turn order.** Written as multiplayer, which the
   swap-someone-else's-shield rule implies. Confirm the intended count.
