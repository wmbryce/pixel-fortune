'use client';
/**
 * PROTOTYPE — three card-reveal variants on one page, switchable via
 * `?variant=`, so they can be compared back to back on the same cards.
 * Answers #13. Delete this whole route when the winner lands.
 *
 * Its own route rather than `/tarot?variant=`: comparing needs the same hand
 * re-hidden on demand, and a real deal costs API budget and cannot be undone.
 * No NODE_ENV gate on the switcher — the preview build is a production build,
 * and the owner has to be able to use it there.
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TarotDeck } from '@/server/data/tarot-deck';
import { CardType } from '@/types';
import { VariantA, VariantB, VariantC, VariantProps } from './variants';
import '../../tarot/background.css';

const HAND: CardType[] = [0, 1, 2, 6, 13].map(i => TarotDeck[i]);

const VARIANTS: Record<string, React.ComponentType<VariantProps> & { title?: string }> = {
  A: VariantA,
  B: VariantB,
  C: VariantC,
};
const KEYS = Object.keys(VARIANTS);

export default function PrototypeClient() {
  const router = useRouter();
  const params = useSearchParams();
  const key = KEYS.includes(params.get('variant') ?? '')
    ? (params.get('variant') as string)
    : 'A';
  const Variant = VARIANTS[key];

  const [revealed, setRevealed] = useState<boolean[]>(HAND.map(() => false));

  const cycle = useCallback(
    (step: number) => {
      const next = KEYS[(KEYS.indexOf(key) + step + KEYS.length) % KEYS.length];
      router.replace(`/prototype/reveal?variant=${next}`);
      setRevealed(HAND.map(() => false));
    },
    [key, router]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /input|textarea/i.test(t.tagName)) return;
      if (e.key === 'ArrowLeft') cycle(-1);
      if (e.key === 'ArrowRight') cycle(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cycle]);

  return (
    <main className="flex min-h-screen flex-col bg-black_01">
      <div className="custom-background flex flex-col min-h-screen justify-center">
        <div className="flex flex-row justify-center flex-wrap">
          {HAND.map((data, i) => (
            <Variant
              key={`${key}-${i}`}
              data={data}
              revealed={revealed[i]}
              onRevealChange={v =>
                setRevealed(prev => prev.map((r, j) => (j === i ? v : r)))
              }
            />
          ))}
        </div>
      </div>

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full bg-white text-black px-4 py-2 shadow-lg font-normal text-sm">
        <button onClick={() => cycle(-1)} className="px-2" aria-label="previous">
          ←
        </button>
        <span className="whitespace-nowrap">
          {Variant.title ?? key} · revealed {revealed.filter(Boolean).length}/
          {HAND.length}
        </span>
        <button onClick={() => cycle(1)} className="px-2" aria-label="next">
          →
        </button>
        <button
          onClick={() => setRevealed(HAND.map(() => false))}
          className="rounded-full bg-black text-white px-3 py-1"
        >
          re-hide
        </button>
      </div>
    </main>
  );
}
