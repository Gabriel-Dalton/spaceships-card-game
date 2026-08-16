/**
 * The journal has to talk to one seat and about the others.
 *
 * These are the sentences that came out wrong when every seat was addressed in
 * the third person: "You swaps their own shield", "Kino swaps You's shield".
 */

import assert from "node:assert/strict";
import test from "node:test";

import { speechFor } from "../src/ui/grammar.ts";

const s = speechFor(["Kino", "Hudson", "You"], 2);

test("the reader is addressed in the second person", () => {
  assert.equal(s.they(2), "You");
  assert.equal(s.them(2), "you");
  assert.equal(s.their(2), "your");
  assert.equal(s.Their(2), "Your");
  assert.equal(s.own(2), "your own");
});

test("everybody else stays in the third", () => {
  assert.equal(s.they(0), "Kino");
  assert.equal(s.their(0), "Kino’s");
  assert.equal(s.own(1), "their own");
});

test("verbs agree with the seat", () => {
  assert.equal(s.does(2, "swap"), "swap");
  assert.equal(s.does(0, "swap"), "swaps");
  assert.equal(s.does(2, "charge"), "charge");
  assert.equal(s.does(0, "charge"), "charges");
  assert.equal(s.does(2, "be"), "are");
  assert.equal(s.does(0, "be"), "is");
  assert.equal(s.does(2, "have"), "have");
  assert.equal(s.does(0, "have"), "has");
  assert.equal(s.does(0, "pass"), "passes", "sibilants take -es, not -s");
});

test("the sentences that were wrong now read", () => {
  const swapOwn = (i: number) =>
    `${s.they(i)} ${s.does(i, "swap")} ${s.own(i)} shield`;
  assert.equal(swapOwn(2), "You swap your own shield");
  assert.equal(swapOwn(0), "Kino swaps their own shield");

  const swapTheirs = (a: number, b: number) =>
    `${s.they(a)} ${s.does(a, "swap")} ${s.their(b)} shield`;
  assert.equal(swapTheirs(0, 2), "Kino swaps your shield");
  assert.equal(swapTheirs(2, 0), "You swap Kino’s shield");

  const out = (i: number) => `${s.they(i)} ${s.does(i, "be")} out.`;
  assert.equal(out(2), "You are out.");
  assert.equal(out(0), "Kino is out.");
});

test("with nobody sitting in, every seat is third person", () => {
  // Watch mode: the engines play each other and no one is "you".
  const w = speechFor(["Ace", "Officer"], -1);
  assert.equal(w.they(0), "Ace");
  assert.equal(w.does(0, "charge"), "charges");
  assert.equal(w.their(1), "Officer’s");
  assert.equal(w.own(1), "their own");
});
