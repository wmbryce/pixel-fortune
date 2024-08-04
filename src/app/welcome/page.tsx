"use client";
import { useEffect, useState, useCallback } from "react";
import "../globals.css";
import Welcome from "../_components/Welcome";
import { redirect } from "next/navigation";
import { useRouter } from "next/navigation";

export default function WelcomePage() {
  const [showProceed, setShowProceed] = useState(true);
  const router = useRouter();

  const staggerDelay = 0.1;
  const stageDuration = 0.01;

  const handleNavigation = useCallback(() => {
    console.log("Navigating to tarot page");
    router.push("/tarot");
  }, [router]);

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    handleNavigation();
  }, [handleNavigation]);

  const handleTouch = useCallback((event: TouchEvent) => {
    event.preventDefault();
    handleNavigation();
  }, [handleNavigation]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);
    window.addEventListener("touchstart", handleTouch);

    return () => {
      window.removeEventListener("keydown", handleKeyPress);
      window.removeEventListener("touchstart", handleTouch);
    };
  }, [handleKeyPress, handleTouch]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-black_01">
      <div className="relative w-full h-[60vh] md:h-[80vh]">
        <Welcome />
        <p className="font-sans animate-blink text-center text-sm md:text-base opacity-0">
          Press any key to continue
        </p>
      </div>
    </main>
  );
}
