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
      <p className="text-xs font-semibold uppercase tracking-wider text-icta-gray-600">
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
        className="text-icta-gray-600 transition-colors hover:text-icta-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-black"
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
    <footer className="border-t border-icta-gray-200 bg-icta-gray-50">
      <div className="flag-stripe h-1" aria-hidden="true" />
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <SentinelMark state="idle" size={32} label="Sentinel" />
              <span className="text-base font-bold text-icta-black">Sentinel</span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-icta-gray-600">
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
                  <span className="block text-sm font-medium text-icta-black">
                    {user.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-icta-gray-600">
                    {user.email}
                  </span>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="inline-flex items-center gap-1.5 text-icta-gray-600 transition-colors hover:text-icta-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-black"
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

        <div className="mt-10 border-t border-icta-gray-200 pt-5 text-center text-xs text-icta-gray-600">
          © {new Date().getFullYear()} ICT Authority, Kenya · Internal
          compliance tool
        </div>
      </div>
    </footer>
  );
}
