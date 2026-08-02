'use client';
/**
 * Route changes were hard swaps: `router.push` fired immediately and a 3s
 * linear keyframe fade played over whatever arrived (audit finding #7 and
 * missed opportunities 1 and 4). The two moments it covered — walking into the
 * reading and closing the loop back out — are the most spatially meaningful in
 * the app and had no motion explaining either.
 *
 * So the push is deferred until the outgoing screen has actually left, and the
 * direction is carried on the call: forward pushes past the viewer, back
 * recedes from them, mirroring each other the way the arc does.
 *
 * The entrance is the same either way. A screen cannot know which direction it
 * was arrived at from without stashing that across a navigation, and a
 * hydration-safe place to stash it does not exist here — an entrance that reads
 * as "settling into place" is right for both.
 */
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { CROSSFADE, DURATION, EASE_OUT } from '../_libs/motion';

type Direction = 'forward' | 'back';
type Leave = (href: string, direction?: Direction) => void;

const LeaveContext = createContext<Leave | null>(null);

/**
 * Navigate with the exit animation. Outside a `PageTransition` it falls back to
 * a plain push rather than doing nothing, so a caller can never strand the
 * visitor on a screen it meant to leave.
 */
export function usePageLeave(): Leave {
  const router = useRouter();
  const leave = useContext(LeaveContext);
  const push = useCallback<Leave>(href => router.push(href), [router]);
  return leave ?? push;
}

const PAGE = { duration: DURATION.page, ease: EASE_OUT };

const VARIANTS = {
  enterFrom: { opacity: 0, scale: 0.985 },
  enter: { opacity: 1, scale: 1, transition: PAGE },
  exitForward: { opacity: 0, scale: 1.03, transition: PAGE },
  exitBack: { opacity: 0, scale: 0.98, transition: PAGE },
};

/** Same seams, no scale: the fade is what survives the preference. */
const REDUCED_VARIANTS = {
  enterFrom: { opacity: 0 },
  enter: { opacity: 1, transition: CROSSFADE },
  exitForward: { opacity: 0, transition: CROSSFADE },
  exitBack: { opacity: 0, transition: CROSSFADE },
};

type Props = {
  children: ReactNode;
  className?: string;
};

/** Renders the page's own `<main>`, so this adds no element to the tree. */
export default function PageTransition({ children, className }: Props) {
  const router = useRouter();
  const reduced = useReducedMotion() ?? false;
  const [exit, setExit] = useState<{
    href: string;
    direction: Direction;
  } | null>(null);

  const leave = useCallback<Leave>(
    (href, direction = 'forward') => {
      // Warmed here rather than on mount: by the time the exit has played the
      // route should already be in the client cache, so the seam is motion,
      // not a stall.
      router.prefetch(href);
      // First call wins. A second key press during the exit must not restart
      // it or redirect it somewhere else.
      setExit(current => current ?? { href, direction });
    },
    [router]
  );

  const target = exit
    ? exit.direction === 'back'
      ? 'exitBack'
      : 'exitForward'
    : 'enter';

  return (
    <LeaveContext.Provider value={leave}>
      <motion.main
        className={className}
        variants={reduced ? REDUCED_VARIANTS : VARIANTS}
        initial="enterFrom"
        animate={target}
        onAnimationComplete={definition => {
          if (exit && typeof definition === 'string' && definition !== 'enter')
            router.push(exit.href);
        }}
      >
        {children}
      </motion.main>
    </LeaveContext.Provider>
  );
}
