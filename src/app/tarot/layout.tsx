'use client';
import { ReactNode } from 'react';
import PageHeader from '../_components/PageHeader';
import './background.css';

type Props = {
  children: ReactNode;
};

export default function TarotLayout({ children }: Props) {
  return (
    // The spread is sized to fit, so the page no longer scrolls — which is
    // also what lets the background drop `background-attachment: fixed` (#14).
    <main className="flex h-[100dvh] flex-col bg-black_01 animate-fadeIn lg:mx-16">
      <PageHeader />
      <div className="custom-background flex min-h-0 flex-1 flex-col">
        {children}
      </div>
    </main>
  );
}
