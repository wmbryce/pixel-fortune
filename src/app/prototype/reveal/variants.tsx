'use client';
/**
 * PROTOTYPE — delete with the rest of /prototype/reveal once #13 is decided.
 * Three candidate reveal interactions for Card.tsx. Throwaway quality on
 * purpose: no tests, no reduced-motion, no keyboard (#18 owns that).
 */
import Image from 'next/image';
import { useRef } from 'react';
import { CardType } from '@/types';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import type { AnimationPlaybackControls } from 'motion/react';

export type VariantProps = {
  data: CardType;
  revealed: boolean;
  onRevealChange: (revealed: boolean) => void;
};

const FRAME =
  'relative w-24 h-36 sm:w-32 sm:h-48 md:w-40 md:h-60 xl:w-48 xl:h-72';

/** Back faces the viewer at 0deg, front at 180deg. */
function Faces({ data }: { data: CardType }) {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{ backfaceVisibility: 'hidden' }}
      >
        <Image
          fill
          className="object-cover rounded-md"
          src="/assets/cards/CardBack.png"
          alt="Card Back"
          sizes="12rem"
        />
      </div>
      <div
        className="absolute inset-0"
        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
      >
        <Image
          fill
          className="object-cover rounded-sm"
          src={'/assets/cards/' + data.image}
          alt={data.name}
          sizes="12rem"
        />
      </div>
    </>
  );
}

function Shell({
  children,
  data,
  revealed,
}: {
  children: React.ReactNode;
  data: CardType;
  revealed: boolean;
}) {
  return (
    <div className="p-2 m-1 sm:m-2 md:m-3 rounded-md bg-brown_04 flex flex-col justify-end select-none">
      <div className={FRAME} style={{ perspective: 1000 }}>
        {children}
      </div>
      <div
        className="text-brown_02 font-sans line-clamp-1 h-6 transition-opacity duration-200"
        style={{ opacity: revealed ? 1 : 0 }}
      >
        {data.name}
      </div>
    </div>
  );
}

/* ── A — true 3D flip, critically damped tap ───────────────────────────── */

export function VariantA({ data, revealed, onRevealChange }: VariantProps) {
  return (
    <Shell data={data} revealed={revealed}>
      <motion.div
        className="absolute inset-0 cursor-pointer"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: revealed ? 180 : 0 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => onRevealChange(!revealed)}
      >
        <Faces data={data} />
      </motion.div>
    </Shell>
  );
}
VariantA.title = 'A — 3D flip, tap, no overshoot';

/* ── B — drag-to-flip, 1:1 tracking with momentum settle ───────────────── */

// Apple's projection function (Designing Fluid Interfaces).
function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (
    (overshoot * dimension * constant) /
    (dimension + constant * Math.abs(overshoot))
  );
}

export function VariantB({ data, revealed, onRevealChange }: VariantProps) {
  const rotateY = useMotionValue(revealed ? 180 : 0);
  const z = useTransform(rotateY, r => 40 * Math.sin((r * Math.PI) / 180));
  const running = useRef<AnimationPlaybackControls | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef({
    active: false,
    startX: 0,
    startRot: 0,
    moved: 0,
    samples: [] as { t: number; r: number }[],
  });

  const settle = (target: number, velocity: number) => {
    running.current = animate(rotateY, target, {
      type: 'spring',
      bounce: 0.2,
      duration: 0.45,
      velocity,
    });
    onRevealChange(target === 180);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointers (prototype harness) have no capture */
    }
    running.current?.stop();
    drag.current = {
      active: true,
      startX: e.clientX,
      startRot: rotateY.get(),
      moved: 0,
      samples: [{ t: performance.now(), r: rotateY.get() }],
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active) return;
    const width = frameRef.current?.clientWidth ?? 120;
    const degPerPx = 180 / (width * 1.1);
    const dx = e.clientX - d.startX;
    d.moved = Math.max(d.moved, Math.abs(dx));
    let next = d.startRot + dx * degPerPx;
    if (next < 0) next = -rubberband(-next, 180);
    if (next > 180) next = 180 + rubberband(next - 180, 180);
    rotateY.set(next);
    d.samples.push({ t: performance.now(), r: next });
    if (d.samples.length > 5) d.samples.shift();
  };

  const onPointerUp = () => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    const current = rotateY.get();
    if (d.moved < 6) {
      settle(current > 90 ? 0 : 180, 0);
      return;
    }
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const dt = Math.max(last.t - first.t, 1);
    const velocity = ((last.r - first.r) / dt) * 1000;
    const projected = current + project(velocity);
    settle(projected > 90 ? 180 : 0, velocity);
  };

  return (
    <Shell data={data} revealed={revealed}>
      <div ref={frameRef} className="absolute inset-0">
        <motion.div
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          style={{ transformStyle: 'preserve-3d', rotateY, z, touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <Faces data={data} />
        </motion.div>
      </div>
    </Shell>
  );
}
VariantB.title = 'B — drag to flip, momentum settle';

/* ── C — tap flip with overshoot; lift derived from the rotation ───────── */

export function VariantC({ data, revealed, onRevealChange }: VariantProps) {
  const rotateY = useMotionValue(revealed ? 180 : 0);
  // Peaks at 90deg and inverts past 180, so the overshoot reads as the card
  // dropping back onto the table rather than a second, separate animation.
  const lift = useTransform(rotateY, r => Math.sin((r * Math.PI) / 180));
  const scale = useTransform(lift, l => 1 + 0.12 * l);
  const z = useTransform(lift, l => 60 * l);

  const flip = () => {
    const next = !revealed;
    animate(rotateY, next ? 180 : 0, {
      type: 'spring',
      bounce: 0.5,
      duration: 0.6,
    });
    onRevealChange(next);
  };

  return (
    <Shell data={data} revealed={revealed}>
      <motion.div
        className="absolute inset-0 cursor-pointer"
        style={{ transformStyle: 'preserve-3d', rotateY, scale, z }}
        whileTap={{ filter: 'brightness(0.9)' }}
        onClick={flip}
      >
        <Faces data={data} />
      </motion.div>
    </Shell>
  );
}
VariantC.title = 'C — tap flip, overshoot + lift';
