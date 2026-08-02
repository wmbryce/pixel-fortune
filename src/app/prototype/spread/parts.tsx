'use client';
/**
 * PROTOTYPE — pieces every spread variant shares. Answers #14.
 * Delete this whole route when the winner lands.
 *
 * `FlipCard` is the production reveal (#13) with a caller-supplied size: the
 * point of this prototype is how a layout survives a card that really flips,
 * so the spring, the derived lift and the two mounted faces are copied intact.
 */
import Image from 'next/image';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { CardType } from '@/types';

const FLIP = { type: 'spring', bounce: 0, duration: 0.4 } as const;
const HOVER = { type: 'spring', bounce: 0, duration: 0.2 } as const;

/** White frame padding (`p-2`) around the art, per card side. */
export const FRAME = 16;
/** Height of the card-name caption under a card. */
export const LABEL_H = 22;
export const GAP = 14;

export const outerW = (cardW: number) => cardW + FRAME;
export const outerH = (cardW: number) => Math.round(cardW * 1.5) + FRAME;

/**
 * Largest card that fits `cols` x `rows` in the given box, bounded by the
 * production sizes (`w-24` mobile .. `xl:w-48`). Both axes matter: a phone in
 * landscape and an iPhone SE run out of height long before width.
 */
export function fitCard(
  w: number,
  h: number,
  cols: number,
  rows: number
): number {
  const byW = (w - GAP * (cols + 1)) / cols - FRAME;
  const byH = (h - GAP * (rows + 1)) / rows - FRAME - LABEL_H;
  return Math.max(56, Math.min(112, Math.floor(Math.min(byW, byH / 1.5))));
}

export function useBox<T extends HTMLElement>() {
  const ref = useRef<T>(null);
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
  return [ref as RefObject<T>, box] as const;
}

type CardProps = {
  data: CardType;
  cardW: number;
  revealed: boolean;
  onTap: () => void;
  label?: boolean;
};

export function FlipCard({
  data,
  cardW,
  revealed,
  onTap,
  label = true,
}: CardProps) {
  const rotateY = useMotionValue(0);
  const lift = useTransform(rotateY, r =>
    Math.sin((Math.min(Math.max(r, 0), 180) * Math.PI) / 180)
  );
  const scale = useTransform(lift, l => 1 + 0.08 * l);
  const z = useTransform(lift, l => 40 * l);

  useEffect(() => {
    const controls = animate(rotateY, revealed ? 180 : 0, FLIP);
    return () => controls.stop();
  }, [revealed, rotateY]);

  const h = Math.round(cardW * 1.5);

  return (
    <div style={{ width: outerW(cardW) }}>
      <div style={{ perspective: 1000 }}>
        <motion.div
          onClick={onTap}
          whileTap={{ y: -4, transition: HOVER }}
          style={{ transformStyle: 'preserve-3d', rotateY, scale, z }}
          className="relative select-none"
        >
          <div
            className="bg-white rounded-md p-2"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <div className="relative" style={{ width: cardW, height: h }}>
              <Image
                fill
                className="object-cover rounded-sm"
                src={'/assets/cards/' + data.image}
                alt={data.name}
                sizes="12rem"
              />
            </div>
          </div>
          <div
            className="absolute inset-0 bg-white rounded-md p-2"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="relative w-full h-full">
              <Image
                fill
                className="object-cover rounded-sm"
                src="/assets/cards/CardBack.png"
                alt="Card Back"
                sizes="12rem"
              />
            </div>
          </div>
        </motion.div>
      </div>
      {label && (
        <motion.div
          className="text-brown_02 text-center font-sans text-[11px] leading-[22px] line-clamp-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: revealed ? 1 : 0 }}
          style={{ height: LABEL_H }}
        >
          {data.name}
        </motion.div>
      )}
    </div>
  );
}

/**
 * Stand-in for the real dialog box, which #16 owns and this ticket must not
 * restructure. Only its two heights matter here — 64px collapsed while the
 * fortune loads, 256px with a message — because that is what a layout has to
 * survive without burying a card.
 */
export function DialogStandIn({ expanded }: { expanded: boolean }) {
  return (
    <motion.div
      className="w-full bg-brown_02 border-brown_01 border-8 text-brown_03 rounded-md opacity-90 overflow-hidden"
      animate={{ height: expanded ? 256 : 64 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
    >
      <p className="font-sans p-4 text-sm">
        {expanded
          ? 'The cards are laid before you. Turn each one, and the reading will follow…'
          : 'loading'}
      </p>
    </motion.div>
  );
}
