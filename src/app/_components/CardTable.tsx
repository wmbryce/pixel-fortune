'use client';
/**
 * The spread lays out as a grid sized to the space it actually has, and the
 * hand arrives fanned and settles into it. Decided in #14: on a phone the old
 * `overflow-x-auto` row put three of the five cards off-screen, and a fan that
 * stayed a fan cost a tap before any card was reachable. The fan is the deal,
 * not a mode.
 *
 * Sizing is measured rather than set by breakpoints because the binding
 * constraint is vertical — two rows above the dialog box's 256px — and no
 * width breakpoint can express that.
 */
import { CardType } from '@/types';
import Card, {
  CHROME,
  LABEL_H,
  LABEL_MIN_CARD,
  cardCell,
  showsLabel,
} from './Card';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

type Props = {
  tarotHand?: CardType[];
  setAllRevealed: (revealed: boolean) => void;
};

const GAP = 12;
/**
 * Cards land every DEAL_MS and the fan settles a beat after the last one, so
 * the spread is at rest before the dialog box asks for the first card at
 * 2200ms.
 */
const DEAL_MS = 260;
const SETTLE_DELAY_MS = 250;
const ARRIVE = { type: 'spring', bounce: 0, duration: 0.55 } as const;
const SETTLE = { type: 'spring', bounce: 0, duration: 0.45 } as const;

/** Five across while they stay usably large; 2+3 once they do not. */
const ONE_ROW_MIN_CARD = 96;
const MIN_CARD = 40;
const MAX_CARD = 192;

/**
 * The largest card that fits `cols` x `rows` in the box. Solved twice because
 * the caption's row only exists above a threshold, and the second solve is
 * capped below it so the answer agrees with what `Card` will render. The
 * chrome and that threshold come from `Card`, which owns them through
 * `cardCell` — a solve against its own copy would target a size the cell does
 * not have.
 */
function fitCard(w: number, h: number, cols: number, rows: number): number {
  const solve = (label: number) =>
    Math.floor(
      Math.min(
        (w - GAP * (cols + 1)) / cols - CHROME,
        ((h - GAP * (rows + 1)) / rows - CHROME - label) / 1.5
      )
    );
  const clamp = (v: number) => Math.max(MIN_CARD, Math.min(MAX_CARD, v));

  const captioned = solve(LABEL_H);
  return showsLabel(captioned)
    ? clamp(captioned)
    : clamp(Math.min(solve(0), LABEL_MIN_CARD - 1));
}

export type SpreadPlan = {
  cardW: number;
  rows: number[][];
  cell: { width: number; height: number };
  /** What the plan occupies, so the stage can reserve it. */
  width: number;
  height: number;
  /** False once even a MIN_CARD spread is bigger than the stage. */
  fits: boolean;
};

const LAYOUTS = [[[0, 1, 2, 3, 4]], [[0, 1], [2, 3, 4]]];

function candidate(w: number, h: number, rows: number[][]): SpreadPlan {
  const cols = Math.max(...rows.map(r => r.length));
  const cardW = fitCard(w, h, cols, rows.length);
  const cell = cardCell(cardW);
  const width = Math.max(
    ...rows.map(r => r.length * cell.width + (r.length - 1) * GAP)
  );
  const height = rows.length * cell.height + (rows.length - 1) * GAP;
  return { cardW, rows, cell, width, height, fits: width <= w && height <= h };
}

/** Both ways the five cards can divide up a stage of this size. */
export function spreadCandidates(w: number, h: number): SpreadPlan[] {
  return LAYOUTS.map(rows => candidate(w, h, rows));
}

/**
 * The better of the two, compared rather than assumed: `fitCard` clamps to
 * MIN_CARD, so 2+3 can come back smaller *and* taller than five across on a
 * short wide stage, and a plan always exists even where none fits.
 */
export function planSpread(w: number, h: number): SpreadPlan {
  const [oneRow, twoRows] = spreadCandidates(w, h);

  if (oneRow.fits && oneRow.cardW >= ONE_ROW_MIN_CARD) return oneRow;
  if (oneRow.fits !== twoRows.fits) return oneRow.fits ? oneRow : twoRows;
  if (oneRow.fits) return twoRows.cardW > oneRow.cardW ? twoRows : oneRow;
  // Nothing fits. Overflowing the width puts cards past an edge that cannot be
  // scrolled back to, so prefer the plan that stays inside it; a taller plan
  // only costs the scroll the stage now reserves.
  if (oneRow.width <= w !== (twoRows.width <= w))
    return oneRow.width <= w ? oneRow : twoRows;
  return twoRows.height < oneRow.height ? twoRows : oneRow;
}

