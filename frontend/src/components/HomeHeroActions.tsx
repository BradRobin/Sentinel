"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { LayoutGrid, LogIn, ScanSearch, Sparkles } from "lucide-react";

import { authSubscribe, readSession, readSessionServer } from "@/lib/auth";
import { btnPrimaryLg, btnSecondaryLg } from "@/lib/ui";

/** Landing-page primary CTA — switches based on auth state. */
export function HomeHeroActions() {
  const user = useSyncExternalStore(authSubscribe, readSession, readSessionServer);

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Link
        href={user ? "/scan" : "/register"}
        className={btnPrimaryLg}
      >
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
      <Link
        href={user ? "/registry" : "/login"}
        className={btnSecondaryLg}
      >
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
