"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";

import { SentinelMark } from "@/components/SentinelMark";
import { authSubscribe, logoutUser, readSession, readSessionServer } from "@/lib/auth";
import { btnGhost, btnPrimary, btnSecondarySm } from "@/lib/ui";

const NAV_LINKS = [
  { href: "/scan", label: "Scan" },
  { href: "/registry", label: "Registry" },
  { href: "/map", label: "Map" },
  { href: "/standards", label: "Standards" },
  { href: "/review", label: "Review" },
] as const;

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useSyncExternalStore(authSubscribe, readSession, readSessionServer);

  function onSignOut() {
    logoutUser();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-icta-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-black"
          aria-label="Sentinel home"
        >
          <SentinelMark state="idle" size={28} label="Sentinel" />
          <span className="text-base font-bold text-icta-black">Sentinel</span>
        </Link>

        <nav
          aria-label="Main"
          className="hidden items-center gap-1 md:flex"
        >
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-icta-gray-100 font-medium text-icta-black"
                    : "text-icta-gray-600 hover:bg-icta-gray-50 hover:text-icta-black"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {user ? (
            <>
              <span className="hidden text-sm text-icta-gray-600 sm:block">
                {user.name.split(" ")[0]}
              </span>
              <button
                type="button"
                onClick={onSignOut}
                className={`${btnGhost} hidden sm:inline-flex`}
              >
                Sign out
              </button>
              <Link href="/scan" className={`${btnPrimary} sm:hidden`}>
                Scan
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className={btnGhost}>
                Log in
              </Link>
              <Link href="/register" className={`${btnSecondarySm} hidden sm:inline-flex`}>
                Create account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
