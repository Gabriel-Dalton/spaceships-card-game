/** Posing tables by hand, and rebuilding the ones Python photographed. */

import { deal, type Game, type Ship } from "../src/game/rules.ts";

export interface Pose {
  seats?: number;
  health?: number[];
  shield?: number[];
  /** Face-down ranks per seat. */
  banks?: number[][];
  /** The deck, drawn from the end -- so the last entry is the next card. */
  deck?: number[];
  discard?: number[];
  current?: number;
  turns?: number;
  out?: boolean[];
}

/** A table with nothing dealt, ready to be posed. Mirrors test_engine.table(). */
export function table(pose: Pose = {}): Game {
  const seats = pose.seats ?? 2;
  const ships: Ship[] = [];
  for (let i = 0; i < seats; i++) {
    const health = pose.health?.[i] ?? 20;
    ships.push({
      name: `Seat ${i + 1}`,
      human: false,
      healthCards: [7, 7, 6],
      startHealth: 20,
      health,
      shield: pose.shield?.[i] ?? 7,
      bank: (pose.banks?.[i] ?? []).slice(),
      out: pose.out?.[i] ?? false,
      history: [health],
    });
  }
  return {
    seats,
    ships,
    deck: (pose.deck ?? fullDeck()).slice(),
    discard: (pose.discard ?? []).slice(),
    current: pose.current ?? 0,
    turns: pose.turns ?? 0,
    reshuffles: 0,
    over: false,
    seed: 1,
    rngState: 1,
  };
}

export function fullDeck(): number[] {
  const d: number[] = [];
  for (let v = 1; v <= 13; v++) for (let s = 0; s < 4; s++) d.push(v);
  return d;
}

/** Counts by rank -> a list of cards, for rebuilding a Python position. */
export function cardsFromCounts(counts: number[]): number[] {
  const out: number[] = [];
  counts.forEach((n, i) => {
    for (let k = 0; k < n; k++) out.push(i + 1);
  });
  return out;
}

export interface Fixture {
  nPlayers: number;
  health: number[];
  shield: number[];
  alive: boolean[];
  charges: number[][];
  deck: number[];
  discard: number[];
  cur: number;
  turns: number;
  expect: {
    target: number;
    legal: boolean[];
    features: number[];
    mlpScores: number[];
    mlp: number;
    heuristic: number;
    greedy: number;
  };
}

export function gameFromFixture(f: Fixture): Game {
  return table({
    seats: f.nPlayers,
    health: f.health,
    shield: f.shield,
    banks: f.charges.map(cardsFromCounts),
    deck: cardsFromCounts(f.deck),
    discard: cardsFromCounts(f.discard),
    current: f.cur,
    turns: f.turns,
    out: f.alive.map((a) => !a),
  });
}

/** A dealt game with a fixed seed, for the simulation checks. */
export function dealt(seats: number, seed: number): Game {
  return deal({
    seats,
    names: Array.from({ length: seats }, (_, i) => `S${i}`),
    humanSeat: -1,
    seed,
  });
}
