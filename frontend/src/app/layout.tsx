import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AccessibilityTools } from "@/components/AccessibilityTools";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ICTA Sentinel",
  description:
    "AI-powered government website compliance checker — ICTA.6.003:2023 §6.5",
};

/**
 * Inline boot script: apply stored a11y prefs before paint to avoid a flash.
 * Kept in sync with keys/classes in src/lib/a11y.ts.
 */
const A11Y_BOOT_SCRIPT = `
(function(){
  try {
    var raw = localStorage.getItem("sentinel.a11y.prefs");
    if (!raw) return;
    var p = JSON.parse(raw);
    var root = document.documentElement;
    var scaleMap = {"-2":0.875,"-1":0.9375,"0":1,"1":1.125,"2":1.25};
    var step = String(p.textStep == null ? 0 : p.textStep);
    var scale = scaleMap[step] || 1;
    root.style.fontSize = (scale * 100).toFixed(2) + "%";
    root.style.setProperty("--a11y-text-scale", String(scale));
    var classes = {
      grayscale: "a11y-grayscale",
      highContrast: "a11y-high-contrast",
      negativeContrast: "a11y-negative-contrast",
      lightBackground: "a11y-light-background",
      underlineLinks: "a11y-underline-links",
      readableFont: "a11y-readable-font"
    };
    Object.keys(classes).forEach(function(k){
      if (p[k]) root.classList.add(classes[k]);
    });
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: A11Y_BOOT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <div id="sentinel-app" className="flex min-h-full flex-1 flex-col">
          <Header />
          {children}
          <Footer />
        </div>
        <AccessibilityTools />
      </body>
    </html>
  );
}
