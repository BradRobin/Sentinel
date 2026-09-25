"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
<<<<<<< HEAD
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
=======
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
>>>>>>> 9b7c9a9a952b4c1faf1266d14506edc3128de21e

import { authSubscribe, logoutUser, readSession, readSessionServer } from "@/lib/auth";
<<<<<<< HEAD
import { btnGhost, btnPrimary, btnSecondarySm, iconBtn } from "@/lib/ui";
=======
import { SENTINEL_TRICOLOR_GRADIENT_CSS } from "@/lib/sentinel-mark-paths";
import { btnGhost, btnPrimary, btnSecondarySm } from "@/lib/ui";
>>>>>>> 9b7c9a9a952b4c1faf1266d14506edc3128de21e

const NAV_LINKS = [
  { href: "/scan", label: "Scan", icon: ScanSearch },
  { href: "/registry", label: "Registry", icon: LayoutGrid },
  { href: "/map", label: "Map", icon: Map },
  { href: "/standards", label: "Standards", icon: BookOpen },
  { href: "/review", label: "Review", icon: ClipboardCheck },
] as const;

<<<<<<< HEAD
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
=======
function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {open ? (
        <>
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        </>
      ) : (
        <>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </>
      )}
    </svg>
  );
>>>>>>> 9b7c9a9a952b4c1faf1266d14506edc3128de21e
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useSyncExternalStore(authSubscribe, readSession, readSessionServer);
  const [menuOpen, setMenuOpen] = useState(false);
<<<<<<< HEAD

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);
=======
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
>>>>>>> 9b7c9a9a952b4c1faf1266d14506edc3128de21e

  function onSignOut() {
    setMenuOpen(false);
    logoutUser();
    router.push("/");
  }

<<<<<<< HEAD
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
=======
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }

    function onPointerDown(e: MouseEvent | PointerEvent) {
      const target = e.target as Node;
      if (
        menuRef.current?.contains(target) ||
        toggleRef.current?.contains(target)
      ) {
        return;
      }
      setMenuOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

  function linkClass(href: string, mobile = false) {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    if (mobile) {
      return `block rounded-md px-3 py-2.5 text-sm transition-colors ${
        active
          ? "bg-icta-gray-100 font-medium text-icta-black"
          : "text-icta-gray-600 hover:bg-icta-gray-50 hover:text-icta-black"
      }`;
    }
    return `rounded-md px-3 py-1.5 text-sm transition-colors ${
      active
        ? "bg-icta-black font-medium text-white"
        : "text-icta-gray-600 hover:bg-icta-gray-50 hover:text-icta-black"
    }`;
  }

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur">
      <div className="border-b border-icta-gray-200">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-6">
          <Link
            href="/"
            className="shrink-0 bg-clip-text text-base font-bold text-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-black"
            style={{ backgroundImage: SENTINEL_TRICOLOR_GRADIENT_CSS }}
          >
            Sentinel
          </Link>

          <nav
            aria-label="Main"
            className="hidden items-center gap-1 md:flex"
          >
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass(link.href)}>
>>>>>>> 9b7c9a9a952b4c1faf1266d14506edc3128de21e
                {link.label}
              </Link>
            ))}
          </nav>

<<<<<<< HEAD
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
=======
          <div className="flex shrink-0 items-center gap-2">
            {user ? (
              <>
                <span className="hidden text-sm text-icta-gray-600 md:block">
                  {user.name.split(" ")[0]}
                </span>
                <button
                  type="button"
                  onClick={onSignOut}
                  className={`${btnGhost} hidden md:inline-flex`}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className={`${btnGhost} hidden md:inline-flex`}>
                  Log in
                </Link>
                <Link href="/register" className={`${btnSecondarySm} hidden md:inline-flex`}>
                  Create account
                </Link>
              </>
            )}

            <button
              ref={toggleRef}
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-icta-black transition-colors hover:bg-icta-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-black md:hidden"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MenuIcon open={menuOpen} />
            </button>
          </div>
>>>>>>> 9b7c9a9a952b4c1faf1266d14506edc3128de21e
        </div>

        {menuOpen && (
          <div
            ref={menuRef}
            id={menuId}
            className="border-t border-icta-gray-200 bg-white md:hidden"
          >
            <nav aria-label="Mobile" className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-6 py-3">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={linkClass(link.href, true)}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

              <div className="mt-2 border-t border-icta-gray-100 pt-2">
                {user ? (
                  <>
                    <p className="px-3 py-2 text-sm text-icta-gray-600">
                      {user.name.split(" ")[0]}
                    </p>
                    <button
                      type="button"
                      onClick={onSignOut}
                      className="block w-full rounded-md px-3 py-2.5 text-left text-sm text-icta-gray-600 transition-colors hover:bg-icta-gray-50 hover:text-icta-black"
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col gap-2 px-1 pt-1">
                    <Link
                      href="/login"
                      className={btnGhost}
                      onClick={() => setMenuOpen(false)}
                    >
                      Log in
                    </Link>
                    <Link
                      href="/register"
                      className={btnPrimary}
                      onClick={() => setMenuOpen(false)}
                    >
                      Create account
                    </Link>
                  </div>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
<<<<<<< HEAD

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
=======
      <div className="flag-stripe-smooth h-0.5" aria-hidden="true" />
>>>>>>> 9b7c9a9a952b4c1faf1266d14506edc3128de21e
    </header>
  );
}
