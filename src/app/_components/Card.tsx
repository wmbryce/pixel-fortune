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
  useReducedMotion,
  useTransform,
} from 'motion/react';
import { useHoverCapable } from '../_libs/media';
import { CROSSFADE, SPRING } from '../_libs/motion';

interface Props extends HTMLMotionProps<'div'> {
  id: string;
  index: number;
  /** Art width in px. The table derives it from the space it has (#14). */
  width: number;
  data?: CardType | null;
  reveal?: boolean;
  setReveal: (value: number) => void;
}

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
  const reduced = useReducedMotion() ?? false;
  const hoverable = useHoverCapable();

  // The back faces the viewer at 0deg and the front at 180deg, so the card
  // turns back along the axis it came from.
  const rotateY = useMotionValue(0);
  // Under reduced motion the card does not turn at all; the back cross-fades
  // off the front, which is stacked underneath it. Rotation is the travel that
  // the preference asks us to drop — the reveal itself is not.
  const backOpacity = useMotionValue(1);
  // Lift derived from the rotation rather than scheduled beside it: an
  // interrupted flip cannot leave the card stranded off the table. Clamped to
  // the flip's own range so an overshoot could never invert it into a dip.
  // It comes out at 0 under reduced motion, because the rotation stays at 0.
  const lift = useTransform(rotateY, r =>
    Math.sin((Math.min(Math.max(r, 0), 180) * Math.PI) / 180)
  );
  const scale = useTransform(lift, l => 1 + 0.08 * l);
  const z = useTransform(lift, l => 40 * l);

  useEffect(() => {
    const controls = reduced
      ? animate(backOpacity, reveal ? 0 : 1, CROSSFADE)
      : animate(rotateY, reveal ? 180 : 0, SPRING.flip);
    return () => controls.stop();
  }, [reduced, reveal, rotateY, backOpacity]);

  const revealCard = () => {
    if (!reveal) props.setReveal(props.index);
  };

  // Colour and opacity only, so these read the same either way and take the
  // cross-fade token unconditionally.
  const backgroundVariants = {
    hidden: { backgroundColor: '#0B001200', transition: CROSSFADE },
    visible: { backgroundColor: '#0B0012B0', transition: CROSSFADE },
  };

  const textVariants = {
    hidden: { opacity: 0, transition: CROSSFADE },
    visible: { opacity: 1, transition: CROSSFADE },
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
          whileHover={
            hoverable && !reduced ? { y: -10, transition: SPRING.nudge } : undefined
          }
          // Press feedback survives reduced motion as a dim rather than a lift:
          // a tap that registers nothing at all is the one thing a disable
          // would cost.
          whileTap={
            reduced
              ? { opacity: 0.75, transition: CROSSFADE }
              : { y: -4, transition: SPRING.nudge }
          }
          style={{ transformStyle: 'preserve-3d', rotateY, scale, z }}
          className={cn('relative select-none', props.className)}
        >
          <div
            className="bg-white rounded-md p-2"
            // Pre-rotated so the flip lands on it. Reduced motion never turns
            // the card, so the front has to face the viewer from the start and
            // let the back fade off it instead.
            style={
              reduced
                ? undefined
                : { backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }
            }
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
          <motion.div
            id={'back.' + id}
            className="absolute inset-0 bg-white rounded-md p-2"
            style={{
              backfaceVisibility: reduced ? 'visible' : 'hidden',
              opacity: reduced ? backOpacity : 1,
            }}
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
          </motion.div>
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
