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
 *
 * That entrance is CSS (`page-transition.css`), not motion's `initial`. Motion
 * would have the server inline `opacity: 0` on every document and make the page
 * visible only once it hydrates; the entrance is an enhancement over a page that
 * is already on screen, so it must not be the thing that puts it there. Motion
 * owns the exit, which by definition only exists after hydration.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { motion, useMotionValue } from 'motion/react';
import { useReducedMotionPref } from '../_libs/settings';
import { useRouter } from 'next/navigation';
import { CROSSFADE, DURATION, EASE_OUT } from '../_libs/motion';
import './page-transition.css';

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

export const VARIANTS = {
  /**
   * Both the resting state and what the server inlines, so it has to be the
   * visible one. The entrance that used to live here is in the stylesheet.
   */
  enter: { opacity: 1, scale: 1, transition: PAGE },
  exitForward: { opacity: 0, scale: 1.03, transition: PAGE },
  exitBack: { opacity: 0, scale: 0.98, transition: PAGE },
};

/**
 * Same seams, no travel: the fade is what survives the preference.
 *
 * `scale: 1` is stated rather than omitted, and it is load-bearing. The server
 * cannot read the preference — `useReducedMotion()` is false there — so every
 * document is delivered carrying whatever `initial` resolves to under full
 * motion. Leaving `scale` out of these gives the client nothing to write over
 * it, and the page keeps a scale it never asked for. Caught in the browser on
 * the entrance; it is the same trap on the exit.
 */
export const REDUCED_VARIANTS = {
  enter: { opacity: 1, scale: 1, transition: CROSSFADE },
  exitForward: { opacity: 0, scale: 1, transition: CROSSFADE },
  exitBack: { opacity: 0, scale: 1, transition: CROSSFADE },
};

/** Stable identity, so the warm-on-mount effect does not re-run every render. */
const NOTHING: readonly string[] = [];

type Props = {
  children: ReactNode;
  className?: string;
  /**
   * Routes this screen can leave to, warmed on mount. The exit is only ~240ms
   * long, which is not enough of a head start for a cold route to arrive
   * inside it.
   */
  prefetch?: readonly string[];
};

/** Renders the page's own `<main>`, so this adds no element to the tree. */
export default function PageTransition({
  children,
  className,
  prefetch = NOTHING,
}: Props) {
  const router = useRouter();
  const reduced = useReducedMotionPref();
  const main = useRef<HTMLElement>(null);
  // The exit's opacity is a value rather than a plain variant key so it can be
  // seeded from the screen before it animates; see `leave`.
  const opacity = useMotionValue(1);
  const [exit, setExit] = useState<{
    href: string;
    direction: Direction;
  } | null>(null);

  useEffect(() => {
    prefetch.forEach(href => router.prefetch(href));
  }, [router, prefetch]);

  const leave = useCallback<Leave>(
    (href, direction = 'forward') => {
      // Cheap and idempotent, and it covers a destination the screen did not
      // declare; the declared ones are already warm from mount.
      router.prefetch(href);
      // A keypress can land while the CSS entrance is still running, and the
      // next render takes that animation away — so carry over what is actually
      // on screen at this instant. Motion otherwise starts the exit from the
      // `1` it last wrote, which is a jump to full brightness first.
      const live = main.current && getComputedStyle(main.current).opacity;
      if (live && Number.isFinite(Number(live))) opacity.set(Number(live));
      // First call wins. A second key press during the exit must not restart
      // it or redirect it somewhere else.
      setExit(current => current ?? { href, direction });
    },
    [router, opacity]
  );

  const target = exit
    ? exit.direction === 'back'
      ? 'exitBack'
      : 'exitForward'
    : 'enter';

  // Dropped once the exit starts: a *running* CSS animation outranks motion's
  // inline styles, so an exit that interrupted the entrance would not show at
  // all until the entrance's 240ms were up. Nothing is pinned after that —
  // the animation fills backwards only.
  const classes = [exit ? null : 'page-enter', className]
    .filter(Boolean)
    .join(' ');

  return (
    <LeaveContext.Provider value={leave}>
      <motion.main
        ref={main}
        style={{ opacity }}
        className={classes}
        variants={reduced ? REDUCED_VARIANTS : VARIANTS}
        initial="enter"
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
