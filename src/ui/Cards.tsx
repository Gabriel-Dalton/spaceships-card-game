/**
 * The deck: one card back, drawn from the photograph the game was played from,
 * and a face that is just the number and a compass rose. Suits are ignored by
 * every rule in the game, so the cards do not carry any.
 *
 * The sprite is defined once and referenced by `<use>`, so a table of forty
 * cards costs one copy of the artwork.
 */

const RANK: Record<number, string> = { 1: "A", 11: "J", 12: "Q", 13: "K" };
const FULL: Record<number, string> = { 1: "Ace", 11: "Jack", 12: "Queen", 13: "King" };

export const rankName = (v: number) => RANK[v] ?? String(v);
export const rankFull = (v: number) => FULL[v] ?? String(v);
export const rankWord = (v: number) => (v === 1 || v === 8 ? "an " : "a ") + rankFull(v);

/** How a dealt card lands, kept stable per card so it does not jitter. */
export const tilt = (key: number) => ((key * 2654435761) % 1000) / 200 - 2.5;

export function CardBack({ rot = 0 }: { rot?: number }) {
  return (
    <div className="card dealt" style={{ transform: `rotate(${rot}deg)` }}>
      <svg viewBox="0 0 240 336" role="img" aria-label="face-down card">
        <use href="#cardback" />
      </svg>
    </div>
  );
}

export function CardFace({ value, rot = 0 }: { value: number; rot?: number }) {
  return (
    <div className="card dealt" style={{ transform: `rotate(${rot}deg)` }}>
      <div className="face" role="img" aria-label={rankName(value)}>
        <div className="pip num">{rankName(value)}</div>
        <div className="mid">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <use href="#rose" x="0" y="0" width="64" height="64" />
          </svg>
        </div>
        <div className="pip bot num">{rankName(value)}</div>
      </div>
    </div>
  );
}

