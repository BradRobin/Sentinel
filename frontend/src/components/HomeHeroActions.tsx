"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { LayoutGrid, LogIn, ScanSearch, Sparkles } from "lucide-react";

import { authSubscribe, readSession, readSessionServer } from "@/lib/auth";
import { btnPrimaryLg, btnSecondaryLg } from "@/lib/ui";

const onDarkPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-icta-green-deep shadow-[0_1px_2px_rgb(0_0_0/0.2)] hover:bg-icta-gray-50 hover:shadow-[0_8px_20px_-8px_rgb(0_0_0/0.4)] active:bg-white/90 transition-[color,background-color,box-shadow,transform] duration-150 ease-out";

const onDarkSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20 active:bg-white/15";

/**
 * Landing-page CTA pair — switches based on auth state and background tone.
 * `tone="on-dark"` renders light variants for use on deep-green panels.
 */
export function HomeHeroActions({ tone = "on-light" }: { tone?: "on-light" | "on-dark" }) {
  const user = useSyncExternalStore(authSubscribe, readSession, readSessionServer);

  const primary = tone === "on-dark" ? onDarkPrimary : btnPrimaryLg;
  const secondary = tone === "on-dark" ? onDarkSecondary : btnSecondaryLg;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Link href={user ? "/scan" : "/register"} className={primary}>
        {user ? (
          <>
            <ScanSearch className="size-4" aria-hidden="true" />
            Start a scan
          </>
        ) : (
          <>
            <Sparkles className="size-4" aria-hidden="true" />
            Get started
          </>
        )}
      </Link>
      <Link href={user ? "/registry" : "/login"} className={secondary}>
        {user ? (
          <>
            <LayoutGrid className="size-4" aria-hidden="true" />
            View the registry
          </>
        ) : (
          <>
            <LogIn className="size-4" aria-hidden="true" />
            Log in
          </>
        )}
      </Link>
    </div>
  );
}
