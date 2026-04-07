'use client';
import { ReactNode } from 'react';
import PageHeader from '../_components/PageHeader';
import './background.css';

type Props = {
  children: ReactNode;
};

export default function TarotLayout({ children }: Props) {
  return (
    <main className="flex min-h-screen flex-col bg-grey animate-fadeIn lg:mx-16">
      <PageHeader />
      <div className="custom-background  flex-col h-[96vh] justify-between overflow-scroll">
        {children}
      </div>
    </main>
  );
}
