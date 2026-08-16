/**
 * What a player is allowed to know.
 *
 * Every number here is public by construction. Charge *counts* are on the
 * table; charge *values* are unknown to everybody, their owner included, which
 * is what makes Spaceships a perfect-information stochastic game and lets a
 * policy be a plain function of the position. Nothing in this file reads a
 * bank's contents, and the Python side has a test asserting the same thing.
 *
 * The order of `FEATURE_NAMES` is load-bearing: it is the input layer of the
 * trained network in `policy.json`. Adding a feature means retraining, not
 * appending. `policies.ts` checks the two agree at import time.
 */

import { MEAN_CARD, type Game } from "./rules.ts";

export const FEATURE_NAMES = [
  "bias",
  "own_health",
  "own_shield",
  "own_shield_deficit",
  "own_charges",
  "own_bank_expected",
  "own_charges_is_zero",
  "tgt_health",
  "tgt_shield",
  "tgt_shield_deficit",
  "tgt_charges",
  "tgt_bank_expected",
  "expected_plain_damage",
  "expected_charge_damage",
  "expected_charge_overkill",
  "charge_attack_kills",
  "n_live_opponents",
  "max_opp_charges",
  "min_opp_shield",
  "mean_opp_shield",
  "min_opp_health",
  "am_i_lowest_health",
  "deck_left",
  "discard_left",
  "pool_mean_rank",
  "turn",
] as const;

export const N_FEATURES = FEATURE_NAMES.length;

/** The same numbers unnormalised and named, for the hand-written policies. */
export interface PublicView {
  me: number;
  target: number;
  ownHealth: number;
  ownShield: number;
  ownCharges: number;
  tgtHealth: number;
  tgtShield: number;
  tgtCharges: number;
  maxOppCharges: number;
  nOpponents: number;
  canDraw: boolean;
}

export function publicView(g: Game, mover: number, target: number): PublicView {
  let maxOppCharges = 0;
  let nOpponents = 0;
  for (let i = 0; i < g.seats; i++) {
    if (i === mover || g.ships[i].out) continue;
    nOpponents += 1;
    maxOppCharges = Math.max(maxOppCharges, g.ships[i].bank.length);
  }
  const me = g.ships[mover];
  const t = g.ships[target];
  return {
    me: mover,
    target,
    ownHealth: me.health,
    ownShield: me.shield,
    ownCharges: me.bank.length,
    tgtHealth: t.health,
    tgtShield: t.shield,
    tgtCharges: t.bank.length,
    maxOppCharges,
    nOpponents,
    canDraw: g.deck.length + g.discard.length > 0,
  };
}

const bit = (b: boolean) => (b ? 1 : 0);

/** [N_FEATURES] from the mover's seat, in the order the network was trained. */
export function features(g: Game, mover: number, target: number): number[] {
  const me = g.ships[mover];
  const t = g.ships[target];

  const ownH = me.health;
  const ownS = me.shield;
  const ownC = me.bank.length;
  const tH = t.health;
  const tS = t.shield;
  const tC = t.bank.length;

  let nOpp = 0;
  let minOppShield = Infinity;
  let minOppHealth = Infinity;
  let maxOppCharges = 0;
  let sumOppShield = 0;
  for (let i = 0; i < g.seats; i++) {
    if (i === mover || g.ships[i].out) continue;
    const s = g.ships[i];
    nOpp += 1;
    minOppShield = Math.min(minOppShield, s.shield);
    minOppHealth = Math.min(minOppHealth, s.health);
    maxOppCharges = Math.max(maxOppCharges, s.bank.length);
    sumOppShield += s.shield;
  }

  // An unseen card is worth 7 to whoever is holding it, so a bank of n is
  // worth 7n to its owner and to everybody reading the count off the table.
  const ownBank = MEAN_CARD * ownC;
  const chargeAtk = ownBank + MEAN_CARD;

  const deckLeft = g.deck.length;
  const discardLeft = g.discard.length;
  const poolTotal = deckLeft + discardLeft;
  let poolSum = 0;
  for (const v of g.deck) poolSum += v;
  for (const v of g.discard) poolSum += v;
  const poolMean = poolTotal > 0 ? poolSum / poolTotal : MEAN_CARD;

  const f = new Array<number>(N_FEATURES);
  f[0] = 1;
  f[1] = ownH / 20;
  f[2] = ownS / 13;
  f[3] = (MEAN_CARD - ownS) / 13;
  f[4] = ownC / 5;
  f[5] = ownBank / 20;
  f[6] = bit(ownC === 0);
  f[7] = tH / 20;
  f[8] = tS / 13;
  f[9] = (MEAN_CARD - tS) / 13;
  f[10] = tC / 5;
  f[11] = (MEAN_CARD * tC) / 20;
  f[12] = (MEAN_CARD - tS) / 13;
  f[13] = (chargeAtk - tS) / 20;
  f[14] = (chargeAtk - tS - tH) / 20;
  f[15] = bit(chargeAtk - tS >= tH);
  f[16] = nOpp / 5;
  f[17] = maxOppCharges / 5;
  f[18] = (nOpp > 0 ? minOppShield : MEAN_CARD) / 13;
  f[19] = nOpp > 0 ? sumOppShield / nOpp / 13 : 0;
  f[20] = (nOpp > 0 ? minOppHealth : 0) / 20;
  f[21] = bit(ownH <= (nOpp > 0 ? minOppHealth : Infinity));
  f[22] = deckLeft / 52;
  f[23] = discardLeft / 52;
  f[24] = poolMean / 13;
  f[25] = g.turns / 50;
  return f;
}
