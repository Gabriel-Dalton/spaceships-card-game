"use client";

/**
 * The table, and the person sitting at it.
 *
 * All of the game logic lives in `src/game`; this file is the room around it.
 * It holds one `Game` value, hands the engines their turns on a timer so a
 * move can be read as it happens, and turns each resolved event into cards on
 * the felt and a line in the journal.
 *
 * Nothing here can see a face-down card. The opponents cannot either -- they
 * are handed `features()`, the same public view the rules give you -- so the
 * coach panel showing the ace's scores gives nothing away that you were not
 * already entitled to.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ACTION_NAMES,
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
  makeRng,
  winner,
  type Action,
  type Game as GameState,
} from "../game/rules.ts";
import { ENGINES, TRAINED_GENERATION, decide, type EngineId } from "../game/policies.ts";
import { CardBack, CardFace, Sprite, rankName, tilt } from "./Cards.tsx";
import { narrate, type Told } from "./narrate.tsx";

const SHIP_NAMES = ["Kino", "Hudson", "Frane"];
const THINKING_MS = 850;
const RECORD_KEY = "spaceships:record:v2";

/** Games won and lost against each opponent, kept in localStorage. */
type Tally = { won: number; lost: number };
type Tallies = Partial<Record<EngineId, Tally>>;

interface Line {
  id: number;
  text: React.ReactNode;
  cls: string;
}

const blank: Told = { played: [], said: null, lines: [] };

