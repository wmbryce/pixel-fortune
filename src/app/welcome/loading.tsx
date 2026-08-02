import Image from 'next/image';

/**
 * The same boundary as `tarot/loading.tsx`, for the reset's way back out. That
 * one renders inside `tarot/layout.tsx`, so the header and the tableau are
 * already up; `/welcome` has no layout of its own, so the art is held here
 * instead — a black rectangle reads as broken rather than as arriving. The
 * layout matches `Welcome.tsx` so the real screen lands on top of it without
 * moving. No client JS: what paints before the destination resolves is the
 * entire point of the file.
 */
export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-black_01">
      <div className="relative w-full h-[60vh] md:h-[80vh]">
        <Image
          fill
          className="object-contain"
          src={'/assets/background/welcome_image.png'}
          alt=""
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority
        />
      </div>
    </div>
  );
}
