'use client';
import Image from 'next/image';
import { useCallback, useEffect } from 'react';
import { usePageLeave } from './PageTransition';
import { isAnyKeyPress } from '../_libs/keys';

/**
 * The whole welcome screen, listeners included, so it sits *inside* the page
 * transition and can hand it the navigation rather than pushing the route out
 * from under itself.
 *
 * Three ways in, and the hint is the third: it was a `<p>`, so the screen had
 * no tab stop at all and a visitor arriving by keyboard or by screen reader had
 * nothing to find. It is a button now, saying what it already said. The window
 * listeners stay for the convenience they buy — a key anywhere, a tap anywhere
 * — but the `touchstart` one is a plain `click`: it used to `preventDefault`
 * every touch on the window, which is the page's scroll and pinch-zoom as well
 * as its taps.
 */
function Welcome() {
  const leave = usePageLeave();

  const enter = useCallback(() => leave('/tarot'), [leave]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isAnyKeyPress(event)) enter();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', enter);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', enter);
    };
  }, [enter]);

  return (
    <div className="relative w-full h-[60vh] md:h-[80vh]">
      <h1 className="sr-only">Pixel Fortune</h1>
      <div className="relative w-full h-full">
        <Image
          fill
          className="object-contain"
          src={'/assets/background/welcome_image.png'}
          alt=""
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority
        />
      </div>
      {/* Whichever span the input capability leaves displayed is the button's
          accessible name, so what it is called is what it says. */}
      <button
        type="button"
        onClick={enter}
        className="font-sans continue-hint block w-full text-center text-sm md:text-base"
      >
        <span className="only-pointer">Press any key to continue</span>
        <span className="only-touch">Tap to continue</span>
      </button>
    </div>
  );
}

export default Welcome;
