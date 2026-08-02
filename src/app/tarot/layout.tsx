'use client';
import { ReactNode } from 'react';
import PageHeader from '../_components/PageHeader';
import './background.css';

type Props = {
  children: ReactNode;
};

export default function TarotLayout({ children }: Props) {
  return (
    // The spread is sized to fit, so at every viewport that can hold it this is
    // exactly one screen and nothing scrolls — which is what lets the
    // background drop `background-attachment: fixed` (#14). `min-h` rather than
    // `h` so the one case that cannot hold it — a landscape phone, where the
    // stage is 66px — grows the column and scrolls instead of stranding the
    // cards outside it.
    <main className="flex min-h-[100dvh] flex-col bg-black_01 animate-fadeIn lg:mx-16">
      <PageHeader />
      <div className="custom-background flex flex-1 flex-col">
        {children}
      </div>
    </main>
  );
}
