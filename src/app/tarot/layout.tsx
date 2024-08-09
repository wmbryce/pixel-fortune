"use client";
import { ReactNode, useState } from "react";
import PageHeader from "../_components/PageHeader";
import { trpc } from "../_trpc/client";
import { url } from "inspector";
import "./background.css";

type Props = {
  children: ReactNode;
};

export default function TarotLayout({ children }: Props) {
  return (
    <main className="flex min-h-screen flex-col bg-grey animate-fadeIn lg:mx-32">
      <PageHeader />
      <div className="custom-background  flex-col h-[96vh] justify-between overflow-scroll">
        {/* <img src="/assets/background/tarot_background_1.png"></img> */}
        {children}
      </div>
    </main>
  );
}
