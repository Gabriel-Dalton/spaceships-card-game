/**
 * The rules, clause by clause.
 *
 * A port of `ml/test_engine.py`, test for test, so the same sixteen assertions
 * are made of both engines. Run with `npm test`.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ATTACK,
  CHARGE,
  CHARGE_ATTACK,
  SWAP_SELF,
  SWAP_TARGET,
  applyAction,
  canDraw,
  chooseTarget,
  deal,
  legalActions,
  livingSeats,
  makeRng,
  type Action,
  type Game,
} from "../src/game/rules.ts";
import { features } from "../src/game/features.ts";
import { decide } from "../src/game/policies.ts";
import { dealt, table } from "./helpers.ts";

const bankValue = (g: Game, p: number) =>
  g.ships[p].bank.reduce((a, b) => a + b, 0);

/** One move by the seat to move, against the engine's own target choice. */
function step(g: Game, action: Action | -1, target?: number) {
  return applyAction(g, action, target ?? chooseTarget(g, g.current));
}

test("the shield is permanent and absorbs", () => {
  const g = table({ shield: [7, 6], deck: [10] });
  const { game } = step(g, ATTACK);
  assert.equal(game.ships[1].health, 20 - (10 - 6), "10 against a 6 deals 4");
  assert.equal(game.ships[1].shield, 6, "absorbed, never consumed");
});

test("a blocked plain attack costs nothing", () => {
  const g = table({ shield: [7, 13], deck: [2], banks: [[5, 5], []] });
  const { game } = step(g, ATTACK);
  assert.equal(game.ships[1].health, 20);
  assert.equal(game.ships[0].bank.length, 2, "a plain attack spends no charges");
});

test("a charge attack is binding even when blocked", () => {
  const g = table({ shield: [7, 13], deck: [1], banks: [[2], []] });
  const { game } = step(g, CHARGE_ATTACK);
  assert.equal(game.ships[1].health, 20, "blocked, so no damage");
  assert.equal(game.ships[0].bank.length, 0, "the bank is gone anyway");
});

test("an equal attack disarms without damage", () => {
  const g = table({ shield: [7, 7], deck: [7], banks: [[], [10, 10, 10]] });
  const { game, event } = step(g, ATTACK);
  assert.equal(game.ships[1].health, 20, "equal breaks through for 0 damage");
  assert.equal(game.ships[1].bank.length, 0, "and still wipes their bank");
  assert.equal(event.kind === "attack" && event.disarmed, 3);
});

test("a breakthrough wipes the defender's bank, not the attacker's", () => {
  const g = table({ shield: [7, 3], deck: [9], banks: [[9, 9], [4, 4]] });
  const { game } = step(g, ATTACK);
  assert.equal(game.ships[1].bank.length, 0);
  assert.equal(game.ships[0].bank.length, 2, "undeclared charges are never spent");
});

test("a charge is drawn face down and banked", () => {
  const g = table();
  const before = g.deck.length;
  const { game } = step(g, CHARGE);
  assert.equal(game.ships[0].bank.length, 1);
  assert.equal(game.deck.length, before - 1, "every action draws exactly one card");
});

test("swapping discards the old shield", () => {
  let g = table({ shield: [2, 7] });
  let out = step(g, SWAP_SELF);
  assert.ok(out.game.discard.includes(2), "the 2 went to the discard");
  assert.notEqual(out.game.ships[0].shield, 2);

  g = table({ shield: [7, 12] });
  out = step(g, SWAP_TARGET);
  assert.ok(out.game.discard.includes(12), "you can wreck someone else's too");
});

test("cards are conserved", () => {
  // Nothing is created or destroyed: deck + discard + shields + banks is
  // always 52 minus the health cards, which never circulate.
  const rng = makeRng(3);
  let g = dealt(3, 3);
  const healthCards = 3 * g.seats;
  for (let i = 0; i < 60 && !g.over; i++) {
    const target = chooseTarget(g, g.current);
    const legal = legalActions(g, g.current, target);
    const options = legal.flatMap((ok, a) => (ok ? [a as Action] : []));
    const pick = options.length
      ? options[Math.floor(rng() * options.length)]
      : (-1 as const);
    g = applyAction(g, pick, target).game;
  }
  const inPlay =
    g.deck.length +
    g.discard.length +
    g.ships.reduce((a, s) => a + s.bank.length + (s.shield > 0 ? 1 : 0), 0);
  assert.equal(inPlay, 52 - healthCards);
});

