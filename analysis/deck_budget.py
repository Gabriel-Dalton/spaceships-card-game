"""Does a standard 52-card deck actually last a game of Spaceships?

Every action in the game draws exactly one card -- attack, swap and charge alike
-- so the deck is a hard turn budget, and the budget is knowable before anyone
sits down.

Run alongside charge_math.py, which does the charge-attack probabilities under an
infinite-deck (with replacement) model. This file checks how badly that model
lies for a real deck, and whether the deck runs dry mid-game.
"""

import random

RANKS = list(range(1, 14))  # Ace = 1 .. King = 13
DECK = RANKS * 4  # 52 cards, four of each rank
SETUP_CARDS_PER_PLAYER = 4  # 3 health + 1 shield


print("=" * 78)
print("1. THE TURN BUDGET IS FIXED BY THE DECK")
print("   Every action draws exactly one card, so:")
print("     turns available = 52 - 4*players")
print("=" * 78)
print("    players   setup   turns in deck   turns each")
for p in range(2, 7):
    setup = SETUP_CARDS_PER_PLAYER * p
    turns = 52 - setup
    print(f"    {p:>7}   {setup:>5}   {turns:>13}   {turns // p:>10}")


# ---------------------------------------------------------------- simulation

def sim_game(n_players, rng, max_turns=500):
    """One game under a plausible heuristic policy.

    Returns (turns, ran_dry, live_charges) where live_charges is the number of
    cards still sitting face down and unseen when the game ended.
    """
    deck = DECK[:]
    rng.shuffle(deck)
    drawn = 0

    def draw():
        nonlocal drawn
        drawn += 1
        return deck.pop() if deck else None

    health, shield, charges = [], [], []
    for _ in range(n_players):
        health.append(sum(draw() for _ in range(3)))
        shield.append(draw())
        charges.append([])

    alive = list(range(n_players))
    # lowest health total goes first
    first = min(alive, key=lambda i: (health[i], shield[i]))
    order = alive[first:] + alive[:first]
    turns = 0   # turns actually taken (= cards drawn from here on)
    ptr = 0     # whose turn it is; skipped dead players do not burn a turn

    while len([i for i in alive if health[i] > 0]) > 1 and turns < max_turns:
        me = order[ptr % n_players]
        ptr += 1
        if health[me] <= 0:
            continue
        live = [i for i in alive if health[i] > 0 and i != me]
        if not live:
            break
        turns += 1

        if not deck:
            return turns, True, sum(len(c) for c in charges)

        # target: prefer the lowest shield, break ties toward the biggest bank
        target = min(live, key=lambda i: (shield[i], -len(charges[i])))
        n = len(charges[me])

        # policy, using only public information (counts, never charge values)
        if shield[me] <= 5:
            shield[me] = draw()                       # repair a bad shield
            continue
        if len(charges[target]) >= 3 and shield[target] <= 7:
            declared = []                             # cheap plain-attack disarm
        elif n >= 3:
            declared = charges[me]
        elif n >= 1 and 7 * (n + 1) >= health[target] + shield[target]:
            declared = charges[me]                    # bank looks lethal
        else:
            c = draw()
            if c is None:
                return turns, True, sum(len(c) for c in charges)
            charges[me].append(c)
            continue

        card = draw()
        if card is None:
            return turns, True, sum(len(c) for c in charges)
        attack = card + sum(declared)
        if attack >= shield[target]:
            health[target] -= attack - shield[target]
            charges[target] = []
        charges[me] = [] if declared else charges[me]  # binding: spent either way

    return turns, False, sum(len(c) for c in charges)


rng = random.Random(20260816)
print()
print("=" * 78)
print("2. DOES IT RUN OUT? (20,000 games per player count)")
print("=" * 78)
print("    players   median turns   90th pct   games that ran the deck dry")
for p in range(2, 7):
    lengths, dry = [], 0
    for _ in range(20000):
        t, d, _live = sim_game(p, rng)
        lengths.append(t)
        dry += d
    lengths.sort()
    med = lengths[len(lengths) // 2]
    p90 = lengths[int(len(lengths) * 0.9)]
    print(f"    {p:>7}   {med:>12}   {p90:>8}   {dry / 20000:>25.1%}")


# ------------------------------------------------- how wrong is uniform 1-13?

print()
print("=" * 78)
print("3. HOW WRONG IS THE INFINITE-DECK MODEL?")
print("   Error in P(drawn card >= v) from assuming a uniform 1-13 draw, when")
print("   the true pool is what is left of the 52. Typical = mean |error| over")
print("   all v and all shuffles; worst = the largest single deviation seen.")
print("=" * 78)
print("    unseen pool   typical error   worst seen")
for k in (8, 20, 30, 40):
    errs = []
    for _ in range(4000):
        d = DECK[:]
        rng.shuffle(d)
        rest = d[k:]
        for v in RANKS:
            exact = sum(1 for c in rest if c >= v) / len(rest)
            errs.append(abs(exact - (14 - v) / 13))
    print(
        f"    {52-k:>11}   {sum(errs)/len(errs):>13.1%}   {max(errs):>10.1%}"
    )

print()
print("=" * 78)
print("4. WHAT AN ENGINE CAN ACTUALLY COUNT")
print("   Face-down charges are never seen by anyone, so they stay in the")
print("   unseen pool along with the deck. Only revealed cards can be counted:")
print("   health, shields, attack draws, swapped-out shields, and charges that")
print("   a charge attack turned over. Duel, at the end of the game:")
print("=" * 78)
unseen_end = []
for _ in range(20000):
    t, _d, live = sim_game(2, rng)
    # unseen = what is left in the deck, plus charges still face down
    unseen_end.append((52 - 8 - t) + live)
unseen_end.sort()
med = unseen_end[len(unseen_end) // 2]
p10 = unseen_end[int(len(unseen_end) * 0.1)]
print(f"    unseen pool when a duel ends:  median {med}, 10th pct {p10} (of 52)")
print("    -> even at the finish most of the deck has never been identified,")
print("       so counting stays weak all game and the uniform 1-13 model")
print("       above is a sound evaluation function for a duel.")
