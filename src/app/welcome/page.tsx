'use client';
import Welcome from '../_components/Welcome';
import AppMenu from '../_components/AppMenu';
import PageTransition from '../_components/PageTransition';
import './welcome.css';

/** Module scope so the identity is stable across renders. */
const LEAVES_TO = ['/tarot'];

export default function WelcomePage() {
  return (
    <PageTransition
      prefetch={LEAVES_TO}
      className="relative flex flex-col items-center justify-center min-h-screen p-4 bg-black_01"
    >
      {/* Overlaid rather than a row of its own, so the art keeps its centre.
          The triggers contain their events; "any key" stays ambient. */}
      <div className="absolute top-0 right-0 z-10 flex h-8 items-center px-8">
        <AppMenu />
      </div>
      <Welcome />
    </PageTransition>
  );
}