export function Sprite() {
  return (
    <svg className="sprite" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="stipple" width="7" height="7" patternUnits="userSpaceOnUse">
          <circle className="cb-dot" cx="1.75" cy="1.75" r="1.05" />
          <circle className="cb-dot" cx="5.25" cy="5.25" r="1.05" />
        </pattern>

        <g id="orn-corner">
          <circle className="cb-orn" r="9.5" />
          <circle className="cb-orn-fill" r="2.4" />
          <g id="orn-petal-set">
            <path
              className="cb-orn-fill"
              d="M0,-9 C2.4,-7.2 3.4,-5.4 3.4,-3.6 C3.4,-1.8 1.8,-0.9 0,-0.9 C-1.8,-0.9 -3.4,-1.8 -3.4,-3.6 C-3.4,-5.4 -2.4,-7.2 0,-9 Z"
            />
          </g>
          <use href="#orn-petal-set" transform="rotate(90)" />
          <use href="#orn-petal-set" transform="rotate(180)" />
          <use href="#orn-petal-set" transform="rotate(270)" />
          <path
            className="cb-orn"
            d="M-6.7,-6.7 L-9.9,-9.9 M6.7,-6.7 L9.9,-9.9 M-6.7,6.7 L-9.9,9.9 M6.7,6.7 L9.9,9.9"
          />
        </g>

        <g id="orn-unit">
          <path
            className="cb-orn-fill"
            d="M0,2 C2.2,5.4 3.2,8.6 3.2,11.6 C3.2,14.6 2,17.6 0,21 C-2,17.6 -3.2,14.6 -3.2,11.6 C-3.2,8.6 -2.2,5.4 0,2 Z"
          />
          <path className="cb-orn" d="M0,21 L0,26.5" />
          <path
            className="cb-orn-fill"
            d="M0,24 C1.5,25.4 2.2,26.8 2.2,28.4 C2.2,29.4 1.2,30 0,30 C-1.2,30 -2.2,29.4 -2.2,28.4 C-2.2,26.8 -1.5,25.4 0,24 Z"
          />
          <path
            className="cb-orn"
            d="M-2.6,9 C-7,7.4 -11,7.8 -14.6,10.4 C-17.6,12.6 -19.4,15.8 -20,20"
          />
          <path
            className="cb-orn"
            d="M2.6,9 C7,7.4 11,7.8 14.6,10.4 C17.6,12.6 19.4,15.8 20,20"
          />
          <path
            className="cb-orn-fill"
            d="M-4,15.4 C-7.6,12.6 -11.6,11.6 -16,12.4 C-12.8,14.4 -10.6,17.4 -9.6,21.4 C-7.4,18.6 -5.6,16.6 -4,15.4 Z"
          />
          <path
            className="cb-orn-fill"
            d="M4,15.4 C7.6,12.6 11.6,11.6 16,12.4 C12.8,14.4 10.6,17.4 9.6,21.4 C7.4,18.6 5.6,16.6 4,15.4 Z"
          />
          <path
            className="cb-orn"
            d="M-20,20 C-19.4,23.2 -17.4,25 -14.6,25 C-12.6,25 -11.2,23.6 -11.2,21.8"
          />
          <path
            className="cb-orn"
            d="M20,20 C19.4,23.2 17.4,25 14.6,25 C12.6,25 11.2,23.6 11.2,21.8"
          />
          <circle className="cb-orn-fill" cx="-16.4" cy="5.6" r="1.5" />
          <circle className="cb-orn-fill" cx="16.4" cy="5.6" r="1.5" />
          <path className="cb-orn" d="M-8.6,4.4 C-10.6,2.6 -13,2 -15.4,3" />
          <path className="cb-orn" d="M8.6,4.4 C10.6,2.6 13,2 15.4,3" />
        </g>

        <symbol id="rose" viewBox="-32 -32 64 64">
          <circle className="rose-ring" r="30.5" />
          <circle className="rose-teeth" r="27" />
          <circle className="rose-ring" r="23" />
          <circle className="rose-ring" r="19.5" opacity=".6" />
          <path
            className="rose-star"
            d="M0,-27 L4.6,-4.6 L27,0 L4.6,4.6 L0,27 L-4.6,4.6 L-27,0 L-4.6,-4.6 Z"
          />
          <path
            className="rose-shade"
            d="M0,-27 L4.6,-4.6 L0,0 Z M27,0 L4.6,4.6 L0,0 Z M0,27 L-4.6,4.6 L0,0 Z M-27,0 L-4.6,-4.6 L0,0 Z"
          />
          <path
            className="rose-star"
            d="M14,-14 L5.2,-2.6 L2.6,-5.2 Z M14,14 L2.6,5.2 L5.2,2.6 Z M-14,14 L-5.2,2.6 L-2.6,5.2 Z M-14,-14 L-2.6,-5.2 L-5.2,-2.6 Z"
            opacity=".75"
          />
          <circle className="rose-hub" r="3.1" />
        </symbol>

        <symbol id="cardback" viewBox="0 0 240 336">
          <rect className="cb-stock" width="240" height="336" rx="7" />
          <rect className="cb-gold" x="13" y="13" width="214" height="310" />
          <rect className="cb-hair" x="19.5" y="19.5" width="201" height="297" />
          <use href="#orn-unit" transform="translate(76,20)" />
          <use href="#orn-unit" transform="translate(120,20)" />
          <use href="#orn-unit" transform="translate(164,20)" />
          <use href="#orn-unit" transform="translate(76,316) scale(1,-1)" />
          <use href="#orn-unit" transform="translate(120,316) scale(1,-1)" />
          <use href="#orn-unit" transform="translate(164,316) scale(1,-1)" />
          <use href="#orn-unit" transform="translate(20,78) rotate(-90)" />
          <use href="#orn-unit" transform="translate(20,123) rotate(-90)" />
          <use href="#orn-unit" transform="translate(20,168) rotate(-90)" />
          <use href="#orn-unit" transform="translate(20,213) rotate(-90)" />
          <use href="#orn-unit" transform="translate(20,258) rotate(-90)" />
          <use href="#orn-unit" transform="translate(220,78) rotate(90)" />
          <use href="#orn-unit" transform="translate(220,123) rotate(90)" />
          <use href="#orn-unit" transform="translate(220,168) rotate(90)" />
          <use href="#orn-unit" transform="translate(220,213) rotate(90)" />
          <use href="#orn-unit" transform="translate(220,258) rotate(90)" />
          <use href="#orn-corner" transform="translate(34,34)" />
          <use href="#orn-corner" transform="translate(206,34)" />
          <use href="#orn-corner" transform="translate(34,302)" />
          <use href="#orn-corner" transform="translate(206,302)" />
          <rect x="49" y="53" width="142" height="230" fill="url(#stipple)" stroke="none" />
          <rect className="cb-panel" x="49" y="53" width="142" height="230" />
          <rect className="cb-hair" x="53" y="57" width="134" height="222" opacity=".5" />
          <use href="#rose" x="82" y="72" width="76" height="76" />
          <use href="#rose" x="82" y="188" width="76" height="76" />
          <circle className="cb-orn-fill" cx="57" cy="61" r="1.6" />
          <circle className="cb-orn-fill" cx="183" cy="61" r="1.6" />
          <circle className="cb-orn-fill" cx="57" cy="275" r="1.6" />
          <circle className="cb-orn-fill" cx="183" cy="275" r="1.6" />
        </symbol>
      </defs>
    </svg>
  );
}
