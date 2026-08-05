import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { ViewTransition } from "react";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ICTA Sentinel",
  description:
    "AI-powered government website compliance checker — ICTA.6.003:2023 §6.5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Header />
        <ToastProvider>
          <ViewTransition enter="auto" default="none">
            {children}
          </ViewTransition>
        </ToastProvider>
        <Footer />
      </body>
    </html>
  );
}

