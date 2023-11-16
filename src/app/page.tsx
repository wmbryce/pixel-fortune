"use client";
import { useState } from "react";
import CardTable from "./_components/CardTable";
import PageHeader from "./_components/PageHeader";
import "./globals.css";
import Welcome from "./_components/Welcome";
import DialogBox from "./_components/DialogBox";

export default function Home() {
  const [showWelcome, setShowWelcome] = useState(true);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24 bg-blue_01">
      {showWelcome ? (
        <Welcome setShowWelcome={setShowWelcome} />
      ) : (
        <>
          <PageHeader title={"Pixel Fortune"} />
          <CardTable />
          <DialogBox />
        </>
      )}
    </main>
  );
}
