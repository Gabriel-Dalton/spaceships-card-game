"use client";

/**
 * The table, and the person sitting at it -- or standing behind it.
 *
 * All of the game logic lives in `src/game`; this file is the room around it.
 * It holds one `Game` value, hands the engines their turns on a clock slow
 * enough to watch, and turns each resolved event into cards on the felt, a
 * line under them, and an entry in the play-by-play.
 *
 * Two ways to use the room. **Play** seats you at the near edge against the
 * opponent you chose. **Watch** takes you out of the deal entirely and sits
 * the engines against each other -- the self-play arena from `ml/`, run at a
 * human pace instead of thirty-five thousand games a second.
 *
 * Nothing here can see a face-down card. The opponents cannot either -- they
 * are handed `features()`, the same public view the rules give you -- so the
 * coach panel showing the ace's scores gives nothing away that you were not
 * already entitled to.
 *
 * The room has two shapes. On a wide screen everything is on show at once:
 * table, score sheet beside it, controls and play-by-play under it. On a phone
 * the same markup becomes a fixed-height app: header, table, controls, nothing
 * to scroll. The four things you only want occasionally -- the settings, the
 * rules, the play-by-play with the score sheet, and the ace's opinion -- move
 * into bottom sheets you pull up over the table. `panel` is the class that
 * makes an element one of those, and it does nothing at all on a wide screen.
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
const RECORD_KEY = "spaceships:record:v2";

type Mode = "play" | "watch";

/** How long an engine sits on its move. The result then stays on the table
 *  for the whole of the next think, so every move gets read twice over. */
const PACES = [
  { id: "slow", name: "Slow", ms: 3200 },
  { id: "normal", name: "Normal", ms: 2200 },
  { id: "fast", name: "Fast", ms: 1100 },
] as const;
type PaceId = (typeof PACES)[number]["id"];

