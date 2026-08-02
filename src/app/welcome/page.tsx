'use client';
import Welcome from '../_components/Welcome';
import PageTransition from '../_components/PageTransition';
import './welcome.css';

/** Module scope so the identity is stable across renders. */
const LEAVES_TO = ['/tarot'];

export default function WelcomePage() {
  return (
    <PageTransition
      prefetch={LEAVES_TO}
      className="flex flex-col items-center justify-center min-h-screen p-4 bg-black_01"
    >
      <Welcome />
    </PageTransition>
  );
}
