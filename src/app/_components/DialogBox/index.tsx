'use client';

import React, {
  useState,
  useEffect,
  useRef,
  Dispatch,
  SetStateAction,
} from 'react';
import { trpc } from '../../_trpc/client';
import { DialogButton } from '../DialogButton';
import { RESET_MESSAGE, WELCOME_MESSAGE, REVEAL_MESSAGE } from './data';
import TypingText from '../TypingText';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from 'motion/react';
import { CardType } from '@/types';
import { cn } from '../../_libs/utils';
import { usePageLeave } from '../PageTransition';
import { CROSSFADE, DURATION, SPRING } from '../../_libs/motion';

type tableStateType = {
  label: string;
  body: string;
  action: () => void;
};

type Props = {
  tarotHand: CardType[];
  /** Opaque handle from the deal; the server resolves the reading from it. */
  readingToken: string;
  allRevealed: boolean;
  fetchHand: boolean;
  setFetchHand: Dispatch<SetStateAction<boolean>>;
  resetData: () => void;
  stateIndex: number;
  setStateIndex: Dispatch<SetStateAction<number>>;
};

function DialogBox({
  tarotHand,
  readingToken,
  allRevealed,
  fetchHand,
  setFetchHand,
  resetData,
  stateIndex,
  setStateIndex,
}: Props) {
  const [skip, setSkip] = useState<boolean>(false);
  const [typingComplete, setTypingComplete] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<null | string>(null);
  // Counted rather than watched: pressing Continue again while still blocked
  // sets the same string, and an effect on the text alone would not fire twice.
  const [blocked, setBlocked] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);

  const reduced = useReducedMotion() ?? false;
  const leave = usePageLeave();
  const shakeX = useMotionValue(0);

  // Refusing to continue used to move nothing at all — the prose appeared and
  // that was the whole answer (audit, missed opportunity 3). Reduced motion
  // keeps the prose and skips the shake, which is pure vestibular noise.
  useEffect(() => {
    if (!blocked || reduced) return;
    const controls = animate(shakeX, [0, -8, 8, -5, 5, 0], {
      duration: DURATION.shake,
      ease: 'easeOut',
    });
    return () => controls.stop();
  }, [blocked, reduced, shakeX]);

  const {
    mutate: fetchFortune,
    isPending,
  } = trpc.getFortune.useMutation({
    onSettled: data => {
      let textArray: string[] = [];
      if (typeof data === 'string') {
        textArray = data?.split(/\n\s*\n+/);
      }
      setDialogStates(generateTableStates(textArray));
    },
  });

  const startState = [
    {
      label: 'Draw Hand',
      body: WELCOME_MESSAGE,
      action: () => {
        setFetchHand(true);
        setDialogStates([]);
      },
    },
  ];
  const reveal = {
    label: 'Continue',
    body: REVEAL_MESSAGE,
    action: () => {
      setStateIndex(1);
    },
  };

  const [dialogStates, setDialogStates] = useState<tableStateType[]>([]);

  useEffect(() => {
    setTimeout(() => {
      setDialogStates(startState);
    }, 1000);
  }, []);

  const generateTableStates = (textArray: string[]): tableStateType[] => {
    const mid = textArray.map((text, index) => {
      return {
        label: 'Continue',
        body: text,
        action: () => {
          setStateIndex(index + 2);
        },
      };
    });
    const tail = [
      {
        label: 'Complete',
        body: RESET_MESSAGE,
        action: () => {
          setDialogStates(startState);
          setStateIndex(0);
          resetData();
          // Back out the way we came in, and let the transition play before the
          // route changes under it.
          leave('/welcome', 'back');
        },
      },
    ];

    return [reveal, ...mid, ...tail];
  };

  useEffect(() => {
    if (tarotHand.length === 5) {
      fetchFortune({ token: readingToken });
      setFetchHand(false);
      // The fortune can settle before this fires; the placeholder must never
      // clobber a reading that has already arrived.
      const revealTimer = setTimeout(() => {
        setDialogStates(prev => (prev.length > 0 ? prev : [reveal]));
      }, 2200);
      return () => clearTimeout(revealTimer);
    }
  }, [tarotHand]);

  useEffect(() => {
    const dialogButton = document.getElementById('dialogButton');
    const nextKeyPress = () => {
      if (!isPending) {
        if (!skip && !typingComplete) {
          setSkip(true);
          setErrorText(null);
        } else {
          if (!allRevealed && tarotHand.length === 5) {
            setErrorText(
              'You must reveal all the cards before you can continue!'
            );
            setBlocked(n => n + 1);
          } else {
            dialogStates?.[stateIndex]?.action();
            setSkip(false);
            setErrorText(null);
          }
        }
      }
    };
    window.addEventListener('keydown', nextKeyPress);
    dialogButton?.addEventListener('click', nextKeyPress);
    return () => {
      window.removeEventListener('keydown', nextKeyPress);
      dialogButton?.removeEventListener('click', nextKeyPress);
    };
  }, [stateIndex, skip, dialogStates, typingComplete, isPending, allRevealed]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [scrollRef?.current?.scrollHeight]);

  /**
   * The box slides up from below and grows once it has something to say. All
   * three of these used to be `{ duration: 1, type: 'spring' }` — a real 1000ms
   * each, measured (audit finding #3) — and now come from the tokens.
   *
   * `height` is still on the timeline, so this still costs layout every frame.
   * The strip it grows inside is reserved (`tarot/page.tsx`), so nothing else
   * on the page moves with it, but the swap to a transform belongs with the
   * rebuild in #16 rather than here: the 8px pixel border and the typewriter's
   * scroll box both distort under a `scaleY`.
   *
   * Reduced motion drops the 200% travel and cross-fades the box in on the
   * spot; the height still changes, because that is the box telling you it now
   * holds a reading rather than a spinner.
   */
  const dialogVariants = reduced
    ? ({
        hidden: { y: '0%', opacity: 0, height: '64px' },
        loading: { y: '0%', opacity: 1, height: '64px', transition: CROSSFADE },
        visible: { y: '0%', opacity: 1, height: '256px', transition: CROSSFADE },
      } as const)
    : ({
        hidden: { y: '200%', opacity: 1, height: '64px' },
        loading: {
          y: '0%',
          opacity: 1,
          height: '64px',
          transition: { y: SPRING.arrive },
        },
        visible: {
          y: '0%',
          opacity: 1,
          height: '256px', // equivalent to h-64
          transition: { height: SPRING.settle, y: SPRING.arrive },
        },
      } as const);

  return (
    <motion.div
      style={{ x: shakeX }}
      className={cn(
        'relative flex flex-col flex-1 w-[100%] items-center opacity-[90%]'
      )}
    >
      <motion.div
        className="flex flex-col justify-between w-[100%] bg-brown_02 border-brown_01 border-8 text-brown_03 overflow-y-scroll rounded-md mt-6"
        variants={dialogVariants}
        initial="hidden"
        animate={dialogStates?.length === 0 ? 'loading' : 'visible'}
      >
        <div ref={scrollRef} className="flex px-8 pt-8 pb-16 overflow-y-auto">
          <TypingText
            ref={scrollRef}
            text={dialogStates?.[stateIndex]?.body ?? ''}
            delay={stateIndex === 0 || stateIndex === 1 ? 1600 : 200}
            skip={skip}
            setTypingComplete={setTypingComplete}
          />
        </div>
        {/* The one `AnimatePresence` in here with a child that actually comes
            and goes. The two that wrapped permanently-mounted elements, and the
            `layoutId` with nothing to travel between, are gone (finding #11). */}
        <AnimatePresence>
          {(skip || typingComplete) && (
            <motion.div
              // Was `{ duration: 2, type: 'spring' }` — a real 2000ms settle on
              // the app's primary control (finding #9).
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: '100%' }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, y: '0%' }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: '100%' }}
              className="flex flex-row items-center border-t-[2px] border-brown_01 justify-end bg-[#FFFFFF00] p-2 text-brown_02 font-sans"
              transition={reduced ? CROSSFADE : SPRING.snap}
            >
              {!!errorText && (
                <p className="font-sans mr-4 text-brown_03">{errorText}</p>
              )}
              <DialogButton id={'dialogButton'} loading={isPending}>
                {dialogStates?.[stateIndex]?.label}
              </DialogButton>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

export default DialogBox;
