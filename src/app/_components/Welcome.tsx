'use client';
import Image from 'next/image';
import { useCallback, useEffect } from 'react';
import { usePageLeave } from './PageTransition';

/**
 * The whole welcome screen, listeners included, so it sits *inside* the page
 * transition and can hand it the navigation rather than pushing the route out
 * from under itself.
 */
function Welcome() {
  const leave = usePageLeave();

  const enter = useCallback(() => leave('/tarot'), [leave]);

  const handleTouch = useCallback(
    (event: TouchEvent) => {
      event.preventDefault();
      enter();
    },
    [enter]
  );

  useEffect(() => {
    window.addEventListener('keydown', enter);
    window.addEventListener('touchstart', handleTouch);
    return () => {
      window.removeEventListener('keydown', enter);
      window.removeEventListener('touchstart', handleTouch);
    };
  }, [enter, handleTouch]);

  return (
    <div className="relative w-full h-[60vh] md:h-[80vh]">
      <div className="relative w-full h-full">
        <Image
          fill
          className="object-contain"
          src={'/assets/background/welcome_image.png'}
          alt={'Pixel Fortune'}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority
        />
      </div>
      <p className="font-sans continue-hint text-center text-sm md:text-base">
        <span className="only-pointer">Press any key to continue</span>
        <span className="only-touch">Tap to continue</span>
      </p>
    </div>
  );
}

export default Welcome;
