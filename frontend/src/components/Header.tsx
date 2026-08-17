"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  BookOpen,
  ClipboardCheck,
  LayoutGrid,
  LogOut,
  Map,
  Menu,
  ScanSearch,
  X,
} from "lucide-react";

import { SentinelMark } from "@/components/SentinelMark";
import { authSubscribe, logoutUser, readSession, readSessionServer } from "@/lib/auth";
import { btnGhost, btnPrimary, btnSecondarySm, iconBtn } from "@/lib/ui";

const NAV_LINKS = [
  { href: "/scan", label: "Scan", icon: ScanSearch },
  { href: "/registry", label: "Registry", icon: LayoutGrid },
  { href: "/map", label: "Map", icon: Map },
  { href: "/standards", label: "Standards", icon: BookOpen },
  { href: "/review", label: "Review", icon: ClipboardCheck },
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
    `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
      isActive(pathname, href)
        ? "bg-icta-gray-100 font-semibold text-icta-gray-900"
        : "text-icta-gray-600 hover:bg-icta-gray-50 hover:text-icta-gray-900"
    }`;

  return (
    <header className="sticky top-0 z-30 border-b border-icta-gray-200 bg-white/85 shadow-card backdrop-blur-md">
      <div className="mx-auto flex h-12 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:h-14 sm:gap-4 sm:px-6">
        <Link
          href="/"
          onClick={() => setMenuOpen(false)}
          className="flex shrink-0 items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-gray-800"
          aria-label="Sentinel home"
        >
          <SentinelMark state="idle" size={26} label="Sentinel" />
          <span className="text-sm font-bold text-icta-gray-900 sm:text-base font-serif">
            Sentinel
          </span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href} className={linkClasses(link.href)}>
                <Icon className="size-4" aria-hidden="true" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
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
        <>
          <div
            className="fixed inset-0 top-12 z-20 bg-icta-gray-900/20 backdrop-blur-[2px] md:hidden"
            aria-hidden="true"
            onClick={() => setMenuOpen(false)}
          />
          <nav
            id="mobile-nav"
            aria-label="Main"
            className="absolute inset-x-0 top-12 z-30 border-t border-icta-gray-200 bg-white px-3 py-3 shadow-pop animate-fade-in-down md:hidden"
          >
            <div className="flex flex-col gap-0.5">
              {NAV_LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      isActive(pathname, link.href)
                        ? "bg-icta-gray-100 font-semibold text-icta-gray-900"
                        : "text-icta-gray-600 hover:bg-icta-gray-50 hover:text-icta-gray-900"
                    }`}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {link.label}
                  </Link>
                );
              })}
              <div className="my-1.5 border-t border-icta-gray-100" aria-hidden="true" />
              {user && (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-icta-gray-600 transition-colors hover:bg-icta-gray-50 hover:text-icta-gray-900"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Sign out
                </button>
              )}
              {!user && (
                <>
                  <Link
                    href="/register"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-icta-green transition-colors hover:bg-icta-green-tint"
                  >
                    Create account
                  </Link>
                </>
              )}
            </div>
          </nav>
        </>
      )}
    </header>
  );
}
