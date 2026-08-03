"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

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
        {user ? "Start a scan" : "Get started free"}
      </Link>
      <Link
        href={user ? "/registry" : "/login"}
        className={btnSecondaryLg}
      >
        {user ? "View the registry" : "Log in"}
      </Link>
    </div>
  );
}
