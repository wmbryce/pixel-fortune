import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./styles/global.css";
import "./styles/output.css";
import Provider from "./_trpc/Provider";
import Head from "next/head";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pixel Fortune",
  description: "May you be lucky and Prosperuse",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
