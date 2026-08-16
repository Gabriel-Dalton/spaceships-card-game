/**
 * Who you can sit down against.
 *
 * Four opponents, in the order they were beaten in `ml/README.md`:
 *
 *   cadet     uniform over legal actions -- the floor.
 *   gunner    fires at the first opportunity; the impatient play the rules punish.
 *   officer   the reference heuristic the analysis scripts use.
 *   ace       the self-play network, 4.1 million games of training, which beats
 *             the officer 81% of the time with seats alternated.
 *
 * Every one of them sees exactly what you see -- `features()` is public
 * information only, and no policy may read the value of a face-down card. The
 * ace has no more idea what is in its own bank than you do.
 */

import weights from "./policy.ts";
import { FEATURE_NAMES, N_FEATURES, features, publicView } from "./features.ts";
import {
  ATTACK,
  CHARGE,
  CHARGE_ATTACK,
  N_ACTIONS,
  SWAP_SELF,
  SWAP_TARGET,
  chooseTarget,
  legalActions,
  type Action,
  type Game,
  type Rng,
} from "./rules.ts";

export type EngineId = "cadet" | "gunner" | "officer" | "ace";

export interface EngineSpec {
  id: EngineId;
  name: string;
  blurb: string;
}

export const ENGINES: EngineSpec[] = [
  {
    id: "cadet",
    name: "Cadet",
    blurb: "Picks at random from whatever is legal. The floor.",
  },
  {
    id: "gunner",
    name: "Gunner",
    blurb: "Fires the moment it can. The impatience the rules punish.",
  },
  {
    id: "officer",
    name: "Officer",
    blurb: "Repairs a bad shield, takes the disarm shot, cashes in at three.",
  },
  {
    id: "ace",
    name: "Ace",
    blurb: "Trained by self-play. Fires early and swaps late.",
  },
];

/* ------------------------------------------------------- the trained ship */

// The export writes the feature and action order it trained against, so a
// reordering here becomes a loud failure rather than a subtly worse opponent.
const trainedFeatures = weights.features as readonly string[];
if (trainedFeatures.length !== N_FEATURES) {
  throw new Error("policy.ts was trained on a different feature set");
}
trainedFeatures.forEach((name, i) => {
  if (name !== FEATURE_NAMES[i]) {
    throw new Error(`feature ${i} is ${FEATURE_NAMES[i]}, trained as ${name}`);
  }
});

const HIDDEN: number = weights.hidden;
const THETA = weights.theta as readonly number[];

// features -> tanh(hidden) -> one score per action, unpacked from the flat
// parameter vector exactly as ml/policies.py packs it.
const W1_END = N_FEATURES * HIDDEN;
const B1_END = W1_END + HIDDEN;
const W2_END = B1_END + HIDDEN * N_ACTIONS;

export function networkScores(obs: number[]): number[] {
  const hidden = new Array<number>(HIDDEN);
  for (let h = 0; h < HIDDEN; h++) {
    let sum = THETA[W1_END + h];
    for (let f = 0; f < N_FEATURES; f++) sum += obs[f] * THETA[f * HIDDEN + h];
    hidden[h] = Math.tanh(sum);
  }
  const out = new Array<number>(N_ACTIONS);
  for (let a = 0; a < N_ACTIONS; a++) {
    let sum = THETA[W2_END + a];
    for (let h = 0; h < HIDDEN; h++) {
      sum += hidden[h] * THETA[B1_END + h * N_ACTIONS + a];
    }
    out[a] = sum;
  }
  return out;
}

export const TRAINED_GENERATION = weights.generation;

/* ------------------------------------------------------------------ choice */

/** Highest-scoring legal action, or -1 when nothing at all is legal. */
function bestLegal(scores: number[], legal: boolean[]): Action | -1 {
  let best: Action | -1 = -1;
  let bestScore = -Infinity;
  for (let a = 0; a < N_ACTIONS; a++) {
    if (legal[a] && scores[a] > bestScore) {
      bestScore = scores[a];
      best = a as Action;
    }
  }
  return best;
}

export interface Decision {
  action: Action | -1;
  target: number;
  /** Per-action scores, for the hint panel. Unset for the cadet. */
  scores?: number[];
}

function heuristicScores(g: Game, mover: number, target: number): number[] {
  const v = publicView(g, mover, target);
  const scores = new Array<number>(N_ACTIONS).fill(-1);

  const repair = v.ownShield <= 5;
  const disarm = !repair && v.tgtCharges >= 3 && v.tgtShield <= 7;
  const lethal = 7 * (v.ownCharges + 1) >= v.tgtHealth + v.tgtShield;
  const cash =
    !repair && !disarm && (v.ownCharges >= 3 || (v.ownCharges >= 1 && lethal));
  const bank = !(repair || disarm || cash);

  if (repair) scores[SWAP_SELF] = 10;
  if (disarm) scores[ATTACK] = 10; // a plain attack costs our own bank nothing
  if (cash) scores[CHARGE_ATTACK] = 10;
  if (bank) scores[CHARGE] = 10;
  // Fallbacks in the order the rules make sensible, for when the first pick is
  // illegal -- cashing in with no bank left after being disarmed, say.
  scores[CHARGE] = Math.max(scores[CHARGE], 1);
  scores[ATTACK] = Math.max(scores[ATTACK], 0.5);
  scores[CHARGE_ATTACK] = Math.max(scores[CHARGE_ATTACK], 0.25);
  scores[SWAP_SELF] = Math.max(scores[SWAP_SELF], 0.1);
  scores[SWAP_TARGET] = Math.max(scores[SWAP_TARGET], 0);
  return scores;
}

function greedyScores(): number[] {
  const scores = new Array<number>(N_ACTIONS).fill(0);
  scores[CHARGE_ATTACK] = 3;
  scores[ATTACK] = 2;
  scores[CHARGE] = 1;
  return scores;
}

/**
 * What `engine` does in this position.
 *
 * Target choice is the engine's own (softest shield, biggest bank), which is
 * also what makes this usable as a hint: it answers "what would it do sitting
 * where I am", chair and all.
 */
export function decide(g: Game, engine: EngineId, rng: Rng): Decision {
  const mover = g.current;
  const target = chooseTarget(g, mover);
  const legal = legalActions(g, mover, target);

  if (engine === "cadet") {
    const options: Action[] = [];
    for (let a = 0; a < N_ACTIONS; a++) if (legal[a]) options.push(a as Action);
    return {
      action: options.length ? options[Math.floor(rng() * options.length)] : -1,
      target,
    };
  }

  const scores =
    engine === "gunner"
      ? greedyScores()
      : engine === "officer"
        ? heuristicScores(g, mover, target)
        : networkScores(features(g, mover, target));

  return { action: bestLegal(scores, legal), target, scores };
}
