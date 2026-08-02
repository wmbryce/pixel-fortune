'use client';
/**
 * PROTOTYPE — four mobile layouts for the five-card spread (#14).
 * Delete this whole route when the winner lands.
 *
 * Each variant owns the whole stage below the header, including where the
 * dialog box sits, because "what does it do with the dialog box" is half the
 * question. The dialog is a stand-in (see parts.tsx) — #16 owns the real one.
 */
import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CardType } from '@/types';
import {
  DialogStandIn,
  FlipCard,
  GAP,
  LABEL_H,
  fitCard,
  outerH,
  outerW,
  useBox,
} from './parts';

export type VariantProps = {
  hand: CardType[];
  revealed: boolean[];
  reveal: (index: number) => void;
  dialogExpanded: boolean;
};

export type Variant = React.ComponentType<VariantProps> & { title: string };

const SETTLE = { type: 'spring', bounce: 0, duration: 0.45 } as const;

/** Column shell: cards take the slack, the dialog keeps its own strip. */
function Stage({
  children,
  dialogExpanded,
}: {
  children: React.ReactNode;
  dialogExpanded: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      {children}
      <div className="shrink-0 px-3 pb-3">
        <DialogStandIn expanded={dialogExpanded} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ A ---- */
/**
 * Fanned hand that expands on tap. The fan is the resting state — five cards
 * overlapped in an arc, the way a hand is held — and one tap spreads them into
 * a 2+3 grid where every card has a full target. Tapping the backdrop returns
 * them along the same path.
 */
export const VariantA: Variant = ({
  hand,
  revealed,
  reveal,
  dialogExpanded,
}) => {
  const [ref, box] = useBox<HTMLDivElement>();
  const [expanded, setExpanded] = useState(false);
  const cardW = fitCard(box.w, box.h, 3, 2);
  const ow = outerW(cardW);
  const oh = outerH(cardW) + LABEL_H;

  const fan = (i: number) => ({
    x: box.w / 2 + (i - 2) * ow * 0.4 - ow / 2,
    y: box.h - oh - 8 + Math.abs(i - 2) * 9,
    rotate: (i - 2) * 8,
    zIndex: 10 - Math.abs(i - 2),
  });

  const gridH = 2 * oh + GAP;
  const top = (box.h - gridH) / 2;
  const grid = (i: number) => {
    const row = i < 2 ? 0 : 1;
    const cols = row === 0 ? 2 : 3;
    const col = row === 0 ? i : i - 2;
    const width = cols * ow + (cols - 1) * GAP;
    return {
      x: (box.w - width) / 2 + col * (ow + GAP),
      y: top + row * (oh + GAP),
      rotate: 0,
      zIndex: 1,
    };
  };

  return (
    <Stage dialogExpanded={dialogExpanded}>
      <div
        ref={ref}
        className="relative flex-1 overflow-hidden"
        onClick={() => expanded && setExpanded(false)}
      >
        {box.w > 0 &&
          hand.map((data, i) => {
            const to = expanded ? grid(i) : fan(i);
            return (
              <motion.div
                key={i}
                className="absolute left-0 top-0"
                style={{ zIndex: to.zIndex }}
                initial={false}
                animate={{ x: to.x, y: to.y, rotate: to.rotate }}
                transition={SETTLE}
                onClick={e => {
                  e.stopPropagation();
                  if (!expanded) setExpanded(true);
                }}
              >
                <FlipCard
                  data={data}
                  cardW={cardW}
                  revealed={!!revealed[i]}
                  onTap={() => (expanded ? reveal(i) : setExpanded(true))}
                />
              </motion.div>
            );
          })}
        <p className="pointer-events-none absolute inset-x-0 top-2 text-center font-sans text-[11px] text-brown_02/70">
          {expanded ? 'tap a card to turn it' : 'tap the hand to spread it'}
        </p>
      </div>
    </Stage>
  );
};
VariantA.title = 'A · fanned hand, expands on tap';

/* ------------------------------------------------------------------ B ---- */
/**
 * Stacked deck dealt one card at a time into a focused position. The focus
 * slot is the emptiest place on the screen, so a card flips with the most room
 * of any variant; revealed cards retire to a rail so the spread accumulates.
 */
export const VariantB: Variant = ({
  hand,
  revealed,
  reveal,
  dialogExpanded,
}) => {
  const [ref, box] = useBox<HTMLDivElement>();
  const [dealt, setDealt] = useState(-1);
  const cardW = fitCard(box.w, box.h - 90, 2, 1);
  const ow = outerW(cardW);
  const oh = outerH(cardW) + LABEL_H;
  const railScale = 0.42;
  const deckScale = 0.62;
  // Scaling happens about the centre, so a scaled card's visible edge is
  // inset by half the shrinkage — every edge here is placed from that, not
  // from the untransformed box.
  const inset = (s: number) => (1 - s) / 2;

  const focus = {
    x: (box.w - ow) / 2,
    y: 78 + (box.h - 78 - 40 - oh) / 2,
  };
  const deck = (i: number) => ({
    x: box.w - 14 - ow * (1 - inset(deckScale)) + (i - dealt - 1) * 3,
    y: box.h - 14 - oh * (1 - inset(deckScale)) - (i - dealt - 1) * 3,
    rotate: (i - dealt - 1) * 2,
    scale: deckScale,
  });
  const rail = (i: number) => ({
    x: box.w / 2 + (i - 2) * ow * railScale * 1.15 - ow / 2,
    y: 8 - oh * inset(railScale),
    rotate: 0,
    scale: railScale,
  });

  const canDeal = dealt < hand.length - 1 && (dealt < 0 || revealed[dealt]);

  return (
    <Stage dialogExpanded={dialogExpanded}>
      <div ref={ref} className="relative flex-1 overflow-hidden">
        {box.w > 0 &&
          hand.map((data, i) => {
            const to =
              i < dealt
                ? rail(i)
                : i === dealt
                  ? { ...focus, rotate: 0, scale: 1 }
                  : deck(i);
            return (
              <motion.div
                key={i}
                className="absolute left-0 top-0"
                style={{ zIndex: i <= dealt ? 20 - i : 10 - i }}
                initial={false}
                animate={to}
                transition={SETTLE}
              >
                <FlipCard
                  data={data}
                  cardW={cardW}
                  revealed={!!revealed[i]}
                  onTap={() =>
                    i === dealt ? reveal(i) : canDeal && setDealt(dealt + 1)
                  }
                />
              </motion.div>
            );
          })}
        <p className="pointer-events-none absolute bottom-3 left-3 max-w-[55%] font-sans text-[11px] text-brown_02/70">
          {dealt < 0
            ? 'tap the deck to draw'
            : !revealed[dealt]
              ? 'tap the card to turn it'
              : dealt < hand.length - 1
                ? `tap the deck · ${hand.length - dealt - 1} left`
                : 'all five drawn'}
        </p>
      </div>
    </Stage>
  );
};
VariantB.title = 'B · stacked deck, dealt one at a time';

/* ------------------------------------------------------------------ C ---- */
/**
 * 2+3 grid. Every card is on screen at its full size with no gesture, no mode
 * and no scroll; the gaps are sized so a card at the top of its flip (scale
 * 1.08 plus perspective on the 40px z-lift) never touches its neighbour.
 */
export const VariantC: Variant = ({
  hand,
  revealed,
  reveal,
  dialogExpanded,
}) => {
  const [ref, box] = useBox<HTMLDivElement>();
  const cardW = fitCard(box.w, box.h, 3, 2);

  const row = (indices: number[]) => (
    <div className="flex justify-center" style={{ gap: GAP }}>
      {indices.map(i => (
        <FlipCard
          key={i}
          data={hand[i]}
          cardW={cardW}
          revealed={!!revealed[i]}
          onTap={() => reveal(i)}
        />
      ))}
    </div>
  );

  return (
    <Stage dialogExpanded={dialogExpanded}>
      <div
        ref={ref}
        className="flex flex-1 flex-col items-center justify-center"
        style={{ gap: GAP }}
      >
        {box.w > 0 && (
          <>
            {row([0, 1])}
            {row([2, 3, 4])}
          </>
        )}
      </div>
    </Stage>
  );
};
VariantC.title = 'C · 2+3 grid';

/* ------------------------------------------------------------------ D ---- */
/**
 * The current scroller done properly: centre snap points, side padding so the
 * first and last card can reach the middle, a peek of the neighbours, and dots
 * for position. Vertical padding is what buys the flip its room — an
 * `overflow-x` container clips on the y axis too.
 */
export const VariantD: Variant = ({
  hand,
  revealed,
  reveal,
  dialogExpanded,
}) => {
  const [ref, box] = useBox<HTMLDivElement>();
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  // One card at a time can afford to be larger than the grid's, and it has to
  // be: 58% of the width is what leaves a readable peek on both sides.
  const cardW = Math.max(
    56,
    Math.min(Math.round(box.w * 0.58), fitCard(box.w, box.h - 40, 1, 1) * 1.6, 150)
  );
  const ow = outerW(cardW);
  const peek = Math.max(0, (box.w - ow) / 2);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () =>
      setActive(Math.round(el.scrollLeft / (ow + GAP)));
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [ow]);

  return (
    <Stage dialogExpanded={dialogExpanded}>
      <div ref={ref} className="flex flex-1 flex-col justify-center">
        <div
          ref={scroller}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain py-7"
          style={{ gap: GAP, paddingLeft: peek, paddingRight: peek }}
        >
          {box.w > 0 &&
            hand.map((data, i) => (
              <div key={i} className="shrink-0 snap-center">
                <FlipCard
                  data={data}
                  cardW={cardW}
                  revealed={!!revealed[i]}
                  onTap={() => reveal(i)}
                />
              </div>
            ))}
        </div>
        <div className="mt-1 flex justify-center gap-2">
          {hand.map((_, i) => (
            <span
              key={i}
              className={
                'h-1.5 w-1.5 rounded-full ' +
                (i === active
                  ? 'bg-brown_02'
                  : revealed[i]
                    ? 'bg-brown_02/50'
                    : 'bg-brown_02/20')
              }
            />
          ))}
        </div>
      </div>
    </Stage>
  );
};
VariantD.title = 'D · snap scroller with peek';

/* ------------------------------------------------------------------ E ---- */
/**
 * C's grid with A's fan demoted from a mode to the deal itself: the hand
 * arrives fanned and settles into the grid on its own. Every card is reachable
 * from the first frame the visitor can act, and the fan still gets to be the
 * thing that reads as a hand. Tap the backdrop to re-deal.
 */
export const VariantE: Variant = ({
  hand,
  revealed,
  reveal,
  dialogExpanded,
}) => {
  const [ref, box] = useBox<HTMLDivElement>();
  const [settled, setSettled] = useState(false);
  const cardW = fitCard(box.w, box.h, 3, 2);
  const ow = outerW(cardW);
  const oh = outerH(cardW) + LABEL_H;

  useEffect(() => {
    if (settled) return;
    const t = setTimeout(() => setSettled(true), 650);
    return () => clearTimeout(t);
  }, [settled]);

  const gridH = 2 * oh + GAP;
  const top = (box.h - gridH) / 2;

  const place = (i: number) => {
    if (!settled) {
      return {
        x: box.w / 2 + (i - 2) * ow * 0.4 - ow / 2,
        y: box.h - oh - 8 + Math.abs(i - 2) * 9,
        rotate: (i - 2) * 8,
      };
    }
    const row = i < 2 ? 0 : 1;
    const cols = row === 0 ? 2 : 3;
    const col = row === 0 ? i : i - 2;
    const width = cols * ow + (cols - 1) * GAP;
    return {
      x: (box.w - width) / 2 + col * (ow + GAP),
      y: top + row * (oh + GAP),
      rotate: 0,
    };
  };

  return (
    <Stage dialogExpanded={dialogExpanded}>
      <div
        ref={ref}
        className="relative flex-1 overflow-hidden"
        onClick={() => setSettled(false)}
      >
        {box.w > 0 &&
          hand.map((data, i) => (
            <motion.div
              key={i}
              className="absolute left-0 top-0"
              style={{ zIndex: settled ? 1 : 10 - Math.abs(i - 2) }}
              initial={false}
              animate={place(i)}
              transition={SETTLE}
              onClick={e => e.stopPropagation()}
            >
              <FlipCard
                data={data}
                cardW={cardW}
                revealed={!!revealed[i]}
                onTap={() => reveal(i)}
              />
            </motion.div>
          ))}
      </div>
    </Stage>
  );
};
VariantE.title = 'E · grid, dealt as a fan that settles';
