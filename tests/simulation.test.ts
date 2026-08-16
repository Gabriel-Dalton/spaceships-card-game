/**
 * Does the port still play the same *game*?
 *
 * `parity.test.ts` pins single positions. This file pins the shape of whole
 * games against the numbers published in RULES.md and ml/README.md, which were
 * produced twice already -- once by the plain-Python simulations in
 * `analysis/`, once by the batched engine. A rules bug that no single position
 * catches -- a reshuffle that fires too early, a turn that gets skipped -- moves
 * the median game length, and this is where it shows up.
 *
 * And the point of the whole exercise: the trained ace has to still beat the
 * officer here by roughly the margin it beats it by in training.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { applyAction, livingSeats, makeRng, type Game } from "../src/game/rules.ts";
import { decide, type EngineId } from "../src/game/policies.ts";
import { dealt } from "./helpers.ts";

function playOut(g: Game, seat: EngineId[], rng: ReturnType<typeof makeRng>) {
  let guard = 0;
  while (!g.over && guard++ < 4000) {
    const d = decide(g, seat[g.current], rng);
    g = applyAction(g, d.action, d.target).game;
  }
  return g;
}

const median = (xs: number[]) =>
  xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/** Published: heuristic play, 20,000 games at each player count. */
const PUBLISHED = [
  { seats: 2, turns: 13, reshuffles: 0.0 },
  { seats: 3, turns: 22, reshuffles: 0.02 },
  { seats: 4, turns: 31, reshuffles: 0.28 },
  { seats: 5, turns: 42, reshuffles: 0.9 },
  { seats: 6, turns: 53, reshuffles: 1.5 },
];

const GAMES = 1500;

for (const row of PUBLISHED) {
  test(`${row.seats}-player games run the published length`, () => {
    const rng = makeRng(row.seats * 977);
    const seat: EngineId[] = new Array(row.seats).fill("officer");
    const turns: number[] = [];
    let reshuffles = 0;
    for (let i = 0; i < GAMES; i++) {
      const g = playOut(dealt(row.seats, i * 31 + row.seats), seat, rng);
      turns.push(g.turns);
      reshuffles += g.reshuffles;
      assert.equal(livingSeats(g).length, 1);
    }
    const got = median(turns);
    assert.ok(
      Math.abs(got - row.turns) <= 2,
      `median ${got} turns, published ${row.turns}`,
    );
    const perGame = reshuffles / GAMES;
    assert.ok(
      Math.abs(perGame - row.reshuffles) <= 0.35,
      `${perGame.toFixed(2)} reshuffles per game, published ${row.reshuffles}`,
    );
  });
}

test("the ace still beats the officer, seats alternated", () => {
  // ml/README.md reports 81% over 4,000 games. A smaller sample here, so the
  // bar is set where a genuinely broken port fails and noise does not.
  const rng = makeRng(5150);
  let wins = 0;
  const n = 1200;
  for (let i = 0; i < n; i++) {
    const aceSeat = i % 2;
    const seat: EngineId[] = aceSeat === 0 ? ["ace", "officer"] : ["officer", "ace"];
    const g = playOut(dealt(2, 70000 + i), seat, rng);
    if (livingSeats(g)[0] === aceSeat) wins += 1;
  }
  const rate = wins / n;
  assert.ok(rate > 0.7, `ace wins ${(rate * 100).toFixed(1)}% of duels`);
});

test("every engine beats the cadet", () => {
  const rng = makeRng(31337);
  for (const engine of ["gunner", "officer", "ace"] as EngineId[]) {
    let wins = 0;
    const n = 600;
    for (let i = 0; i < n; i++) {
      const seat: EngineId[] = i % 2 === 0 ? [engine, "cadet"] : ["cadet", engine];
      const g = playOut(dealt(2, 40000 + i), seat, rng);
      if (livingSeats(g)[0] === i % 2) wins += 1;
    }
    assert.ok(wins / n > 0.55, `${engine} wins ${wins}/${n} against the cadet`);
  }
});
