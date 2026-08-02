'use client';
import { useEffect, useCallback } from 'react';
import Welcome from '../_components/Welcome';
import { useRouter } from 'next/navigation';
import './welcome.css';

export default function WelcomePage() {
  const router = useRouter();

  const handleNavigation = useCallback(() => {
    router.push('/tarot');
  }, [router]);

  const handleKeyPress = useCallback(() => {
    handleNavigation();
  }, [handleNavigation]);

  const handleTouch = useCallback(
    (event: TouchEvent) => {
      event.preventDefault();
      handleNavigation();
    },
    [handleNavigation]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('touchstart', handleTouch);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('touchstart', handleTouch);
    };
  }, [handleKeyPress, handleTouch]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-black_01">
      <div className="relative w-full h-[60vh] md:h-[80vh]">
        <Welcome />
        <p className="font-sans animate-blink text-center text-sm md:text-base opacity-0">
          <span className="only-pointer">Press any key to continue</span>
          <span className="only-touch">Tap to continue</span>
        </p>
      </div>
    </main>
  );
}
