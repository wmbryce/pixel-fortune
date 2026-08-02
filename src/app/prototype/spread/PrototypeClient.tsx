'use client';
/**
 * PROTOTYPE — four mobile spread layouts on one page, switchable via
 * `?variant=`, plus `?bg=` for the three background treatments, so both
 * questions can be judged back to back on the same hand. Answers #14.
 * Delete this whole route when the winner lands.
 *
 * Its own route rather than `/tarot?variant=`: comparing needs the same hand
 * re-hidden on demand, and a real deal costs API budget. No NODE_ENV gate on
 * the switcher — the owner has to be able to use it on a deployed build.
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TarotDeck } from '@/server/data/tarot-deck';
import { CardType } from '@/types';
import {
  VariantA,
  VariantB,
  VariantC,
  VariantD,
  VariantE,
  type Variant,
} from './variants';
import './prototype.css';

const HAND: CardType[] = [0, 1, 2, 6, 13].map(i => TarotDeck[i]);

const VARIANTS: Record<string, Variant> = {
  A: VariantA,
  B: VariantB,
  C: VariantC,
  D: VariantD,
  E: VariantE,
};
const KEYS = Object.keys(VARIANTS);
const BGS = ['today', 'scene', 'zoom'];

export default function PrototypeClient() {
  const router = useRouter();
  const params = useSearchParams();
  const key = KEYS.includes(params.get('variant') ?? '')
    ? (params.get('variant') as string)
    : 'A';
  const bg = BGS.includes(params.get('bg') ?? '')
    ? (params.get('bg') as string)
    : 'zoom';
  const Variant = VARIANTS[key];

  const [revealed, setRevealed] = useState<boolean[]>(HAND.map(() => false));
  const [dialogExpanded, setDialogExpanded] = useState(true);

  const go = useCallback(
    (next: string, nextBg: string) => {
      router.replace(`/prototype/spread?variant=${next}&bg=${nextBg}`);
    },
    [router]
  );

  const cycle = useCallback(
    (step: number) => {
      go(KEYS[(KEYS.indexOf(key) + step + KEYS.length) % KEYS.length], bg);
      setRevealed(HAND.map(() => false));
    },
    [key, bg, go]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') cycle(-1);
      if (e.key === 'ArrowRight') cycle(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cycle]);

  return (
    <main className={`pf-bg pf-bg--${bg} flex h-[100dvh] flex-col overflow-hidden`}>
      <div className="z-50 flex shrink-0 items-center gap-1 bg-black/70 px-2 py-1 font-normal text-[11px] text-white">
        <button onClick={() => cycle(-1)} className="px-2" aria-label="previous">
          ←
        </button>
        <span className="flex-1 truncate">{Variant.title}</span>
        <button onClick={() => cycle(1)} className="px-2" aria-label="next">
          →
        </button>
        <button
          onClick={() => go(key, BGS[(BGS.indexOf(bg) + 1) % BGS.length])}
          className="rounded bg-white/20 px-2 py-0.5"
        >
          bg:{bg}
        </button>
        <button
          onClick={() => setDialogExpanded(v => !v)}
          className="rounded bg-white/20 px-2 py-0.5"
        >
          dialog:{dialogExpanded ? '256' : '64'}
        </button>
        <button
          onClick={() => setRevealed(HAND.map(() => false))}
          className="rounded bg-white px-2 py-0.5 text-black"
        >
          re-hide
        </button>
      </div>

      <div className="min-h-0 flex-1">
        <Variant
          key={key}
          hand={HAND}
          revealed={revealed}
          reveal={i =>
            setRevealed(prev => prev.map((r, j) => (j === i ? true : r)))
          }
          dialogExpanded={dialogExpanded}
        />
      </div>
    </main>
  );
}
