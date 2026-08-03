"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { LogOut, Menu, X } from "lucide-react";

import { SentinelMark } from "@/components/SentinelMark";
import { authSubscribe, logoutUser, readSession, readSessionServer } from "@/lib/auth";
import { btnGhost, btnPrimary, btnSecondarySm, iconBtn } from "@/lib/ui";

const NAV_LINKS = [
  { href: "/scan", label: "Scan" },
  { href: "/registry", label: "Registry" },
  { href: "/map", label: "Map" },
  { href: "/standards", label: "Standards" },
  { href: "/review", label: "Review" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useSyncExternalStore(authSubscribe, readSession, readSessionServer);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  function onSignOut() {
    setMenuOpen(false);
    logoutUser();
    router.push("/");
  }

  const linkClasses = (href: string) =>
    `rounded-md px-3 py-1.5 text-sm transition-colors ${
      isActive(pathname, href)
        ? "bg-icta-gray-100 font-medium text-icta-black"
        : "text-icta-gray-600 hover:bg-icta-gray-50 hover:text-icta-black"
    }`;

  return (
    <header className="sticky top-0 z-30 border-b border-icta-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <Link
          href="/"
          onClick={() => setMenuOpen(false)}
          className="flex shrink-0 items-center gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-black"
          aria-label="Sentinel home"
        >
          <SentinelMark state="idle" size={28} label="Sentinel" />
          <span className="text-base font-bold text-icta-black">Sentinel</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={linkClasses(link.href)}>
              {link.label}
            </Link>
          ))}
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
                <LogOut className="size-3.5" aria-hidden="true" />
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

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className={iconBtn}
          >
            {menuOpen ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="animate-fade-in-down border-t border-icta-gray-200 bg-white px-4 py-3 md:hidden"
        >
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive(pathname, link.href)
                    ? "bg-icta-gray-100 font-medium text-icta-black"
                    : "text-icta-gray-600 hover:bg-icta-gray-50 hover:text-icta-black"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {user && (
              <button
                type="button"
                onClick={onSignOut}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-icta-gray-600 transition-colors hover:bg-icta-gray-50 hover:text-icta-black"
              >
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
              </button>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