export default function Game() {
  const [seats, setSeats] = useState(2);
  const [engine, setEngine] = useState<EngineId>("ace");
  const [game, setGame] = useState<GameState | null>(null);
  const [target, setTarget] = useState(0);
  const [armed, setArmed] = useState(false);
  const [told, setTold] = useState<Told>(blank);
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [coach, setCoach] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [records, setRecords] = useState<Tallies>({});
  const lineId = useRef(0);
  // One stream for the cadet's coin flips. Created lazily so the server-side
  // render and the first client render agree.
  const rng = useRef(makeRng(1)).current;

  const push = useCallback((entries: { text: React.ReactNode; cls: string }[]) => {
    if (!entries.length) return;
    setLines((old) => {
      const next = entries.map((e) => ({ ...e, id: lineId.current++ }));
      return [...old, ...next].slice(-80);
    });
  }, []);

  /* --------------------------------------------------------------- dealing */

  const start = useCallback(
    (nSeats: number, seed?: number) => {
      const humanSeat = nSeats - 1; // the human takes the near seat
      const names = Array.from({ length: nSeats }, (_, i) =>
        i === humanSeat ? "You" : SHIP_NAMES[i % SHIP_NAMES.length],
      );
      const g = deal({ seats: nSeats, names, humanSeat, seed });
      setGame(g);
      setTarget(chooseTarget(g, humanSeat));
      setArmed(false);
      setCoach(false);
      setTold(blank);
      lineId.current = 0;
      setLines([
        {
          id: -2,
          text: `Dealt. ${g.ships.map((s) => `${s.name} ${s.startHealth}`).join(", ")}.`,
          cls: "",
        },
        {
          id: -1,
          text: `${g.ships[g.current].name} opens — lowest starting health takes the first turn.`,
          cls: "sys",
        },
      ]);
    },
    [],
  );

  // Dealt on the client, never during the static render, so the prerendered
  // HTML and the first paint cannot disagree about a shuffled deck.
  useEffect(() => {
    start(seats);
  }, [seats, engine, start]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECORD_KEY);
      if (raw) setRecords(JSON.parse(raw) as Tallies);
    } catch {
      /* a browser refusing storage is not a reason to refuse a game */
    }
  }, []);

  /* ---------------------------------------------------------------- moving */

  const applyMove = useCallback(
    (g: GameState, action: Action | -1, at: number) => {
      const { game: next, event } = applyAction(g, action, at);
      const said = narrate(event, g, next);
      setTold(said);
      push(said.lines);
      setGame(next);
      setArmed(false);
      setCoach(false);
      if (!next.over) {
        const human = next.ships.findIndex((s) => s.human);
        if (next.current === human) {
          setTarget((t) =>
            t !== human && !next.ships[t].out ? t : chooseTarget(next, human),
          );
        }
      }
      return next;
    },
    [push],
  );

  // The engines' turns, one every THINKING_MS so a move can be read.
  useEffect(() => {
    if (!game || game.over) return;
    if (game.ships[game.current].human) return;
    setBusy(true);
    const id = window.setTimeout(() => {
      setBusy(false);
      const d = decide(game, engine, rng);
      applyMove(game, d.action, d.target);
    }, THINKING_MS);
    return () => {
      window.clearTimeout(id);
      setBusy(false);
    };
  }, [game, engine, rng, applyMove]);

  // The result, written down once per finished game.
  const settled = useRef<GameState | null>(null);
  useEffect(() => {
    if (!game || !game.over || settled.current === game) return;
    settled.current = game;
    const won = winner(game) >= 0 && game.ships[winner(game)].human;
    setRecords((old) => {
      const prev = old[engine] ?? { won: 0, lost: 0 };
      const next: Tallies = {
        ...old,
        [engine]: { won: prev.won + (won ? 1 : 0), lost: prev.lost + (won ? 0 : 1) },
      };
      try {
        window.localStorage.setItem(RECORD_KEY, JSON.stringify(next));
      } catch {
        /* no storage, no history; the game is unaffected */
      }
      return next;
    });
  }, [game, engine]);

  /* ------------------------------------------------------------- the human */

  const human = game ? game.ships.findIndex((s) => s.human) : -1;
  const myTurn = !!game && !game.over && !busy && game.current === human;
  const legal = useMemo(
    () => (game && myTurn ? legalActions(game, human, target) : null),
    [game, myTurn, human, target],
  );

  const act = (action: Action | -1) => {
    if (!game || !myTurn) return;
    applyMove(game, action, target);
  };

  const advice = useMemo(() => {
    if (!game || !myTurn || !coach) return null;
    // The ace is always the one asked, whoever you are actually playing.
    const d = decide(game, "ace", rng);
    return d;
  }, [game, myTurn, coach, rng]);

  if (!game) {
    return (
      <div className="room">
        <Sprite />
        <div className="topbar">
          <h1>Spaceships</h1>
        </div>
        <p className="label">Shuffling…</p>
      </div>
    );
  }

  const me = game.ships[human];
  const foe = game.ships[target];
  const dry = !canDraw(game);
  const record = records[engine] ?? { won: 0, lost: 0 };
  const engineName = ENGINES.find((e) => e.id === engine)!.name;

  return (
    <div className="room">
      <Sprite />

      <div className="topbar">
        <h1>Spaceships</h1>
        <div className="set">
          <span className="label" id="seatsLabel">
            Players
          </span>
          <select
            aria-labelledby="seatsLabel"
            value={seats}
            onChange={(e) => setSeats(Number(e.target.value))}
          >
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
          <span className="label" id="engineLabel">
            Opponent
          </span>
          <select
            aria-labelledby="engineLabel"
            value={engine}
            onChange={(e) => setEngine(e.target.value as EngineId)}
          >
            {ENGINES.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <button aria-expanded={showRules} onClick={() => setShowRules((s) => !s)}>
            Rules
          </button>
          <button onClick={() => start(seats)}>Deal again</button>
          <span className="record">
            vs {engineName} <b>{record.won}</b>&ndash;<s>{record.lost}</s>
          </span>
        </div>
      </div>

      {showRules && <HowTo />}

      {game.over && (
        <section className="over">
          <span className={"msg" + (winner(game) === human ? "" : " lost")}>
            {winner(game) === human
              ? "Last ship flying. You win."
              : `${winner(game) >= 0 ? game.ships[winner(game)].name : "Nobody"} takes it.`}
          </span>
          <span className="set">
            <button onClick={() => start(seats)}>Deal again</button>
            <button onClick={() => start(seats, game.seed)}>Replay this deal</button>
          </span>
        </section>
      )}

      <div className="felt-wrap">
        <div className="felt" data-seats={game.seats}>
          {game.ships.map((ship, i) => {
            const isTurn = game.current === i && !game.over;
            const targeted = target === i && !ship.human && !ship.out && !game.over;
            const pickable = !ship.human && !ship.out && myTurn;
            return (
              <div
                key={i}
                className={
                  `seat s${i}` +
                  (isTurn ? " turn" : "") +
                  (targeted ? " targeted" : "") +
                  (pickable ? " pickable" : "") +
                  (ship.out ? " out" : "")
                }
                tabIndex={pickable ? 0 : undefined}
                role={pickable ? "button" : undefined}
                aria-label={pickable ? `Aim at ${ship.name}` : undefined}
                onClick={pickable ? () => setTarget(i) : undefined}
                onKeyDown={
                  pickable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setTarget(i);
                        }
                      }
                    : undefined
                }
              >
                <div className="nameline">
                  <span className="nm">{ship.name}</span>
                  <span className={"hp num" + (ship.health < ship.startHealth ? " hurt" : "")}>
                    {Math.max(0, ship.health)}
                  </span>
                  {!ship.human && <span className="engine">{engineName}</span>}
                  {ship.out ? (
                    <span className="tag gone">Out</span>
                  ) : isTurn ? (
                    <span className="tag go">{ship.human ? "Your turn" : "Playing"}</span>
                  ) : null}
                  {targeted && <span className="tag aim">Target</span>}
                </div>
                <div className="rows">
                  <div className="grp">
                    <span className="label">Health</span>
                    <div className="cards">
                      {ship.healthCards.map((v, k) => (
                        <CardFace key={k} value={v} rot={tilt(i * 7 + k)} />
                      ))}
                    </div>
                  </div>
                  <div className="grp">
                    <span className="label">Shield {ship.shield || "—"}</span>
                    <div className="cards">
                      {ship.shield > 0 ? (
                        <CardFace value={ship.shield} rot={tilt(i * 13 + ship.shield)} land />
                      ) : (
                        <div className="slot-empty" />
                      )}
                    </div>
                  </div>
                  <div className="grp">
                    <span className="label">Charges {ship.bank.length}</span>
                    <div className="cards">
                      {ship.bank.length ? (
                        ship.bank.map((_, k) => <CardBack key={k} rot={tilt(i * 29 + k)} />)
                      ) : (
                        <span className="label">none</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="middle">
            <div className="piles">
              <div className="pile">
                {game.deck.length ? (
                  <div className="stack">
                    {[0, 1, 2].slice(0, Math.min(3, game.deck.length)).map((k) => (
                      <div
                        key={k}
                        className="card"
                        style={{ transform: `translate(${k * 1.5}px,${k * 1.5}px) rotate(${k - 1}deg)` }}
                      >
                        <svg viewBox="0 0 240 336" aria-hidden="true">
                          <use href="#cardback" />
                        </svg>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="slot-empty" />
                )}
                <span className="label num">Deck {game.deck.length}</span>
              </div>
              <div className="pile">
                {game.discard.length ? (
                  <div className="stack">
                    <CardFace value={game.discard[game.discard.length - 1]} rot={-2} />
                  </div>
                ) : (
                  <div className="slot-empty" />
                )}
                <span className="label num">Discard {game.discard.length}</span>
              </div>
            </div>
            <div className="played">
              {told.played.map((v, k) =>
                v === null ? (
                  <CardBack key={k} rot={tilt(k + 3)} />
                ) : (
                  <CardFace key={k} value={v} rot={tilt(k + 3)} />
                ),
              )}
            </div>
            <p className="said">
              {told.said ?? <span className="idle">Nothing on the table yet.</span>}
            </p>
          </div>
        </div>

        <aside className="sheet">
          <div className="printed" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <h2>Health</h2>
          {game.ships.map((ship, i) => (
            <div className="col" key={i}>
              <div className="who">
                <span>{ship.name}</span>
                <span className={"live num" + (ship.out ? " dead" : "")}>
                  {Math.max(0, ship.health)}
                </span>
              </div>
              <div className="runs num">
                {ship.history.map((v, k) => (
                  <span
                    key={k}
                    className={k < ship.history.length - 1 ? "old" : ""}
                    style={{ transform: `rotate(${(k % 3) - 1}deg)` }}
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </aside>
      </div>

      <section className="controls">
        {game.over ? (
          <span className="hint">Hand over.</span>
        ) : !myTurn ? (
          <span className="hint">{game.ships[game.current].name} is playing&hellip;</span>
        ) : armed ? (
          <>
            <button className="commit" onClick={() => act(CHARGE_ATTACK)}>
              Say &ldquo;charge attack&rdquo; on {foe.name} &mdash; all {me.bank.length}
            </button>
            <button onClick={() => setArmed(false)}>Back</button>
            <span className="hint">
              Binding. Blocked or not the whole bank goes, and you still don&rsquo;t know
              what it&rsquo;s worth.
            </span>
          </>
        ) : dry ? (
          <>
            <button onClick={() => act(me.bank.length ? CHARGE_ATTACK : -1)}>
              {me.bank.length ? `Forced fire on ${foe.name} — all ${me.bank.length}` : "Pass"}
            </button>
            <span className="hint">Nothing left to draw, so you fire what you hold.</span>
          </>
        ) : (
          <>
            <button disabled={!legal?.[ATTACK]} onClick={() => act(ATTACK)}>
              Attack {foe.name}
            </button>
            <button
              disabled={!legal?.[CHARGE_ATTACK]}
              onClick={() => setArmed(true)}
            >
              Charge attack{me.bank.length ? ` (${me.bank.length})` : ""}
            </button>
            <button disabled={!legal?.[CHARGE]} onClick={() => act(CHARGE)}>
              Charge
            </button>
            <button disabled={!legal?.[SWAP_SELF]} onClick={() => act(SWAP_SELF)}>
              Swap my shield
            </button>
            <button disabled={!legal?.[SWAP_TARGET]} onClick={() => act(SWAP_TARGET)}>
              Swap {foe.name}&rsquo;s
            </button>
            <button onClick={() => setCoach((c) => !c)} aria-expanded={coach}>
              {coach ? "Hide the Ace" : "Ask the Ace"}
            </button>
            <span className="hint">{tableNote(game, human, target)}</span>
          </>
        )}
      </section>

      {advice && <Coach game={game} decision={advice} />}

      <section className="journal" aria-live="polite" aria-label="Play by play">
        {lines
          .slice()
          .reverse()
          .map((l) => (
            <p key={l.id} className={l.cls}>
              {l.text}
            </p>
          ))}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ coach */

function Coach({
  game,
  decision,
}: {
  game: GameState;
  decision: ReturnType<typeof decide>;
}) {
  const scores = decision.scores ?? [];
  const legal = legalActions(game, game.current, decision.target);
  const lo = Math.min(...scores);
  const hi = Math.max(...scores);
  const span = hi - lo || 1;
  const foe = game.ships[decision.target];
  const bank = game.ships[game.current].bank.length;

  const verdict =
    decision.action === -1
      ? "pass — there is nothing legal here"
      : decision.action === CHARGE
        ? "charge, and take the turn off"
        : decision.action === SWAP_SELF
          ? "swap its own shield"
          : decision.action === ATTACK
            ? `attack ${foe.name} with one card, keeping its ${bank === 0 ? "empty bank" : `${bank} charges`}`
            : decision.action === CHARGE_ATTACK
              ? `declare a charge attack on ${foe.name} — all ${bank}`
              : `swap ${foe.name}’s shield`;

  return (
    <section className="coach">
      <div className="head">
        <span>The Ace, from where you are sitting</span>
        <span>self-play generation {TRAINED_GENERATION}</span>
      </div>
      <p className="verdict">
        It would <b>{verdict}</b>.
      </p>
      <div className="bars">
        {ACTION_NAMES.map((nm, a) => (
          <Bar
            key={nm}
            name={nm}
            value={scores[a] ?? 0}
            frac={((scores[a] ?? lo) - lo) / span}
            legal={legal[a]}
            best={a === decision.action}
          />
        ))}
      </div>
      <p className="why">
        Scores, not probabilities — it plays the highest legal one. It is reading the
        same table you are: it cannot see the value of any face-down card, its own
        included.
      </p>
    </section>
  );
}

function Bar({
  name,
  value,
  frac,
  legal,
  best,
}: {
  name: string;
  value: number;
  frac: number;
  legal: boolean;
  best: boolean;
}) {
  return (
    <>
      <span className={"k" + (legal ? "" : " off")}>{name}</span>
      <span className="track">
        <span
          className={"fill" + (best ? " best" : "")}
          style={{ width: `${Math.max(2, frac * 100)}%`, opacity: legal ? 1 : 0.3 }}
        />
      </span>
      <span className="v">{value.toFixed(2)}</span>
    </>
  );
}

/* ------------------------------------------------------------ table notes */

/** One observation about the position, from the arithmetic in the design notes. */
function tableNote(game: GameState, me: number, target: number): string {
  const mine = game.ships[me];
  const stacked = game.ships
    .map((s, i) => ({ s, i }))
    .filter((x) => !x.s.out && x.i !== me && x.s.bank.length >= 2)
    .sort((a, b) => b.s.bank.length - a.s.bank.length)[0];
  const foe = game.ships[target];

  if (stacked) {
    return `${stacked.s.name} is sitting on ${stacked.s.bank.length}. A plain attack wipes it and costs you nothing.`;
  }
  if (mine.shield < 7) {
    return `Your shield blocks only ${mine.shield}. A swap is a blind draw, so it pays off under 7.`;
  }
  if (foe.shield >= 11) {
    return `${foe.name} is behind ${rankName(foe.shield)}. One card can never clear that — charge, or swap it away.`;
  }
  if (mine.bank.length >= 3) {
    return `${mine.bank.length} charges is about ${7 * mine.bank.length} of expected attack. Self-play fires earlier than the notes expected.`;
  }
  return "One card averages 7. So does a shield. Click a seat to change target.";
}

/* ----------------------------------------------------------------- how to */

function HowTo() {
  return (
    <section className="howto">
      <ul>
        <li>
          <b>Orientation is the notation.</b> Health cards stand upright, the shield lies
          on its side. Health itself lives on the paper, not the table.
        </li>
        <li>
          <b>The shield is never used up.</b> It blocks its own value on every attack,
          all game — being hit does not wear it down. The only thing that changes it is
          a swap, and anyone at the table can spend a turn swapping it, including you.
        </li>
        <li>
          <b>Charges are blind.</b> Face down from the deck, unseen by the table{" "}
          <em>and</em> by their owner. Everyone knows the count; nobody knows the total.
        </li>
        <li>
          <b>Say &ldquo;charge attack&rdquo; before you draw, or not at all.</b> It
          commits the whole bank — all or nothing — and it is binding whether it lands or
          is blocked. A plain attack is one card and never touches your charges.
        </li>
        <li>
          <b>Breaking through disarms.</b> Excess damage comes off health and the
          defender&rsquo;s entire bank is destroyed. Their shield is untouched. Equal
          counts as breaking through.
        </li>
        <li>
          <b>Click a seat to aim.</b> A plain attack costs you nothing, which makes it
          the cheap way to wipe somebody else&rsquo;s stockpile.
        </li>
      </ul>
      <p>
        The opponents see exactly what you see: healths, shields, charge counts, and the
        piles. No one can read a face-down card.
      </p>
    </section>
  );
}
