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
      <head>
        <meta charSet="utf-8" />
        <link rel="preload" href="https://fonts.gstatic.com/s/pixelifysans/v1/CHy2V-3HFOL-1YeE6OLsK6zCxw.woff2" as="font" type="font/woff2" />
      </head>
      <body className={inter.className}>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
