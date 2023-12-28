"use client";
import { useEffect, useState } from "react";
import "./globals.css";
import CardTable from "../_components/CardTable";
import Welcome from "../_components/Welcome";
import DialogBox from "../_components/DialogBox";
import PageHeader from "../_components/PageHeader";
import { trpc } from "../_trpc/client";
import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push("/welcome");
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between px-24 bg-black_01">
      <PageHeader />
      {/* <PageHeader title={"Pixel Fortune"} /> */}
      {<CardTable />}
      <DialogBox />
    </main>
  );
}
