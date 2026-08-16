"""Charge-attack math for Spaceships.

Model: cards uniform 1..13 (deck treated as infinite / with replacement — a fine
first-order approximation for a 52-card deck reshuffled).

A charge attack with n charges has attack value = sum of (n+1) cards
(the drawn card plus the whole bank). A plain attack = 1 card.
damage = max(0, attack - shield);  blocked iff attack < shield.
"""

CARDS = range(1, 14)
SINGLE = {v: 1 / 13 for v in CARDS}


def conv(a, b):
    out = {}
    for x, px in a.items():
        for y, py in b.items():
            out[x + y] = out.get(x + y, 0.0) + px * py
    return out


def dist_sum(k):
    """Distribution of the sum of k uniform(1,13) cards."""
    d = {0: 1.0}
    for _ in range(k):
        d = conv(d, SINGLE)
    return d


DIST = {k: dist_sum(k) for k in range(0, 13)}


def e_damage(n, shield):
    """Expected damage of a charge attack holding n charges."""
    return sum(p * max(0, x - shield) for x, p in DIST[n + 1].items())


def p_block(n, shield):
    return sum(p for x, p in DIST[n + 1].items() if x < shield)


def p_break(n, shield):
    return 1.0 - p_block(n, shield)


print("=" * 78)
print("1. DAMAGE PER TURN — 'bank n charges, then fire' (cycle = n+1 turns)")
print("   n=0 is the plain single-card attack.")
print("=" * 78)
for shield in (3, 7, 10, 13):
    print(f"\n  vs shield {shield}:")
    print("    n   cycle  E[dmg]   dmg/turn   P(block)")
    best = None
    for n in range(0, 9):
        ed = e_damage(n, shield)
        rate = ed / (n + 1)
        pb = p_block(n, shield)
        if best is None or rate > best[1]:
            best = (n, rate)
        print(f"    {n}   {n+1:>4}  {ed:6.2f}   {rate:7.3f}    {pb:6.2%}")
    print(f"    -> best bank size n = {best[0]}  ({best[1]:.3f} dmg/turn)")

print()
print("=" * 78)
print("2. DAMAGE PER TURN WITH DISARM RISK")
print("   Each turn you spend banking, an opponent wipes your bank with prob h.")
print("   Rate = E[dmg] * (1-h)^n / (n+1)")
print("=" * 78)
for h in (0.10, 0.20, 0.35):
    print(f"\n  disarm hazard h = {h:.0%}")
    print("    shield:      3      7     10     13")
    row = "    best n:"
    for shield in (3, 7, 10, 13):
        best = max(
            range(0, 9),
            key=lambda n: e_damage(n, shield) * (1 - h) ** n / (n + 1),
        )
        row += f" {best:>6}"
    print(row)

print()
print("=" * 78)
print("3. THE FREE-AUDIT EXPLOIT (only exists if blocked charges are KEPT)")
print("   Declare a charge attack at the biggest shield on the table. If it is")
print("   blocked you keep the bank -- but it has been turned face up, so you")
print("   now know its exact value while everyone else does too.")
print("   P(block) is the chance the probe 'succeeds' at auditing your own bank:")
print("=" * 78)
print("    charges n:      1      2      3      4      5")
for shield in (10, 11, 12, 13):
    row = f"    vs shield {shield}:"
    for n in range(1, 6):
        row += f" {p_block(n, shield):>6.1%}"
    print(row)

print()
print("=" * 78)
print("4. COST OF THE BINDING RULE — what burn-on-block actually costs you")
print("   Expected bank value forfeited = 7n * P(block)")
print("=" * 78)
print("    charges n:      1      2      3      4      5      6")
for shield in (7, 10, 13):
    row = f"    vs shield {shield}:"
    for n in range(1, 7):
        row += f" {7 * n * p_block(n, shield):>6.2f}"
    print(row)
