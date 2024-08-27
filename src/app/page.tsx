"use client";
import { useEffect, useState } from "react";
import "./styles/global.css";
import { redirect } from "next/navigation";

export default function Home() {
  useEffect(() => {
    console.log("redirecting to welcome");
    redirect("/welcome");
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between px-24 bg-black_01">
      {/* <PageHeader />
      {/* <PageHeader title={"Pixel Fortune"} /> */}
      {/* {<CardTable />} */}
      {/* <DialogBox /> */}
    </main>
  );
}
