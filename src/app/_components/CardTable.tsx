'use client';
/**
 * The spread lays out as a grid sized to the space it actually has, and the
 * hand arrives fanned and settles into it. Decided in #14: on a phone the old
 * `overflow-x-auto` row put most of the cards off-screen, and a fan that
 * stayed a fan cost a tap before any card was reachable. The fan is the deal,
 * not a mode.
 *
 * Sizing is measured rather than set by breakpoints because the binding
 * constraint is vertical — two rows above the dialog box's 256px — and no
 * width breakpoint can express that. That is also why the hand growing from
 * five to six cost this file no layout work: nothing here is a threshold on
 * the count, so the solver simply seats one more.
 */
import { CardType, HAND_SIZE } from '@/types';
import Card, {
  CHROME,
  LABEL_H,
  LABEL_MIN_CARD,
  cardCell,
  showsLabel,
} from './Card';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CROSSFADE, SPRING } from '../_libs/motion';
import { useReducedMotionPref } from '../_libs/settings';

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

/** One row while the cards stay usably large; two rows once they do not. */
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

/**
 * The two ways a hand of this size can divide up a stage: one row, or two split
 * as evenly as possible with the shorter one on top. Derived rather than
 * written out, so the hand size is `HAND_SIZE`'s to change and this stays the
 * question of how to seat whatever arrives — an odd hand still seats 2+3, and
 * six seats 3+3.
 */
function layouts(count: number): number[][][] {
  const indices = Array.from({ length: count }, (_, i) => i);
  const top = Math.floor(count / 2);
  return [[indices], [indices.slice(0, top), indices.slice(top)]];
}

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

/** Both ways a hand of `count` cards can divide up a stage of this size. */
export function spreadCandidates(
  w: number,
  h: number,
  count: number = HAND_SIZE
): SpreadPlan[] {
  return layouts(count).map(rows => candidate(w, h, rows));
}

/**
 * The better of the two, compared rather than assumed: `fitCard` clamps to
 * MIN_CARD, so two rows can come back smaller *and* taller than one across on a
 * short wide stage, and a plan always exists even where none fits.
 */
export function planSpread(
  w: number,
  h: number,
  count: number = HAND_SIZE
): SpreadPlan {
  const [oneRow, twoRows] = spreadCandidates(w, h, count);

  if (oneRow.fits && oneRow.cardW >= ONE_ROW_MIN_CARD) return oneRow;
  if (oneRow.fits !== twoRows.fits) return oneRow.fits ? oneRow : twoRows;
  if (oneRow.fits) return twoRows.cardW > oneRow.cardW ? twoRows : oneRow;
  // Nothing fits. Overflowing the width puts cards past an edge that cannot be
  // scrolled back to, so prefer the plan that stays inside it; a taller plan
  // only costs the scroll the stage now reserves.
  const oneRowFits = oneRow.width <= w;
  const twoRowsFit = twoRows.width <= w;
  if (oneRowFits !== twoRowsFit) return oneRowFits ? oneRow : twoRows;
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
  const reduced = useReducedMotionPref();
  const [stageRef, box] = useStageBox();
  const [dealt, setDealt] = useState(0);
  const [settled, setSettled] = useState(false);
  // One slot per card actually in hand, never a literal: a hand of some other
  // size would otherwise be short a slot that no reveal can fill, so the last
  // card turns and `allRevealed` never fires.
  const [revealedCards, setRevealedCards] = useState<boolean[]>(() =>
    Array(tarotHand?.length ?? 0).fill(false)
  );
  const revealedRef = useRef(revealedCards);
  // The flip is the whole feedback a reveal gives, and it is entirely visual.
  const [announcement, setAnnouncement] = useState('');

  const handSize = tarotHand?.length ?? 0;

  // Adjusted during render rather than in an effect, so a new hand is never
  // dealt for a frame on top of the last one's progress. Keyed on the hand
  // itself, not its size: a hand replaced by one the same size is still a new
  // hand, and keying on the count would leave it dealt and face-up.
  const [handKey, setHandKey] = useState(tarotHand);
  if (handKey !== tarotHand) {
    setHandKey(tarotHand);
    setDealt(0);
    setSettled(false);
    setRevealedCards(Array(handSize).fill(false));
    setAnnouncement('');
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
    const count = next.filter(Boolean).length;
    setAnnouncement(
      `${tarotHand?.[index]?.name}. ${count} of ${handSize} cards revealed.`
    );
    if (!next.includes(false)) setAllRevealed(true);
  };

  // Planned for the hand on the table, and for the one it is about to get while
  // there is none: the stage reserves `plan.height` from the first frame, so a
  // plan for no cards would let the column collapse and jump when they land.
  const plan = planSpread(box.w, box.h, handSize || HAND_SIZE);
  const { cardW, rows, cell } = plan;

  // Never negative: a plan taller than the stage is centred off both its ends,
  // where the cards paint over the header and the dialog box with nothing to
  // scroll them back. The stage reserves `plan.height` instead, so the column
  // grows and the page scrolls to them.
  const gridTop = Math.max(0, (box.h - plan.height) / 2);

  const grid = (index: number) => {
    const row = rows.findIndex(r => r.includes(index));
    const col = rows[row].indexOf(index);
    const width = rows[row].length * cell.width + (rows[row].length - 1) * GAP;
    return {
      x: Math.max(0, (box.w - width) / 2) + col * (cell.width + GAP),
      y: gridTop + row * (cell.height + GAP),
      rotate: 0,
    };
  };

  // The hand fans around its own middle, which for an even hand falls between
  // two cards rather than on one. Was a hard-coded 2 — the middle of five.
  const middle = (plan.rows.flat().length - 1) / 2;

  const fan = (index: number) => ({
    x: box.w / 2 + (index - middle) * cell.width * 0.4 - cell.width / 2,
    y: box.h - cell.height - 8 + Math.abs(index - middle) * 9,
    rotate: (index - middle) * 8,
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
            // Rounded because an even hand's middle is a half: a fractional
            // z-index is not a value CSS accepts, and the order is what matters.
            style={{
              zIndex: settled ? 1 : 10 - Math.round(Math.abs(index - middle)),
            }}
            // Reduced motion keeps the deal — the cards still arrive one at a
            // time, on the same DEAL_MS beat — and drops the travel: each one
            // fades up in the seat it will keep, never crossing the screen and
            // never rotating out of the fan.
            initial={
              reduced
                ? { ...grid(index), opacity: 0 }
                : { ...fan(index), y: -box.h }
            }
            animate={
              reduced
                ? { ...grid(index), opacity: 1 }
                : settled
                  ? grid(index)
                  : fan(index)
            }
            transition={
              reduced ? CROSSFADE : settled ? SPRING.settle : SPRING.arrive
            }
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
      {/* One announcement per reveal — the card that turned and how far
          through the spread that leaves the visitor. Batched reveals collapse
          to the last, which is the only one still true. */}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
