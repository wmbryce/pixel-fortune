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
  data?: CardType | null;
  reveal?: boolean;
  setReveal: (value: number) => void;
}

const FLIP = { type: 'spring', bounce: 0, duration: 0.4 } as const;
const HOVER = { type: 'spring', bounce: 0, duration: 0.2 } as const;

export default function Card(props: Props) {
  const { id, data, reveal } = props;

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

  return !!data ? (
    <motion.div
      id={'background.' + id}
      variants={backgroundVariants}
      initial="hidden"
      animate={reveal ? 'visible' : 'hidden'}
      className="z-0 top-0 left-2 bg-brown_04 flex flex-col justify-end rounded-md m-1 sm:m-2 md:m-3 lg:m-4 p-3"
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
            <div className="relative w-24 h-36 sm:w-32 sm:h-48 md:w-40 md:h-60 xl:w-48 xl:h-72">
              <Image
                fill
                className="object-cover rounded-sm"
                src={'/assets/cards/' + data.image}
                alt={data.name}
                sizes="(max-width: 640px) 6rem, (max-width: 768px) 8rem, (max-width: 1024px) 10rem, 12rem"
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
                sizes="(max-width: 640px) 6rem, (max-width: 768px) 8rem, (max-width: 1024px) 10rem, 12rem"
              />
            </div>
          </div>
        </motion.div>
      </div>
      <motion.div
        className="text-brown_02 align-center font-sans line-clamp-1"
        variants={textVariants}
        initial="hidden"
        animate={reveal ? 'visible' : 'hidden'}
      >
        {data.name}
      </motion.div>
    </motion.div>
  ) : null;
}