/** Who sits where in watch mode: the ladder, strongest first. */
const WATCH_LADDER: EngineId[] = ["ace", "officer", "gunner", "cadet"];

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
  const [mode, setMode] = useState<Mode>("play");
  const [seats, setSeats] = useState(2);
  const [engine, setEngine] = useState<EngineId>("ace");
  const [pace, setPace] = useState<PaceId>("normal");
  const [game, setGame] = useState<GameState | null>(null);
  const [target, setTarget] = useState(0);
  const [armed, setArmed] = useState(false);
  const [told, setTold] = useState<Told>(blank);
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [coach, setCoach] = useState(false);
  const [showRules, setShowRules] = useState(false);
  // On a phone these three are bottom sheets, one at a time. On a wide screen
  // the settings and the play-by-play are simply always there, and only the
  // rules toggle, so `showSetup` and `showLog` go unread.
  const [showSetup, setShowSetup] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [records, setRecords] = useState<Tallies>({});
  /** The seat a breakthrough just landed on, flashed and cleared. */
  const [hitSeat, setHitSeat] = useState(-1);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const lineId = useRef(0);
  const hitTimer = useRef(0);
  // One stream for the cadet's coin flips. Created lazily so the server-side
  // render and the first client render agree.
  const rng = useRef(makeRng(1)).current;

  const paceMs = PACES.find((p) => p.id === pace)!.ms;

  /** Which engine plays a given seat. In play mode every engine seat is the
   *  chosen opponent; in watch mode the ladder sits down in order. */
  const engineAt = useCallback(
    (seat: number) => (mode === "watch" ? WATCH_LADDER[seat % WATCH_LADDER.length] : engine),
    [mode, engine],
  );

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
      // The human takes the near seat; in watch mode, nobody does.
      const humanSeat = mode === "play" ? nSeats - 1 : -1;
      const names = Array.from({ length: nSeats }, (_, i) =>
        i === humanSeat
          ? "You"
          : mode === "watch"
            ? ENGINES.find((e) => e.id === WATCH_LADDER[i % WATCH_LADDER.length])!.name
            : SHIP_NAMES[i % SHIP_NAMES.length],
      );
      const g = deal({ seats: nSeats, names, humanSeat, seed });
      setGame(g);
      setTarget(humanSeat >= 0 ? chooseTarget(g, humanSeat) : 0);
      setArmed(false);
      setCoach(false);
      setHitSeat(-1);
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
          text: `${g.ships[g.current].human ? "You open" : `${g.ships[g.current].name} opens`} — lowest starting health takes the first turn.`,
          cls: "sys",
        },
      ]);
    },
    [mode],
  );

  // Dealt on the client, never during the static render, so the prerendered
  // HTML and the first paint cannot disagree about a shuffled deck.
  useEffect(() => {
    start(seats);
  }, [seats, engine, mode, start]);

  useEffect(() => {
    setCanFullscreen(!!document.documentElement.requestFullscreen);
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
      // Show the blow landing: flash the seat that just lost health or a bank.
      if (event.kind === "attack" && event.broke) {
        setHitSeat(event.target);
        window.clearTimeout(hitTimer.current);
        hitTimer.current = window.setTimeout(() => setHitSeat(-1), 1100);
      }
      if (!next.over) {
        const human = next.ships.findIndex((s) => s.human);
        if (human >= 0 && next.current === human) {
          setTarget((t) =>
            t !== human && !next.ships[t].out ? t : chooseTarget(next, human),
          );
        }
      }
      return next;
    },
    [push],
  );

  // The engines' turns. Each one thinks for paceMs before moving, and the
  // previous move's cards stay on the table for the whole of that think --
  // which is what makes a string of engine turns readable move by move.
  useEffect(() => {
    if (!game || game.over) return;
    if (game.ships[game.current].human) return;
    setBusy(true);
    const id = window.setTimeout(() => {
      setBusy(false);
      const d = decide(game, engineAt(game.current), rng);
      applyMove(game, d.action, d.target);
    }, paceMs);
    return () => {
      window.clearTimeout(id);
      setBusy(false);
    };
  }, [game, engineAt, paceMs, rng, applyMove]);

  // The result, written down once per finished game. Watch games are the
  // engines' business, not the record's.
  const settled = useRef<GameState | null>(null);
  useEffect(() => {
    if (!game || !game.over || settled.current === game) return;
    settled.current = game;
    if (mode !== "play") return;
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
  }, [game, engine, mode]);

  /* ------------------------------------------------------------- the human */

  const human = game ? game.ships.findIndex((s) => s.human) : -1;
  const myTurn = !!game && !game.over && !busy && human >= 0 && game.current === human;
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
    return decide(game, "ace", rng);
  }, [game, myTurn, coach, rng]);

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  };

  /** Put every bottom sheet away. Tapping the scrim behind one does this, and
   *  so does opening another, so only one is ever up. */
  const closePanels = useCallback(() => {
    setShowSetup(false);
    setShowLog(false);
    setShowRules(false);
    setCoach(false);
  }, []);

  // Escape closes whatever is up, the way a phone's back gesture would.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanels();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closePanels]);

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

  const me = human >= 0 ? game.ships[human] : null;
  const foe = game.ships[target];
  const dry = !canDraw(game);
  const record = records[engine] ?? { won: 0, lost: 0 };
  const engineName = ENGINES.find((e) => e.id === engine)!.name;
  const watching = mode === "watch";

  return (
    <div className="room">
      <Sprite />

      <div className="topbar">
        <h1>Spaceships</h1>
        <div className={"set panel" + (showSetup ? " open" : "")} id="setup">
          <span className="label" id="modeLabel">
            Table
          </span>
          <select
            aria-labelledby="modeLabel"
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
          >
            <option value="play">Play</option>
            <option value="watch">Watch</option>
          </select>
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
          {!watching && (
            <>
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
            </>
          )}
          <span className="label" id="paceLabel">
            Pace
          </span>
          <select
            aria-labelledby="paceLabel"
            value={pace}
            onChange={(e) => setPace(e.target.value as PaceId)}
          >
            {PACES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            aria-expanded={showRules}
            onClick={() => {
              const next = !showRules;
              closePanels();
              setShowRules(next);
            }}
          >
            Rules
          </button>
          <button
            onClick={() => {
              closePanels();
              start(seats);
            }}
          >
            Deal again
          </button>
          {canFullscreen && <button onClick={fullscreen}>Full screen</button>}
          <button className="only-narrow" onClick={closePanels}>
            Back to the table
          </button>
        </div>
        {!watching && (
          <span className="record">
            vs {engineName} <b>{record.won}</b>&ndash;<s>{record.lost}</s>
          </span>
        )}
        {/* The phone's way in to everything that is not the table itself. */}
        <div className="barbtns only-narrow">
          <button
            aria-expanded={showLog}
            aria-controls="journal"
            onClick={() => {
              const next = !showLog;
              closePanels();
              setShowLog(next);
            }}
          >
            Log
          </button>
          <button
            aria-expanded={showSetup}
            aria-controls="setup"
            onClick={() => {
              const next = !showSetup;
              closePanels();
              setShowSetup(next);
            }}
          >
            Setup
          </button>
        </div>
      </div>

      {showRules && <HowTo onClose={closePanels} />}
      {(showSetup || showLog || showRules) && (
        <div className="scrim" onClick={closePanels} aria-hidden="true" />
      )}

      {game.over && (
        <section className="over">
          <span className={"msg" + (!watching && winner(game) !== human ? " lost" : "")}>
            {!watching && winner(game) === human
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
            const targeted =
              !watching && target === i && !ship.human && !ship.out && !game.over;
            const pickable = !ship.human && !ship.out && myTurn;
            return (
              <div
                key={i}
                className={
                  `seat s${i}` +
                  (isTurn ? " turn" : "") +
                  (targeted ? " targeted" : "") +
                  (pickable ? " pickable" : "") +
                  (ship.out ? " out" : "") +
                  (hitSeat === i ? " hit" : "")
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
                  <span className={"hp" + (ship.health < ship.startHealth ? " hurt" : "")}>
                    {Math.max(0, ship.health)}
                  </span>
                  {!ship.human && !watching && <span className="engine">{engineName}</span>}
                  {ship.out ? (
                    <span className="tag gone">Out</span>
                  ) : isTurn ? (
                    <span className="tag go">
                      {ship.human ? "Your turn" : busy && game.current === i ? "Thinking…" : "Playing"}
                    </span>
                  ) : null}
                  {targeted && <span className="tag aim">Target</span>}
                </div>

                {/* The tableau reads by placement alone: the shield sits above
                    the health cards, charges stay face down beside them. */}
                <div className="tableau">
                  <div className="shieldrow">
                    {ship.shield > 0 ? (
                      <CardFace value={ship.shield} rot={tilt(i * 13 + ship.shield)} />
                    ) : (
                      <div className="slot-empty" />
                    )}
                  </div>
                  <div className="rows">
                    <div className="grp">
                      <div className="cards">
                        {ship.healthCards.map((v, k) => (
                          <CardFace key={k} value={v} rot={tilt(i * 7 + k)} />
                        ))}
                      </div>
                    </div>
                    <div className="grp charges">
                      <div className="cards">
                        {ship.bank.map((_, k) => (
                          <CardBack key={k} rot={tilt(i * 29 + k)} />
                        ))}
                      </div>
                      <span className="label">
                        {ship.bank.length
                          ? `${ship.bank.length} charge${ship.bank.length > 1 ? "s" : ""}`
                          : "no charges"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="middle">
            {/* Nothing on a wide screen -- `display:contents`. On a phone it
                puts the piles and the cards just played on one line, which is
                a whole card's height of table saved. */}
            <div className="midrow">
              <div className="piles">
                <div className="pile">
                  {game.deck.length ? (
                    <div className="stack">
                      {[0, 1, 2].slice(0, Math.min(3, game.deck.length)).map((k) => (
                        <div
                          key={k}
                          className="card"
                          style={{
                            transform: `translate(${k * 1.5}px,${k * 1.5}px) rotate(${k - 1}deg)`,
                          }}
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
                  <span className="label">Deck {game.deck.length}</span>
                </div>
                <div className="pile">
                  {game.discard.length ? (
                    <div className="stack">
                      <CardFace value={game.discard[game.discard.length - 1]} rot={-2} />
                    </div>
                  ) : (
                    <div className="slot-empty" />
                  )}
                  <span className="label">Discard {game.discard.length}</span>
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
            </div>
            <p className="said">
              {told.said ?? <span className="idle">Nothing on the table yet.</span>}
            </p>
          </div>
        </div>

        {/* Beside the table on a wide screen; on a phone it goes into the log
            sheet, where there is room for it. */}
        <ScoreSheet game={game} className="wide-only" />
      </div>

      <section className="controls">
        {game.over ? (
          <span className="hint">Hand over.</span>
        ) : watching ? (
          <span className="hint">
            {game.ships
              .filter((s) => !s.out)
              .map((s) => s.name)
              .join(" against ")}{" "}
            — every seat sees only the public table. Deal again to restart.
          </span>
        ) : !myTurn ? (
          <span className="hint">{game.ships[game.current].name} is playing&hellip;</span>
        ) : armed ? (
          <>
            <button className="commit prime" onClick={() => act(CHARGE_ATTACK)}>
              Say &ldquo;charge attack&rdquo; on {foe.name} &mdash; a card plus all{" "}
              {me!.bank.length}
            </button>
            <button onClick={() => setArmed(false)}>Back</button>
            <span className="hint">
              You still draw one card, and {me!.bank.length} charge
              {me!.bank.length > 1 ? "s" : ""} {me!.bank.length > 1 ? "go" : "goes"} in on
              top of it. Binding &mdash; blocked or not the whole bank goes, and you
              still don&rsquo;t know what it was worth.
            </span>
          </>
        ) : dry ? (
          <>
            <button className="prime" onClick={() => act(me!.bank.length ? CHARGE_ATTACK : -1)}>
              {me!.bank.length ? `Forced fire on ${foe.name} — all ${me!.bank.length}` : "Pass"}
            </button>
            <span className="hint">Nothing left to draw, so you fire what you hold.</span>
          </>
        ) : (
          <>
            <button className="prime" disabled={!legal?.[ATTACK]} onClick={() => act(ATTACK)}>
              Attack {foe.name}
              <span className="wide-only"> — one card</span>
            </button>
            <button disabled={!legal?.[CHARGE_ATTACK]} onClick={() => setArmed(true)}>
              Charge attack
              {me!.bank.length ? (
                <>
                  <span className="wide-only"> — card + </span>
                  <span className="narrow-only"> +</span>
                  {me!.bank.length}
                </>
              ) : null}
            </button>
            <button disabled={!legal?.[CHARGE]} onClick={() => act(CHARGE)}>
              Charge
            </button>
            <button
              className="minor"
              disabled={!legal?.[SWAP_SELF]}
              onClick={() => act(SWAP_SELF)}
            >
              Swap <span className="wide-only">my shield</span>
              <span className="narrow-only">mine</span>
            </button>
            <button
              className="minor"
              disabled={!legal?.[SWAP_TARGET]}
              onClick={() => act(SWAP_TARGET)}
            >
              Swap {foe.name}&rsquo;s
            </button>
            <button
              className="minor"
              onClick={() => {
                const next = !coach;
                closePanels();
                setCoach(next);
              }}
              aria-expanded={coach}
            >
              {coach ? "Hide the Ace" : "Ask the Ace"}
            </button>
            <span className="hint">{tableNote(game, human, target)}</span>
          </>
        )}
      </section>

      {advice && <Coach game={game} decision={advice} onClose={closePanels} />}

      {/* `display:contents` on a wide screen, so the play-by-play sits under
          the controls exactly as it always did. On a phone the wrapper is the
          log sheet, and the score sheet rides up with it. */}
      <div className={"logwrap panel" + (showLog ? " open" : "")}>
        <ScoreSheet game={game} className="narrow-only" />
        <section
          className="journal"
          id="journal"
          aria-live="polite"
          aria-label="Play by play"
        >
          {lines
            .slice()
            .reverse()
            .map((l) => (
              <p key={l.id} className={l.cls}>
                {l.text}
              </p>
            ))}
        </section>
        <button className="only-narrow" onClick={closePanels}>
          Back to the table
        </button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- score sheet */

/** Health, and every value it has held, in biro on a sheet of paper. */
function ScoreSheet({ game, className }: { game: GameState; className: string }) {
  return (
    <aside className={"sheet " + className}>
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
            <span className={"live" + (ship.out ? " dead" : "")}>
              {Math.max(0, ship.health)}
            </span>
          </div>
          <div className="runs">
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
  );
}

/* ------------------------------------------------------------------ coach */

/** What the ace would do, said rather than plotted. The network scores five
 *  actions; a row of numbers is a debug readout, so the margin between its
 *  first and second choice is put into words instead. */
function Coach({
  game,
  decision,
  onClose,
}: {
  game: GameState;
  decision: ReturnType<typeof decide>;
  onClose: () => void;
}) {
  const scores = decision.scores ?? [];
  const legal = legalActions(game, game.current, decision.target);
  const foe = game.ships[decision.target];
  const bank = game.ships[game.current].bank.length;

  const said = (a: Action | -1, short: boolean): string => {
    switch (a) {
      case CHARGE:
        return short ? "charging" : "charge, and take the turn off";
      case SWAP_SELF:
        return short ? "swapping its own shield" : "swap its own shield";
      case ATTACK:
        return short
          ? `a plain attack on ${foe.name}`
          : `attack ${foe.name} with the one drawn card, keeping ${
              bank === 0 ? "nothing back" : `all ${bank} of its charges`
            }`;
      case CHARGE_ATTACK:
        return short
          ? `a charge attack on ${foe.name}`
          : `declare a charge attack on ${foe.name} — the card it draws plus all ${bank}`;
      case SWAP_TARGET:
        return short ? `swapping ${foe.name}’s shield` : `swap ${foe.name}’s shield`;
      default:
        return "pass — there is nothing legal here";
    }
  };

  // The runner-up, and how far behind it is.
  const ranked = scores
    .map((v, a) => ({ v, a: a as Action }))
    .filter((x) => legal[x.a] && x.a !== decision.action)
    .sort((x, y) => y.v - x.v);
  const gap = ranked.length ? (scores[decision.action as number] ?? 0) - ranked[0].v : 0;
  const margin = !ranked.length ? (
    <>It is the only legal move here.</>
  ) : (
    <>
      {gap >= 1.5 ? "Comfortably ahead of " : gap >= 0.5 ? "Ahead of " : "Only just, over "}
      {said(ranked[0].a, true)}.
    </>
  );

  return (
    /* Down from the top on a phone, not up from the bottom: the ace's opinion
       is worth nothing if it covers the buttons you would act on. */
    <section className="coach panel from-top open">
      <div className="head">
        <span>The Ace, from where you are sitting</span>
        <span>self-play generation {TRAINED_GENERATION}</span>
      </div>
      <p className="verdict">
        It would <b>{said(decision.action, false)}</b>.
      </p>
      <p className="margin">{margin}</p>
      <p className="why">
        It is reading the same table you are — it cannot see the value of any face-down
        card, its own included.
      </p>
      <button className="only-narrow" onClick={onClose}>
        Close
      </button>
    </section>
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
  return "One card averages 7. So does a shield. Tap a seat to change target.";
}

/* ----------------------------------------------------------------- how to */

function HowTo({ onClose }: { onClose: () => void }) {
  return (
    <section className="howto panel open">
      <ul>
        <li>
          <b>Placement is the notation.</b> The shield sits above the health cards;
          nothing is rotated or marked. Health itself lives on the paper, not the table.
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
          <b>Say &ldquo;charge attack&rdquo; before you draw, or not at all.</b> You draw
          a card either way; declaring adds <em>every</em> charge you hold on top of it,
          so the attack is the drawn card <em>plus</em> the whole bank. All or nothing —
          you cannot hold one back — and binding whether it lands or is blocked. A plain
          attack is the one card alone and never touches your charges.
        </li>
        <li>
          <b>Breaking through disarms.</b> Excess damage comes off health and the
          defender&rsquo;s entire bank is destroyed. Their shield is untouched. Equal
          counts as breaking through.
        </li>
        <li>
          <b>Tap a seat to aim.</b> A plain attack costs you nothing, which makes it
          the cheap way to wipe somebody else&rsquo;s stockpile.
        </li>
      </ul>
      <p>
        The opponents see exactly what you see: healths, shields, charge counts, and the
        piles. No one can read a face-down card. Switch the table to <em>Watch</em> to
        sit back and let the engines play each other.
      </p>
      <button className="only-narrow" onClick={onClose}>
        Back to the table
      </button>
    </section>
  );
}
