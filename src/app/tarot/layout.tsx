"use client";
import { ReactNode, useState } from "react";
import PageHeader from "../_components/PageHeader";
import { trpc } from "../_trpc/client";

type Props = {
  children: ReactNode;
};

export default function TarotLayout({ children }: Props) {
  return (
    <main className="flex min-h-screen flex-col bg-grey">
      <PageHeader />
      <div
        style={{
          backgroundImage: "/assets/background/tarot_background_01.png",
        }}
      >
        {children}
      </div>
    </main>
  );
}
