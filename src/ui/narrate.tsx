/**
 * Saying out loud what just happened.
 *
 * The engine deals in numbers; this turns one of its events into the three
 * things the table shows: the cards that land face up in the middle, the line
 * printed under them, and the entries in the play-by-play down the side.
 *
 * The wording matters more than it looks. Most of what a player has to hold in
 * their head -- that a blocked plain attack cost nothing, that an undeclared
 * bank survived, that dead level still disarms -- is a rules clause, and the
 * cheapest place to teach it is in the sentence describing the move that just
 * triggered it.
 */

import type { ReactNode } from "react";

import type { GameEvent, Game } from "../game/rules.ts";
import { rankFull, rankName, rankWord } from "./Cards.tsx";

export interface Told {
  /** Face-up cards in the middle of the table; null is a face-down charge. */
  played: (number | null)[];
  said: ReactNode;
  lines: { text: ReactNode; cls: string }[];
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * @param before the table as it was when the move was made -- names, and the
 *               numbers the move was decided against
 * @param after  the table as it stands now
 */
export function narrate(event: GameEvent, before: Game, after: Game): Told {
  const name = (i: number) => before.ships[i].name;
  const lines: Told["lines"] = [];
  if ("reshuffled" in event && event.reshuffled) {
    lines.push({ text: "Deck out. Discards shuffled back.", cls: "sys" });
  }

  if (event.kind === "charge") {
    lines.push({
      text: (
        <>
          {name(event.actor)} charges. <strong>{event.count}</strong> banked,
          value unknown to anyone.
        </>
      ),
      cls: "",
    });
    return {
      played: [null],
      said: (
        <span className="idle">
          Face down, unseen. {name(event.actor)} holds {event.count}.
        </span>
      ),
      lines,
    };
  }

  if (event.kind === "swap") {
    const better = event.to > event.from ? "better" : event.to < event.from ? "worse" : "no change";
    const whose =
      event.subject === event.actor ? "their own" : `${name(event.subject)}’s`;
    lines.push({
      text: (
        <>
          {name(event.actor)} swaps {whose} shield: {rankName(event.from)} out,{" "}
          <strong>{rankName(event.to)}</strong> in.
        </>
      ),
      cls: "",
    });
    return {
      played: [event.to],
      said: (
        <>
          {name(event.subject)}&rsquo;s shield: <em>{rankName(event.from)}</em> out,{" "}
          <em>{rankName(event.to)}</em> in &mdash; {better}.
        </>
      ),
      lines,
    };
  }

  if (event.kind === "pass" || event.kind === "illegal") {
    lines.push({
      text: `${name(event.actor)} has nothing to draw and nothing to fire, and passes.`,
      cls: "sys",
    });
    return { played: [], said: <span className="idle">A turn goes by.</span>, lines };
  }

  const { actor, target, declared, drawn, bank, total, shield, broke, damage } = event;
  const how =
    drawn === null
      ? `fires ${plural(bank.length, "charge")} with nothing left to draw`
      : `draws ${rankWord(drawn)}${
          bank.length ? ` and turns over ${plural(bank.length, "charge")}` : ""
        }`;
  const lead = declared ? (
    <>
      {name(actor)} declares <strong>charge attack</strong>,{" "}
    </>
  ) : (
    <>{name(actor)} </>
  );

  if (broke && damage > 0) {
    lines.push({
      text: (
        <>
          {lead}
          {how} for <strong>{total}</strong>. Through {name(target)}&rsquo;s{" "}
          {rankFull(shield)} for <strong>{damage}</strong>.
        </>
      ),
      cls: "dmg",
    });
  } else if (broke) {
    lines.push({
      text: (
        <>
          {lead}
          {how} for <strong>{total}</strong> &mdash; exactly {name(target)}&rsquo;s
          shield. No damage, but their bank is gone.
        </>
      ),
      cls: "",
    });
  } else {
    lines.push({
      text: (
        <>
          {lead}
          {how} for <strong>{total}</strong>. {name(target)}&rsquo;s{" "}
          {rankFull(shield)} holds.
        </>
      ),
      cls: "",
    });
  }

  if (broke && event.disarmed > 0) {
    lines.push({
      text: `${name(target)} loses ${plural(event.disarmed, "charge")} to the breakthrough.`,
      cls: "sys",
    });
  }
  if (broke && !declared && event.keptBank > 0) {
    lines.push({
      text: `${name(actor)} keeps ${plural(event.keptBank, "charge")} — undeclared charges are never spent.`,
      cls: "sys",
    });
  }
  if (event.killed) {
    lines.push({
      text: (
        <>
          <strong>{name(target)} is out.</strong>
        </>
      ),
      cls: "dmg",
    });
  }
  if (after.over) {
    lines.push({ text: "Last ship flying.", cls: "sys" });
  }

  const played: (number | null)[] = [];
  if (drawn !== null) played.push(drawn);
  played.push(...bank);

  return {
    played,
    said: (
      <>
        <em>{total}</em> into {name(target)}&rsquo;s {rankName(shield)} &mdash;{" "}
        {broke && damage > 0 ? (
          <span className="hit">through for {damage}.</span>
        ) : broke ? (
          <span className="hit">dead level. No damage, bank wiped.</span>
        ) : (
          <span className="no">blocked.</span>
        )}
      </>
    ),
    lines,
  };
}
