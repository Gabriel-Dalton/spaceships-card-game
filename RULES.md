# Spaceships — Rules (working draft)

A ship-combat card game played with a standard deck. Each player is a ship with
**health**, a **shield**, and the ability to **charge** weapons before firing.

Status: first pass, transcribed from a spoken rules explanation. Sections marked
**[inferred]** are my reading of an ambiguous point; **Open questions** at the
bottom lists what still needs a ruling before this is playable.

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
below-average shield** — it is likely to be broken by an incoming attack, which
is the main signal telling you to spend a turn swapping it out rather than
attacking.

---

## Turn structure

On your turn you take **exactly one** of three actions:

### 1. Attack

Draw a card from the deck. Its value is your **attack value**, plus the value of
any cards you have previously charged (see below).

```
attack value = drawn card + sum of your face-down charged cards
```

You attack a chosen opponent, and the attack resolves against **their shield**.

**Breaking through.** If your attack breaks through the target's shield:

- their shield is destroyed, and
- **all of their charged cards are eliminated** as well.

So a successful breakthrough doesn't just strip defence — it wipes out whatever
offence they had been banking up. A player sitting on several charges is a
player with a lot to lose.

### 2. Swap a shield

Swap out a shield for a new card from the deck. You may swap:

- **your own shield** — the standard use, when your shield is below average, or
- **another player's shield** — you can swap someone else's shield.

Swapping an opponent's shield is a gamble in both directions: you might replace
a King with a 2, or hand them a better shield than the one they had.

### 3. Charge

Draw a card from the deck and keep it **face down** in front of you as a charge.
It is not revealed until it is spent.

Charges accumulate: the next time you attack, you add your charged card(s) to the
value of the card you draw for the attack. Charging is how you build an attack
big enough to break through a high shield — at the cost of doing nothing that
turn, and at the risk of losing the whole stockpile if someone breaks your shield
first.

---

## Design notes

The three actions form a clean rock-paper-scissors of tempo:

- **Charge** trades tempo for power.
- **Swap** trades tempo for safety — or spends your turn messing with someone
  else's safety.
- **Attack** cashes in.

The breakthrough rule ("break the shield, lose the charges") is the pressure
valve that stops charging from being a free ride: the longer you bank, the more
attractive a target you become, and everyone can see how many face-down cards
you're sitting on even if they can't see their values.

---

## Open questions

These need a ruling before the game is complete:

1. **How does an attack resolve against a shield?** Presumably attack value must
   be greater than (or equal to?) the shield value to break through. What happens
   on a *failed* attack — nothing at all, or is the shield damaged/discarded
   anyway?
2. **How is health actually lost?** Breaking the shield removes the shield and
   the charges — does the target also lose a health card on that same attack, or
   does breaking the shield merely leave them exposed for the *next* attack? Does
   excess damage over the shield value carry through to health?
3. **Do charges survive an attack?** Are charged cards spent when you attack
   (returning you to zero), or do they persist? Is there a cap on how many
   charges you can hold?
4. **Losing and winning.** Is a player out when all 3 health cards are gone? Last
   ship flying wins?
5. **Shield replacement.** After a shield is broken, does the player redraw a
   shield automatically, or must they spend a turn on the swap action to get one?
6. **Deck exhaustion.** Reshuffle the discards, or does the game end?
7. **Player count.** Written above as multiplayer ("choose an opponent"), which
   the swap-someone-else's-shield rule implies. Confirm the intended count.
