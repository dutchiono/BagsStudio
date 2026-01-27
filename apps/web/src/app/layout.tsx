import "../polyfills";
import Script from "next/script";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { LiveUpdateListener } from "../components/LiveUpdateListener";
import ClientWalletProvider from "@/components/ClientWalletProvider";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BagsStudio",
  description: "Create websites and launch tokens with AI assistance. Powered by bags.fm.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <Script src="/shim.js" strategy="beforeInteractive" />
      </head>
      <body className={inter.className}>
        <LiveUpdateListener />
        <ClientWalletProvider>
          {children}
        </ClientWalletProvider>
      </body>
    </html>
  );
}
