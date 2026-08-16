/**
 * Is the port the same engine?
 *
 * `tests/fixtures/positions.json` is 360 positions taken out of real games in
 * the Python engine, each carrying the target it chose, the legal mask, all 26
 * features, the trained network's five output scores and the action each
 * policy picked. This file rebuilds every one of those positions here and
 * demands the same answers.
 *
 * That is what licenses the browser opponent: the ace was fitted against the
 * Python engine's numbers, and this is the evidence it is being handed the
 * same ones. Regenerate with `python3 -m ml.export_web`.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { chooseTarget, legalActions, makeRng } from "../src/game/rules.ts";
import { FEATURE_NAMES, features } from "../src/game/features.ts";
import { decide, networkScores } from "../src/game/policies.ts";
import { gameFromFixture, type Fixture } from "./helpers.ts";

const data = JSON.parse(
  readFileSync(fileURLToPath(new URL("./fixtures/positions.json", import.meta.url)), "utf8"),
) as { features: string[]; actions: string[]; positions: Fixture[] };

const rng = makeRng(1);

// Float64 arithmetic in a different order can land a unit in the last place
// out; anything bigger than this is a real disagreement, not rounding.
const EPS = 1e-9;

test("the feature list has not drifted from the trained one", () => {
  assert.deepEqual([...FEATURE_NAMES], data.features);
});

test("the fixtures cover more than the tidy middle of a game", () => {
  const p = data.positions;
  assert.ok(p.length >= 300, "enough positions to be worth trusting");
  assert.ok(new Set(p.map((x) => x.nPlayers)).size === 3, "two to four players");
  assert.ok(p.some((x) => x.deck.reduce((a, b) => a + b, 0) === 0), "a dry deck");
  assert.ok(p.some((x) => x.alive.some((a) => !a)), "a table with a seat empty");
  assert.ok(p.some((x) => x.charges[x.cur].some((c) => c > 0)), "a live bank");
});

test("target choice matches, position for position", () => {
  for (const [i, f] of data.positions.entries()) {
    const g = gameFromFixture(f);
    assert.equal(chooseTarget(g, f.cur), f.expect.target, `position ${i}`);
  }
});

test("the legal mask matches, position for position", () => {
  for (const [i, f] of data.positions.entries()) {
    const g = gameFromFixture(f);
    assert.deepEqual(
      legalActions(g, f.cur, f.expect.target),
      f.expect.legal,
      `position ${i}`,
    );
  }
});

test("every feature matches, position for position", () => {
  let worst = 0;
  for (const [i, f] of data.positions.entries()) {
    const g = gameFromFixture(f);
    const got = features(g, f.cur, f.expect.target);
    for (let k = 0; k < got.length; k++) {
      const gap = Math.abs(got[k] - f.expect.features[k]);
      worst = Math.max(worst, gap);
      assert.ok(
        gap < EPS,
        `position ${i}, ${FEATURE_NAMES[k]}: ${got[k]} vs ${f.expect.features[k]}`,
      );
    }
  }
  assert.ok(worst < EPS);
});

test("the network produces the same five scores", () => {
  let worst = 0;
  for (const [i, f] of data.positions.entries()) {
    const g = gameFromFixture(f);
    const got = networkScores(features(g, f.cur, f.expect.target));
    for (let a = 0; a < got.length; a++) {
      const gap = Math.abs(got[a] - f.expect.mlpScores[a]);
      worst = Math.max(worst, gap);
      assert.ok(gap < 1e-9, `position ${i}, action ${a}: ${got[a]} vs ${f.expect.mlpScores[a]}`);
    }
  }
  assert.ok(worst < 1e-9, `worst score gap ${worst}`);
});

test("every policy picks the same action as its Python original", () => {
  for (const [i, f] of data.positions.entries()) {
    const g = gameFromFixture(f);
    assert.equal(decide(g, "ace", rng).action, f.expect.mlp, `ace, position ${i}`);
    assert.equal(
      decide(g, "officer", rng).action,
      f.expect.heuristic,
      `officer, position ${i}`,
    );
    assert.equal(
      decide(g, "gunner", rng).action,
      f.expect.greedy,
      `gunner, position ${i}`,
    );
  }
});

test("the cadet only ever picks something legal", () => {
  for (const f of data.positions) {
    const g = gameFromFixture(f);
    for (let k = 0; k < 12; k++) {
      const d = decide(g, "cadet", rng);
      if (d.action === -1) assert.ok(!f.expect.legal.some(Boolean));
      else assert.ok(f.expect.legal[d.action]);
    }
  }
});
