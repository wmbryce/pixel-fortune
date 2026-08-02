'use client';
import { CardType } from '@/types';
import Image from 'next/image';
import { useEffect } from 'react';
import { cn } from '../_libs/utils';
import {
  animate,
  motion,
  HTMLMotionProps,
  useMotionValue,
  useTransform,
} from 'motion/react';

interface Props extends HTMLMotionProps<'div'> {
  id: string;
  index: number;
  /** Art width in px. The table derives it from the space it has (#14). */
  width: number;
  data?: CardType | null;
  reveal?: boolean;
  setReveal: (value: number) => void;
}

const FLIP = { type: 'spring', bounce: 0, duration: 0.4 } as const;
const HOVER = { type: 'spring', bounce: 0, duration: 0.2 } as const;

/** `p-2` on the white frame plus `p-2` on the tint, both sides. */
export const CHROME = 32;
export const LABEL_H = 22;

/**
 * The name is unreadable under a small card, and dropping its row is the
 * difference between the spread fitting a short viewport and not. Screen
 * readers still get the name from the front face's `alt`.
 */
export const LABEL_MIN_CARD = 64;
export const showsLabel = (width: number) => width >= LABEL_MIN_CARD;

/** What a card occupies once framed, tinted and captioned. */
export const cardCell = (width: number) => ({
  width: width + CHROME,
  height:
    Math.round(width * 1.5) + CHROME + (showsLabel(width) ? LABEL_H : 0),
});

export default function Card(props: Props) {
  const { id, data, reveal, width } = props;

  // The back faces the viewer at 0deg and the front at 180deg, so the card
  // turns back along the axis it came from.
  const rotateY = useMotionValue(0);
  // Lift derived from the rotation rather than scheduled beside it: an
  // interrupted flip cannot leave the card stranded off the table. Clamped to
  // the flip's own range so an overshoot could never invert it into a dip.
  const lift = useTransform(rotateY, r =>
    Math.sin((Math.min(Math.max(r, 0), 180) * Math.PI) / 180)
  );
  const scale = useTransform(lift, l => 1 + 0.08 * l);
  const z = useTransform(lift, l => 40 * l);

  useEffect(() => {
    const controls = animate(rotateY, reveal ? 180 : 0, FLIP);
    return () => controls.stop();
  }, [reveal, rotateY]);

  const revealCard = () => {
    if (!reveal) props.setReveal(props.index);
  };

  const backgroundVariants = {
    hidden: { backgroundColor: '#0B001200' },
    visible: { backgroundColor: '#0B0012B0' },
  };

  const textVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const artHeight = Math.round(width * 1.5);

  return !!data ? (
    <motion.div
      id={'background.' + id}
      variants={backgroundVariants}
      initial="hidden"
      animate={reveal ? 'visible' : 'hidden'}
      style={{ width: cardCell(width).width }}
      className="bg-brown_04 flex flex-col rounded-md p-2"
    >
      <div style={{ perspective: 1000 }}>
        <motion.div
          id={props.id}
          onClick={revealCard}
          whileHover={{ y: -10, transition: HOVER }}
          whileTap={{ y: -4, transition: HOVER }}
          style={{ transformStyle: 'preserve-3d', rotateY, scale, z }}
          className={cn('relative select-none', props.className)}
        >
          <div
            className="bg-white rounded-md p-2"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <div
              className="relative"
              style={{ width, height: artHeight }}
            >
              <Image
                fill
                className="object-cover rounded-sm"
                src={'/assets/cards/' + data.image}
                alt={data.name}
                sizes={`${Math.ceil(width)}px`}
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
                sizes={`${Math.ceil(width)}px`}
              />
            </div>
          </div>
        </motion.div>
      </div>
      {showsLabel(width) && (
        <motion.div
          className="text-brown_02 text-center font-sans text-xs line-clamp-1"
          style={{ height: LABEL_H, lineHeight: `${LABEL_H}px` }}
          variants={textVariants}
          initial="hidden"
          animate={reveal ? 'visible' : 'hidden'}
        >
          {data.name}
        </motion.div>
      )}
    </motion.div>
  ) : null;
}
