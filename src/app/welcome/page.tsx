"use client";
import { useEffect, useState } from "react";
import "../globals.css";
import Welcome from "../_components/Welcome";
import { redirect } from "next/navigation";
import { useRouter } from "next/navigation";

export default function WelcomePage() {
  const [showProceed, setShowProceed] = useState(true);
  const router = useRouter();

  const handleKeyPress = () => {
    console.log("OG key press");
    router.push("/tarot");
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, []);

  return (
    <main className="flex h-[100vh] flex-col items-center justify-center p-24 bg-black_01">
      <Welcome />
      <p className="font-sans animate-blink mt-[-40px] mb-[50px] opacity-0">
        Press any key to continue
      </p>
    </main>
  );
}