test("the discards reshuffle when the deck runs out", () => {
  const g = table({ deck: [], discard: [7, 7, 7] });
  assert.ok(canDraw(g));
  const { game } = step(g, CHARGE);
  assert.equal(game.reshuffles, 1);
  assert.equal(game.discard.length, 0);
  assert.equal(game.deck.length, 2);
  assert.equal(game.ships[0].bank.length, 1);
});

test("forced fire when there is nothing to draw", () => {
  const g = table({ shield: [7, 5], deck: [], discard: [], banks: [[9, 9], []] });
  assert.deepEqual(
    legalActions(g, 0, 1),
    [false, false, false, true, false],
    "with no card to draw, firing the bank is the only legal action",
  );
  const { game } = step(g, CHARGE_ATTACK);
  assert.equal(game.ships[1].health, 20 - (18 - 5));
  assert.equal(game.ships[0].bank.length, 0);
});

test("a pass when there is nothing to draw and no bank", () => {
  const g = table({ deck: [], discard: [] });
  assert.ok(!legalActions(g, 0, 1).some(Boolean));
  const { game } = step(g, -1);
  assert.equal(game.current, 1, "the turn still passes to the next player");
});

test("a table that banks forever still finishes", () => {
  // The pathological table the design notes warn about: the forced-fire
  // backstop turns a deadlock into a game that resolves itself.
  for (let seats = 2; seats <= 6; seats++) {
    for (let s = 0; s < 20; s++) {
      let g = dealt(seats, 1000 + s * 7 + seats);
      let guard = 0;
      while (!g.over && guard++ < 4000) {
        const target = chooseTarget(g, g.current);
        const legal = legalActions(g, g.current, target);
        const action: Action | -1 = legal[CHARGE]
          ? CHARGE
          : legal[CHARGE_ATTACK]
            ? CHARGE_ATTACK
            : -1;
        g = applyAction(g, action, target).game;
      }
      assert.ok(g.over, `${seats} players deadlocked`);
    }
  }
});

test("the lowest starting health moves first", () => {
  for (let s = 0; s < 500; s++) {
    const g = dealt(3, s + 1);
    const key = g.ships.map((sh) => sh.startHealth * 100 + sh.shield);
    assert.equal(key[g.current], Math.min(...key));
  }
});

test("dead players are skipped and the game ends", () => {
  const rng = makeRng(9);
  for (let s = 0; s < 120; s++) {
    let g = dealt(4, 5000 + s);
    let guard = 0;
    while (!g.over && guard++ < 4000) {
      const engine = g.current % 2 === 0 ? "officer" : "cadet";
      const d = decide(g, engine, rng);
      g = applyAction(g, d.action, d.target).game;
    }
    assert.equal(livingSeats(g).length, 1, "one ship left flying");
    assert.ok(g.ships[livingSeats(g)[0]].health > 0);
  }
});

test("no policy can see a bank's value", () => {
  // Charge values must not leak into the features: two tables identical
  // except for what is face down have to look identical.
  const a = table({ banks: [[1, 1, 1], []] });
  const b = table({ banks: [[13, 13, 13], []] });
  assert.deepEqual(features(a, 0, 1), features(b, 0, 1));
  assert.notEqual(bankValue(a, 0), bankValue(b, 0));
});

test("features are finite", () => {
  const rng = makeRng(4);
  for (let s = 0; s < 60; s++) {
    let g = dealt(5, 9000 + s);
    let guard = 0;
    while (!g.over && guard++ < 400) {
      const target = chooseTarget(g, g.current);
      for (const f of features(g, g.current, target)) assert.ok(Number.isFinite(f));
      const d = decide(g, "ace", rng);
      g = applyAction(g, d.action, d.target).game;
    }
  }
});

test("a deal is reproducible from its seed", () => {
  const a = deal({ seats: 3, names: ["a", "b", "c"], humanSeat: 2, seed: 4242 });
  const b = deal({ seats: 3, names: ["a", "b", "c"], humanSeat: 2, seed: 4242 });
  assert.deepEqual(a.deck, b.deck);
  assert.deepEqual(
    a.ships.map((s) => [s.startHealth, s.shield]),
    b.ships.map((s) => [s.startHealth, s.shield]),
  );
});
