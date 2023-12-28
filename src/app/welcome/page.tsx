"use client";
import { useState } from "react";
import "./globals.css";
import Welcome from "../_components/Welcome";

export default function WelcomePage() {
  const [showWelcome, setShowWelcome] = useState();

  return (
    <main className="flex min-h-screen flex-col items-center justify-between px-24 bg-black_01">
      <Welcome setShowWelcome={setShowWelcome} />
    </main>
  );
}