function useStageBox() {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setBox({ w: entry.contentRect.width, h: entry.contentRect.height })
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, box] as const;
}

export default function CardTable({ tarotHand, setAllRevealed }: Props) {
  const [stageRef, box] = useStageBox();
  const [dealt, setDealt] = useState(0);
  const [settled, setSettled] = useState(false);
  const [revealedCards, setRevealedCards] = useState<boolean[]>(() =>
    Array(5).fill(false)
  );
  const revealedRef = useRef(revealedCards);

  const handSize = tarotHand?.length ?? 0;

  // Adjusted during render rather than in an effect, so a new hand is never
  // dealt for a frame on top of the last one's progress. Keyed on the hand
  // itself, not its size: five cards replaced by five others is still a new
  // hand, and keying on the count would leave it dealt and face-up.
  const [handKey, setHandKey] = useState(tarotHand);
  if (handKey !== tarotHand) {
    setHandKey(tarotHand);
    setDealt(0);
    setSettled(false);
    setRevealedCards(Array(5).fill(false));
  }

  // Keeps the batch-safety ref honest through a reset, which changes the array
  // without going through a reveal.
  useEffect(() => {
    revealedRef.current = revealedCards;
  }, [revealedCards]);

  useEffect(() => {
    if (dealt >= handSize) return;
    const t = setTimeout(() => setDealt(d => d + 1), DEAL_MS);
    return () => clearTimeout(t);
  }, [dealt, handSize]);

  useEffect(() => {
    if (handSize === 0 || dealt < handSize || settled) return;
    const t = setTimeout(() => setSettled(true), SETTLE_DELAY_MS);
    return () => clearTimeout(t);
  }, [dealt, handSize, settled]);

  // Reported from the reveal itself rather than an effect on the array: the
  // page clears it when a hand is dealt, so the only transition to announce is
  // the one a tap causes. The ref carries the latest reveal because several can
  // land in one batch — reading the state variable would let each of them see
  // the same stale array and only the last would survive.
  const UpdateRevealCard = (index: number) => {
    const next = revealedRef.current.map((r, i) => (i === index ? true : r));
    revealedRef.current = next;
    setRevealedCards(next);
    if (!next.includes(false)) setAllRevealed(true);
  };

  const plan = planSpread(box.w, box.h);
  const { cardW, rows, cell } = plan;

  // Never negative: a plan taller than the stage is centred off both its ends,
  // where the cards paint over the header and the dialog box with nothing to
  // scroll them back. The stage reserves `plan.height` instead, so the column
  // grows and the page scrolls to them.
  const gridTop = Math.max(0, (box.h - plan.height) / 2);

  const grid = (index: number) => {
    const row = rows.findIndex(r => r.includes(index));
    const col = rows[row].indexOf(index);
    const width =
      rows[row].length * cell.width + (rows[row].length - 1) * GAP;
    return {
      x: Math.max(0, (box.w - width) / 2) + col * (cell.width + GAP),
      y: gridTop + row * (cell.height + GAP),
      rotate: 0,
    };
  };

  const fan = (index: number) => ({
    x: box.w / 2 + (index - 2) * cell.width * 0.4 - cell.width / 2,
    y: box.h - cell.height - 8 + Math.abs(index - 2) * 9,
    rotate: (index - 2) * 8,
  });

  return (
    <div
      ref={stageRef}
      className="relative flex-1"
      style={{ minHeight: plan.height }}
    >
      {box.w > 0 &&
        tarotHand?.slice(0, dealt).map((data: CardType, index: number) => (
          <motion.div
            key={index}
            className="absolute left-0 top-0"
            style={{ zIndex: settled ? 1 : 10 - Math.abs(index - 2) }}
            initial={{ ...fan(index), y: -box.h }}
            animate={settled ? grid(index) : fan(index)}
            transition={settled ? SETTLE : ARRIVE}
          >
            <Card
              id={'t-card-' + index}
              index={index}
              width={cardW}
              reveal={revealedCards?.[index]}
              setReveal={UpdateRevealCard}
              data={data}
            />
          </motion.div>
        ))}
    </div>
  );
}
