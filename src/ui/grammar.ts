/**
 * Talking to the player instead of about them.
 *
 * One seat at the table is the person reading the journal, so every line has
 * to switch person depending on who it is describing: *Kino swaps their own
 * shield*, but *You swap your own shield*, and when Kino comes for you it is
 * *Kino swaps your shield* — never "You's".
 *
 * Kept apart from the narration itself, and free of React, so the awkward
 * cases can be pinned down in `tests/grammar.test.ts` rather than found in a
 * screenshot.
 */

/** Verbs the +s rule gets wrong. Values are [second person, third person]. */
const IRREGULAR: Record<string, [string, string]> = {
  be: ["are", "is"],
  have: ["have", "has"],
  do: ["do", "does"],
};

/** Sibilant endings take -es: "miss" -> "misses", not "misss". */
const SIBILANT = /(s|x|z|ch|sh)$/;

export interface Speech {
  /** Sentence-initial subject: "You" | "Kino". */
  they: (i: number) => string;
  /** Object, mid-sentence: "you" | "Kino". */
  them: (i: number) => string;
  /** Possessive, mid-sentence: "your" | "Kino’s". */
  their: (i: number) => string;
  /** Possessive, sentence-initial: "Your" | "Kino’s". */
  Their: (i: number) => string;
  /** Reflexive possessive: "your own" | "their own". */
  own: (i: number) => string;
  /** The verb agreeing with that seat, given its plain form. */
  does: (i: number, base: string) => string;
  /** Whether this seat is the person reading. */
  isYou: (i: number) => boolean;
}

/**
 * @param names   seat names, as dealt
 * @param youSeat the seat the reader is sitting in, or -1 when nobody is
 *                (watch mode, where every seat is spoken about in the third
 *                person and none of this switching applies)
 */
export function speechFor(names: string[], youSeat: number): Speech {
  const isYou = (i: number) => i === youSeat;
  const name = (i: number) => names[i] ?? `Seat ${i + 1}`;

  return {
    isYou,
    they: (i) => (isYou(i) ? "You" : name(i)),
    them: (i) => (isYou(i) ? "you" : name(i)),
    their: (i) => (isYou(i) ? "your" : `${name(i)}’s`),
    Their: (i) => (isYou(i) ? "Your" : `${name(i)}’s`),
    own: (i) => (isYou(i) ? "your own" : "their own"),
    does: (i, base) => {
      const irregular = IRREGULAR[base];
      if (irregular) return isYou(i) ? irregular[0] : irregular[1];
      if (isYou(i)) return base;
      return base + (SIBILANT.test(base) ? "es" : "s");
    },
  };
}
