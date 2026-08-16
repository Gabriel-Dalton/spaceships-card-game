"""One against two: the position from the photo.

You are on a 7 shield. The next two players are on 8 each, and they are allied
against you. What is the best move?

The thing that decides it is not damage, it is how long a bank survives. A plain
attack costs an opponent nothing and wipes your whole stockpile, so the number of
enemies willing to spend a turn suppressing you sets the value of charging at all.
"""

CARDS = range(1, 14)
SINGLE = {v: 1 / 13 for v in CARDS}


def conv(a, b):
    out = {}
    for x, px in a.items():
        for y, py in b.items():
            out[x + y] = out.get(x + y, 0.0) + px * py
    return out


DIST = {0: {0: 1.0}}
for k in range(1, 12):
    DIST[k] = conv(DIST[k - 1], SINGLE)


def p_break(shield):
    """One drawn card clears a shield."""
    return sum(p for v, p in SINGLE.items() if v >= shield)


def e_dmg_plain(shield):
    return sum(p * max(0, v - shield) for v, p in SINGLE.items())


def e_dmg_bank(n, shield):
    return sum(p * max(0, x - shield) for x, p in DIST[n + 1].items())


MY_SHIELD, THEIR_SHIELD = 7, 8

print("=" * 78)
print("1. THE BASIC RATES")
print("=" * 78)
print(f"    a single card clears their 8 ....... {p_break(THEIR_SHIELD):.1%}")
print(f"    a single card clears your 7 ........ {p_break(MY_SHIELD):.1%}")
print(f"    plain attack damage into an 8 ...... {e_dmg_plain(THEIR_SHIELD):.2f}")
print(f"    plain attack damage into your 7 .... {e_dmg_plain(MY_SHIELD):.2f}")

survive_one = 1 - p_break(MY_SHIELD)
survive_both = survive_one ** 2
print()
print(f"    your bank survives a round if nobody breaks your 7:")
print(f"      one of them suppresses you ....... {survive_one:.1%}")
print(f"      both of them suppress you ........ {survive_both:.1%}")

print()
print("=" * 78)
print("2. IS CHARGING WORTH IT?")
print("   'Bank n, then fire at an 8', but each of your turns the bank has to")
print("   survive the alliance. Rate = E[dmg] * survival^n / (n+1).")
print("=" * 78)
for label, s in (("nobody suppresses you", 1.0),
                 ("one suppresses you", survive_one),
                 ("both suppress you", survive_both)):
    best, rates = None, []
    for n in range(0, 7):
        r = e_dmg_bank(n, THEIR_SHIELD) * (s ** n) / (n + 1)
        rates.append(r)
        if best is None or r > rates[best]:
            best = n
    print(f"\n  {label} (bank survives {s:.1%} per round):")
    print("    bank n:   " + "".join(f"{n:>8}" for n in range(0, 7)))
    print("    dmg/turn: " + "".join(f"{r:>8.2f}" for r in rates))
    print(f"    -> best bank size {best}"
          + ("  (n=0 is the plain attack: never charge)" if best == 0 else ""))

print()
print("=" * 78)
print("3. THE SHIELD SWAPS")
print("=" * 78)
print("    Swapping your own 7 is a blind draw averaging 7, and the chance of")
print("    being disarmed, (14-s)/13, is linear in the shield -- so variance")
print("    buys nothing on average either:")
exp_break_after = sum(p * p_break(v) for v, p in SINGLE.items())
print(f"      P(disarmed) now, on a 7 .......... {p_break(MY_SHIELD):.1%}")
print(f"      P(disarmed) after a blind swap ... {exp_break_after:.1%}")
print(f"      expected shield after swap ....... {sum(v*p for v,p in SINGLE.items()):.1f}")
print()
print("    Swapping one of their 8s costs a whole turn to move a shield from")
print(f"    8 to an expected 7 -- one point, on one of two enemies.")

print()
print("=" * 78)
print("4. WHY VARIANCE IS YOUR FRIEND HERE")
print("   Their two turns to your one. Even playing perfectly you trade at")
print("   roughly half their rate, so the steady line loses slowly and surely.")
print("=" * 78)
mine = e_dmg_plain(THEIR_SHIELD)
theirs = e_dmg_plain(MY_SHIELD) * 2
print(f"    your damage per round, plain attacks ......... {mine:.2f}")
print(f"    their damage per round, if both attack you ... {theirs:.2f}")
print(f"    ratio ....................................... {theirs/mine:.1f} to 1")
print()
for n in (2, 3, 4):
    reach = sum(p for x, p in DIST[n + 1].items() if x >= THEIR_SHIELD + 20)
    print(f"    a surviving {n}-charge attack deals 20+ damage {reach:>6.1%} of the time")
