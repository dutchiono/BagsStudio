import "../polyfills";
import Script from "next/script";
import type { Metadata } from "next";
import { Bungee, Fredoka, Quicksand } from "next/font/google";
import { ClientPolyfills } from "../components/ClientPolyfills";
import { LiveUpdateListener } from "../components/LiveUpdateListener";
import "./globals.css";

const bungee = Bungee({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bungee",
});

const fredoka = Fredoka({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-fredoka",
});

const quicksand = Quicksand({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-quicksand",
});

export const metadata: Metadata = {
  title: "BagsStudio",
  description: "One-shot website renderer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script src="/shim.js" strategy="beforeInteractive" />
      </head>
      <body
        className={`${bungee.variable} ${fredoka.variable} ${quicksand.variable} antialiased`}
      >
        <ClientPolyfills />
        <LiveUpdateListener />
        {children}
      </body>
    </html>
  );
}
