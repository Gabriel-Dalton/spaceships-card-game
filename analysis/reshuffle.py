"""What the reshuffle rule does to Spaceships.

Reshuffling the discards when the deck runs out removes the deck as a way for the
game to end. Two things worth knowing before adopting it:

  1. Does it rescue the larger player counts, which previously just ran out of
     cards?
  2. Can the table run out of cards *anyway*? Health cards and live shields never
     return to the deck, and face-down charges do not either -- so every charge
     banked is a card taken out of circulation. If enough cards end up sitting
     face down, the deck and the discard can both be empty at once, and since all
     three actions require a draw, nobody can legally do anything.
"""

import random

RANKS = list(range(1, 14))
DECK = RANKS * 4


class Deadlock(Exception):
    """Deck and discard both empty: no legal action exists."""


class Table:
    def __init__(self, n_players, rng):
        self.rng = rng
        self.deck = DECK[:]
        rng.shuffle(self.deck)
        self.discard = []
        self.reshuffles = 0
        self.health, self.shield, self.charges = [], [], []
        for _ in range(n_players):
            self.health.append(sum(self.draw() for _ in range(3)))
            self.shield.append(self.draw())
            self.charges.append([])

    def draw(self):
        if not self.deck:
            if not self.discard:
                raise Deadlock()
            self.deck = self.discard
            self.discard = []
            self.rng.shuffle(self.deck)
            self.reshuffles += 1
        return self.deck.pop()


def play(n_players, rng, policy, max_turns=2000):
    """Returns (turns, reshuffles, outcome) with outcome in {win, deadlock, cap}."""
    t = Table(n_players, rng)
    alive = list(range(n_players))
    first = min(alive, key=lambda i: (t.health[i], t.shield[i]))
    order = alive[first:] + alive[:first]
    turns, ptr = 0, 0

    try:
        while len([i for i in alive if t.health[i] > 0]) > 1 and turns < max_turns:
            me = order[ptr % n_players]
            ptr += 1
            if t.health[me] <= 0:
                continue
            live = [i for i in alive if t.health[i] > 0 and i != me]
            if not live:
                break
            turns += 1
            policy(t, me, live)
    except Deadlock:
        return turns, t.reshuffles, "deadlock"
    return turns, t.reshuffles, ("cap" if turns >= max_turns else "win")


def heuristic(t, me, live):
    """Same public-information policy as deck_budget.py."""
    target = min(live, key=lambda i: (t.shield[i], -len(t.charges[i])))
    n = len(t.charges[me])

    if t.shield[me] <= 5:
        t.discard.append(t.shield[me])
        t.shield[me] = t.draw()
        return
    if len(t.charges[target]) >= 3 and t.shield[target] <= 7:
        declared = []
    elif n >= 3:
        declared = list(t.charges[me])
    elif n >= 1 and 7 * (n + 1) >= t.health[target] + t.shield[target]:
        declared = list(t.charges[me])
    else:
        t.charges[me].append(t.draw())
        return

    card = t.draw()
    attack = card + sum(declared)
    t.discard.append(card)
    if attack >= t.shield[target]:
        t.health[target] -= attack - t.shield[target]
        t.discard.extend(t.charges[target])   # eliminated charges
        t.charges[target] = []
    if declared:
        t.discard.extend(declared)            # binding: spent either way
        t.charges[me] = []


def always_charge(t, me, live):
    """The pathological case the design notes warn about: everybody banks."""
    t.charges[me].append(t.draw())


def always_charge_with_backstop(t, me, live):
    """Same, but with the proposed fix: if you cannot draw, you must fire your
    whole bank with no drawn card. If you have no bank, you pass."""
    if t.deck or t.discard:
        t.charges[me].append(t.draw())
        return
    if not t.charges[me]:
        return                                  # pass
    target = min(live, key=lambda i: t.shield[i])
    declared = list(t.charges[me])
    attack = sum(declared)                      # no drawn card available
    if attack >= t.shield[target]:
        t.health[target] -= attack - t.shield[target]
        t.discard.extend(t.charges[target])
        t.charges[target] = []
    t.discard.extend(declared)
    t.charges[me] = []


rng = random.Random(20260816)
GAMES = 20000

print("=" * 78)
print("1. WITH RESHUFFLE, DOES THE LARGER TABLE BECOME PLAYABLE?")
print("   (heuristic play, 20,000 games each)")
print("=" * 78)
print("    players   median turns   90th pct   reshuffles   deadlocked")
for p in range(2, 7):
    lengths, resh, dead = [], [], 0
    for _ in range(GAMES):
        turns, r, outcome = play(p, rng, heuristic)
        lengths.append(turns)
        resh.append(r)
        dead += outcome == "deadlock"
    lengths.sort()
    print(
        f"    {p:>7}   {lengths[len(lengths)//2]:>12}   "
        f"{lengths[int(len(lengths)*0.9)]:>8}   "
        f"{sum(resh)/len(resh):>10.2f}   {dead/GAMES:>10.2%}"
    )

print()
print("=" * 78)
print("2. THE DEADLOCK IS REAL IF NOBODY FIRES")
print("   Every player charges every turn. Cards go deck -> face down and never")
print("   come back, so the discard stays empty and the deck drains to nothing.")
print("=" * 78)
print("    players   circulating cards   turns until nobody can act")
for p in range(2, 7):
    turns, _r, outcome = play(p, rng, always_charge)
    print(f"    {p:>7}   {52 - 4*p:>17}   {turns:>26}  ({outcome})")
print()
print("    Only health cards and live shields are permanently out of the deck,")
print("    so the circulating pool is 52 - 4*players. Every banked charge locks")
print("    one more card away, and all three actions need a draw.")

print()
print("=" * 78)
print("3. THE BACKSTOP FIXES IT")
print("   Rule: if you cannot draw, you must fire your whole bank with no drawn")
print("   card; with no bank you pass. Same everybody-charges-forever table:")
print("=" * 78)
print("    players   outcome   turns   reshuffles")
for p in range(2, 7):
    turns, r, outcome = play(p, rng, always_charge_with_backstop)
    print(f"    {p:>7}   {outcome:>7}   {turns:>5}   {r:>10}")
print()
print("    The standoff breaks itself: forced fire pushes banks into the")
print("    discard, the discard reshuffles, and the game resumes and finishes.")
