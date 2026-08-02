'use client';
import Welcome from '../_components/Welcome';
import PageTransition from '../_components/PageTransition';
import './welcome.css';

export default function WelcomePage() {
  return (
    <PageTransition className="flex flex-col items-center justify-center min-h-screen p-4 bg-black_01">
      <Welcome />
    </PageTransition>
  );
}
