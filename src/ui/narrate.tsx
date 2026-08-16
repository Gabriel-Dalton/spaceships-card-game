/**
 * Saying out loud what just happened.
 *
 * The engine deals in numbers; this turns one of its events into the three
 * things the table shows: the cards that land face up in the middle, the line
 * printed under them, and the entries in the play-by-play down the side.
 *
 * Every sentence is built through `speechFor`, because one of these seats is
 * the person reading: *Kino swaps their own shield*, but *You swap your own
 * shield*, and when it is done to you, *Kino swaps your shield*.
 *
 * The wording matters more than it looks. Most of what a player has to hold in
 * their head -- that a blocked plain attack cost nothing, that an undeclared
 * bank survived, that a charge attack is the drawn card *plus* the bank -- is a
 * rules clause, and the cheapest place to teach it is in the sentence
 * describing the move that just triggered it.
 */

import type { ReactNode } from "react";

import type { GameEvent, Game } from "../game/rules.ts";
import { rankFull, rankName, rankWord } from "./Cards.tsx";
import { speechFor } from "./grammar.ts";

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
  const s = speechFor(
    before.ships.map((ship) => ship.name),
    before.ships.findIndex((ship) => ship.human),
  );
  const lines: Told["lines"] = [];
  if ("reshuffled" in event && event.reshuffled) {
    lines.push({ text: "Deck out. Discards shuffled back.", cls: "sys" });
  }

  if (event.kind === "charge") {
    lines.push({
      text: (
        <>
          {s.they(event.actor)} {s.does(event.actor, "charge")}.{" "}
          <strong>{event.count}</strong> banked, value unknown to anyone.
        </>
      ),
      cls: "",
    });
    return {
      played: [null],
      said: (
        <span className="idle">
          Face down, unseen. {s.they(event.actor)} {s.does(event.actor, "hold")}{" "}
          {event.count}.
        </span>
      ),
      lines,
    };
  }

  if (event.kind === "swap") {
    const better =
      event.to > event.from ? "better" : event.to < event.from ? "worse" : "no change";
    const whose =
      event.subject === event.actor ? s.own(event.actor) : s.their(event.subject);
    lines.push({
      text: (
        <>
          {s.they(event.actor)} {s.does(event.actor, "swap")} {whose} shield:{" "}
          {rankName(event.from)} out, <strong>{rankName(event.to)}</strong> in.
        </>
      ),
      cls: "",
    });
    return {
      played: [event.to],
      said: (
        <>
          {s.Their(event.subject)} shield: <em>{rankName(event.from)}</em> out,{" "}
          <em>{rankName(event.to)}</em> in &mdash; {better}.
        </>
      ),
      lines,
    };
  }

  if (event.kind === "pass" || event.kind === "illegal") {
    lines.push({
      text: (
        <>
          {s.they(event.actor)} {s.does(event.actor, "have")} nothing to draw and
          nothing to fire, and {s.does(event.actor, "pass")}.
        </>
      ),
      cls: "sys",
    });
    return { played: [], said: <span className="idle">A turn goes by.</span>, lines };
  }

  const { actor, target, declared, drawn, bank, total, shield, broke, damage } = event;

  // A charge attack is the drawn card *plus* every charge, which is why the
  // line always names both halves of the sum.
  const how =
    drawn === null ? (
      <>
        {s.does(actor, "fire")} {plural(bank.length, "charge")} with nothing left to
        draw
      </>
    ) : bank.length ? (
      <>
        {s.does(actor, "draw")} {rankWord(drawn)} and {s.does(actor, "turn")} over{" "}
        {plural(bank.length, "charge")}
      </>
    ) : (
      <>
        {s.does(actor, "draw")} {rankWord(drawn)}
      </>
    );
  const lead = declared ? (
    <>
      {s.they(actor)} {s.does(actor, "declare")} <strong>charge attack</strong>,{" "}
    </>
  ) : (
    <>{s.they(actor)} </>
  );

  if (broke && damage > 0) {
    lines.push({
      text: (
        <>
          {lead}
          {how} for <strong>{total}</strong>. Through {s.their(target)}{" "}
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
          {how} for <strong>{total}</strong> &mdash; exactly {s.their(target)} shield.
          No damage, but {s.their(target)} bank is gone.
        </>
      ),
      cls: "",
    });
  } else {
    lines.push({
      text: (
        <>
          {lead}
          {how} for <strong>{total}</strong>. {s.Their(target)} {rankFull(shield)}{" "}
          holds.
        </>
      ),
      cls: "",
    });
  }

  if (broke && event.disarmed > 0) {
    lines.push({
      text: (
        <>
          {s.they(target)} {s.does(target, "lose")} {plural(event.disarmed, "charge")} to
          the breakthrough.
        </>
      ),
      cls: "sys",
    });
  }
  if (broke && !declared && event.keptBank > 0) {
    lines.push({
      text: (
        <>
          {s.they(actor)} {s.does(actor, "keep")} {plural(event.keptBank, "charge")} —
          undeclared charges are never spent.
        </>
      ),
      cls: "sys",
    });
  }
  if (event.killed) {
    lines.push({
      text: (
        <strong>
          {s.they(target)} {s.does(target, "be")} out.
        </strong>
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
        <em>{total}</em> into {s.their(target)} {rankName(shield)} &mdash;{" "}
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
