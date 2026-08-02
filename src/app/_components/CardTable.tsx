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
import Card, { cardCell } from './Card';
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
const LABEL_H = 22;

/**
 * The largest card that fits `cols` x `rows` in the box. Solved twice because
 * the caption's row only exists above a threshold, and the second solve is
 * capped below it so the answer agrees with what `Card` will render.
 */
function fitCard(w: number, h: number, cols: number, rows: number): number {
  const solve = (label: number) =>
    Math.floor(
      Math.min(
        (w - GAP * (cols + 1)) / cols - 32,
        ((h - GAP * (rows + 1)) / rows - 32 - label) / 1.5
      )
    );
  const clamp = (v: number) => Math.max(MIN_CARD, Math.min(MAX_CARD, v));

  const captioned = solve(LABEL_H);
  return captioned >= 64 ? clamp(captioned) : clamp(Math.min(solve(0), 63));
}

export type SpreadPlan = {
  cardW: number;
  rows: number[][];
  cell: { width: number; height: number };
};

/** How the five cards divide up a stage of this size. */
export function planSpread(w: number, h: number): SpreadPlan {
  const wide = fitCard(w, h, 5, 1);
  const oneRow = wide >= ONE_ROW_MIN_CARD;
  const cardW = oneRow ? wide : fitCard(w, h, 3, 2);
  return {
    cardW,
    rows: oneRow ? [[0, 1, 2, 3, 4]] : [[0, 1], [2, 3, 4]],
    cell: cardCell(cardW),
  };
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

  const handSize = tarotHand?.length ?? 0;

  useEffect(() => {
    if (handSize === 0) {
      setDealt(0);
      setSettled(false);
      setRevealedCards(Array(5).fill(false));
    }
  }, [handSize]);

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

  useEffect(() => {
    if (!revealedCards.includes(false)) {
      setAllRevealed(true);
    }
  }, [revealedCards, setAllRevealed]);

  const UpdateRevealCard = (index: number) => {
    setRevealedCards(prev => prev.map((r, i) => (i === index ? true : r)));
  };

  const { cardW, rows, cell } = planSpread(box.w, box.h);

  const gridTop =
    (box.h - (rows.length * cell.height + (rows.length - 1) * GAP)) / 2;

  const grid = (index: number) => {
    const row = rows.findIndex(r => r.includes(index));
    const col = rows[row].indexOf(index);
    const width =
      rows[row].length * cell.width + (rows[row].length - 1) * GAP;
    return {
      x: (box.w - width) / 2 + col * (cell.width + GAP),
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
    <div ref={stageRef} className="relative min-h-0 flex-1">
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
