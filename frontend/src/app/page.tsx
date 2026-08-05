import Link from "next/link";
import type { ReactNode } from "react";

import { StandardDocLink } from "@/components/ClauseLink";
import { HomeHeroActions } from "@/components/HomeHeroActions";
import { SentinelMark } from "@/components/SentinelMark";
import { SENTINEL_TRICOLOR_GRADIENT_CSS } from "@/lib/sentinel-mark-paths";

const BENEFITS: Array<{
  title: string;
  description: string;
  icon: ReactNode;
}> = [
  {
    title: "Automated compliance checks",
    description:
      "Every scan runs the ICTA.6.003:2023 §6.5 checklist automatically — domain identity, security, accessibility, and more.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <path d="m22 12-3-3-2-5H7l-2 5-3 3 3 3 2 5h10l2-5 3-3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Live MCDA registry",
    description:
      "Compliance scores for ministries, counties, and agencies in one dashboard — refreshed by weekly scans.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <path d="M3 3v18h18" />
        <path d="M7 15l4-5 3 3 5-7" />
      </svg>
    ),
  },
  {
    title: "Kenya compliance map",
    description:
      "County websites colour-coded by compliance score, so gaps across the country are visible at a glance.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    title: "Officer review workflow",
    description:
      "A guided manual review queue with sign-off steps and audit trail for checks that need a human decision.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
      </svg>
    ),
  },
  {
    title: "Track progress over time",
    description:
      "Compare scans against earlier snapshots — weekly, monthly, quarterly, or yearly — and see what changed.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M8 2v4M16 2v4M3 9h18" />
      </svg>
    ),
  },
  {
    title: "Standards embedded",
    description:
      "Every finding links straight to the exact clause in the official standard PDF — no more hunting through documents.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z" />
        <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
      </svg>
    ),
  },
];

const TOOLS: Array<{
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
}> = [
  {
    href: "/scan",
    title: "Scan a site",
    description: "Run compliance checks on a .go.ke / .gov.ke site",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3M8 11h6M11 8v6" />
      </svg>
    ),
  },
  {
    href: "/registry",
    title: "MCDA registry",
    description: "Compliance scores for ministries, counties & agencies",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/map",
    title: "Kenya map",
    description: "County compliance across the country at a glance",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    href: "/standards",
    title: "Standards",
    description: "ICTA.6.003:2023 §6.5 — the rulebook behind every scan",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z" />
        <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
      </svg>
    ),
  },
  {
    href: "/review",
    title: "Officer review",
    description: "Guided manual review queue for site inspections",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
      </svg>
    ),
  },
  {
    href: "/health",
    title: "System health",
    description: "Frontend & backend connectivity check",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Hero */}
      <main className="flex flex-1 flex-col items-center bg-white px-6 pb-16 pt-16 sm:pt-20">
        <div className="max-w-3xl text-center">
          <div className="mb-6 flex justify-center animate-fade-in-up">
            <SentinelMark state="idle" size={140} />
          </div>

          <p
            className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-icta-gray-600 animate-fade-in-up"
            style={{ animationDelay: "120ms" }}
          >
            ICT Authority, Kenya
          </p>

          <h1
            className="mb-4 text-4xl font-bold tracking-tight text-icta-black animate-fade-in-up sm:text-6xl"
            style={{ animationDelay: "200ms" }}
          >
            Keep government websites{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: SENTINEL_TRICOLOR_GRADIENT_CSS }}
            >
              compliant
            </span>
          </h1>

          <p
            className="mx-auto mb-2 max-w-2xl text-base text-icta-gray-600 animate-fade-in-up sm:text-lg"
            style={{ animationDelay: "280ms" }}
          >
            Sentinel scans public{" "}
            <StandardDocLink>ICTA.6.003:2023 §6.5</StandardDocLink> compliance
            — automated checks, scoring, and officer review in one place.
          </p>

          <p
            className="mb-10 text-sm text-icta-gray-600 animate-fade-in-up"
            style={{ animationDelay: "340ms" }}
          >
            For ministries, counties, and agencies across Kenya
          </p>

          <div className="animate-fade-in-up" style={{ animationDelay: "400ms" }}>
            <HomeHeroActions />
          </div>
        </div>

        {/* Benefits */}
        <section
          className="mx-auto mt-24 w-full max-w-5xl"
          aria-labelledby="benefits-heading"
        >
          <h2
            id="benefits-heading"
            className="mb-3 text-center text-2xl font-bold tracking-tight text-icta-black sm:text-3xl"
          >
            Why Sentinel
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-center text-sm text-icta-gray-600 sm:text-base">
            Everything your team needs to understand and improve website
            compliance across the public sector.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((benefit, index) => (
              <article
                key={benefit.title}
                className="card card-hover px-5 py-5 animate-fade-in-up"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <span className="mb-3 flex size-10 items-center justify-center rounded-lg bg-icta-gray-50 text-icta-black ring-1 ring-inset ring-icta-gray-200">
                  {benefit.icon}
                </span>
                <h3 className="mb-1.5 font-semibold text-icta-black">
                  {benefit.title}
                </h3>
                <p className="text-sm leading-relaxed text-icta-gray-600">
                  {benefit.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Tools */}
        <section className="mx-auto mt-24 w-full max-w-5xl" aria-labelledby="tools-heading">
          <h2
            id="tools-heading"
            className="mb-3 text-center text-2xl font-bold tracking-tight text-icta-black sm:text-3xl"
          >
            Tools
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-center text-sm text-icta-gray-600 sm:text-base">
            Jump straight into the workspace.
          </p>

          <nav
            aria-label="Sentinel tools"
            className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {TOOLS.map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                className="card card-hover group flex items-start gap-3 px-4 py-4 text-left animate-fade-in-up"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-icta-gray-50 text-icta-black ring-1 ring-inset ring-icta-gray-200 transition-colors group-hover:bg-icta-black group-hover:text-white">
                  {item.icon}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-icta-black">
                    {item.title}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-3.5 -translate-x-0.5 text-icta-gray-600 transition-transform group-hover:translate-x-0 group-hover:text-icta-black"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-icta-gray-600">
                    {item.description}
                  </span>
                </span>
              </Link>
            ))}
          </nav>
        </section>

        {/* Final CTA */}
        <section className="mt-24 w-full max-w-4xl text-center">
          <div className="card px-6 py-12">
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-icta-black sm:text-3xl">
              Ready to check your first site?
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-sm text-icta-gray-600 sm:text-base">
              Create an account and run a compliance scan on any public .go.ke
              or .gov.ke website — results are ready in under a minute.
            </p>
            <HomeHeroActions />
          </div>
        </section>
      </main>
    </div>
  );
}
