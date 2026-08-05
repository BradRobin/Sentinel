"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { authSubscribe, logoutUser, readSession, readSessionServer } from "@/lib/auth";
import { SENTINEL_TRICOLOR_GRADIENT_CSS } from "@/lib/sentinel-mark-paths";
import { btnGhost, btnPrimary, btnSecondarySm } from "@/lib/ui";

const NAV_LINKS = [
  { href: "/scan", label: "Scan" },
  { href: "/registry", label: "Registry" },
  { href: "/map", label: "Map" },
  { href: "/standards", label: "Standards" },
  { href: "/review", label: "Review" },
] as const;

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
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useSyncExternalStore(authSubscribe, readSession, readSessionServer);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  function onSignOut() {
    setMenuOpen(false);
    logoutUser();
    router.push("/");
  }

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
                {link.label}
              </Link>
            ))}
          </nav>

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
      <div className="flag-stripe-smooth h-0.5" aria-hidden="true" />
    </header>
  );
}
