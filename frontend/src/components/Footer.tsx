"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { LogOut } from "lucide-react";

import { SentinelMark } from "@/components/SentinelMark";
import { authSubscribe, logoutUser, readSession, readSessionServer } from "@/lib/auth";

const PRODUCT_LINKS = [
  { href: "/scan", label: "Scan a site" },
  { href: "/registry", label: "MCDA registry" },
  { href: "/map", label: "Kenya map" },
  { href: "/standards", label: "Standards" },
  { href: "/review", label: "Officer review" },
  { href: "/health", label: "System health" },
] as const;

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
] as const;

function FooterColumn({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <nav aria-label={heading} className="space-y-3">
<<<<<<< HEAD
      <p className="text-xs font-semibold uppercase tracking-wider text-icta-gray-500">
=======
      <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
>>>>>>> 9b7c9a9a952b4c1faf1266d14506edc3128de21e
        {heading}
      </p>
      <ul className="space-y-2 text-sm">{children}</ul>
    </nav>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
<<<<<<< HEAD
        className="text-icta-gray-600 transition-colors hover:text-icta-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-gray-800"
=======
        className="text-white/75 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
>>>>>>> 9b7c9a9a952b4c1faf1266d14506edc3128de21e
      >
        {children}
      </Link>
    </li>
  );
}

export function Footer() {
  const router = useRouter();
  const user = useSyncExternalStore(authSubscribe, readSession, readSessionServer);

  function onSignOut() {
    logoutUser();
    router.push("/");
  }

  return (
    <footer className="border-t border-white/10 bg-icta-black text-white">
      <div className="flag-stripe h-1" aria-hidden="true" />
<<<<<<< HEAD
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 sm:gap-8">
          <div className="space-y-2.5 sm:space-y-3">
            <div className="flex items-center gap-2">
              <SentinelMark state="idle" size={28} label="Sentinel" />
              <span className="text-sm font-bold text-icta-gray-900 sm:text-base">Sentinel</span>
            </div>
            <p className="max-w-xs text-xs leading-relaxed text-icta-gray-600 sm:text-sm">
=======
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <SentinelMark state="idle" size={32} label="Sentinel" />
              <span className="text-base font-bold text-white">Sentinel</span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-white/70">
>>>>>>> 9b7c9a9a952b4c1faf1266d14506edc3128de21e
              AI-powered website compliance checking for Kenya&apos;s public
              sector, against ICTA.6.003:2023 §6.5.
            </p>
          </div>

          <FooterColumn heading="Product">
            {PRODUCT_LINKS.map((link) => (
              <FooterLink key={link.href} href={link.href}>
                {link.label}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn heading="Legal">
            {LEGAL_LINKS.map((link) => (
              <FooterLink key={link.href} href={link.href}>
                {link.label}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn heading="Account">
            {user ? (
              <>
                <li>
<<<<<<< HEAD
                  <span className="block text-sm font-medium text-icta-gray-900">
=======
                  <span className="block text-sm font-medium text-white">
>>>>>>> 9b7c9a9a952b4c1faf1266d14506edc3128de21e
                    {user.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-white/60">
                    {user.email}
                  </span>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={onSignOut}
<<<<<<< HEAD
                    className="inline-flex items-center gap-1.5 text-icta-gray-600 transition-colors hover:text-icta-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-black"
=======
                    className="text-white/75 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
>>>>>>> 9b7c9a9a952b4c1faf1266d14506edc3128de21e
                  >
                    <LogOut className="size-3.5" aria-hidden="true" />
                    Sign out
                  </button>
                </li>
              </>
            ) : (
              <>
                <FooterLink href="/login">Log in</FooterLink>
                <FooterLink href="/register">Create account</FooterLink>
              </>
            )}
          </FooterColumn>
        </div>

<<<<<<< HEAD
        <div className="mt-8 border-t border-icta-gray-200 pt-5 text-center text-xs text-icta-gray-600 sm:mt-10">
=======
        <div className="mt-10 border-t border-white/15 pt-5 text-center text-xs text-white/55">
>>>>>>> 9b7c9a9a952b4c1faf1266d14506edc3128de21e
          © {new Date().getFullYear()} ICT Authority, Kenya · Internal
          compliance tool
        </div>
      </div>
    </footer>
  );
}
