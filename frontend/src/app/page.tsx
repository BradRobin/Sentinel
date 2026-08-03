import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  LayoutGrid,
  Map,
  MapPin,
  MessageSquare,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";

import { StandardDocLink } from "@/components/ClauseLink";
import { HomeHeroActions } from "@/components/HomeHeroActions";
import { ScrollReveal } from "@/components/ScrollReveal";
import { SentinelMark } from "@/components/SentinelMark";

const BENEFITS: Array<{
  title: string;
  description: string;
  icon: ReactNode;
}> = [
  {
    title: "Automated compliance checks",
    description:
      "Every scan runs the ICTA.6.003:2023 §6.5 checklist automatically — domain identity, security, accessibility, and more.",
    icon: <ShieldCheck className="size-5" aria-hidden="true" />,
  },
  {
    title: "Live MCDA registry",
    description:
      "Compliance scores for ministries, counties, and agencies in one dashboard — refreshed by weekly scans.",
    icon: <BarChart3 className="size-5" aria-hidden="true" />,
  },
  {
    title: "Kenya compliance map",
    description:
      "County websites colour-coded by compliance score, so gaps across the country are visible at a glance.",
    icon: <MapPin className="size-5" aria-hidden="true" />,
  },
  {
    title: "Officer review workflow",
    description:
      "A guided manual review queue with sign-off steps and audit trail for checks that need a human decision.",
    icon: <MessageSquare className="size-5" aria-hidden="true" />,
  },
  {
    title: "Track progress over time",
    description:
      "Compare scans against earlier snapshots — weekly, monthly, quarterly, or yearly — and see what changed.",
    icon: <CalendarClock className="size-5" aria-hidden="true" />,
  },
  {
    title: "Standards embedded",
    description:
      "Every finding links straight to the exact clause in the official standard PDF — no more hunting through documents.",
    icon: <BookOpen className="size-5" aria-hidden="true" />,
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
    icon: <ScanSearch className="size-5" aria-hidden="true" />,
  },
  {
    href: "/registry",
    title: "MCDA registry",
    description: "Compliance scores for ministries, counties & agencies",
    icon: <LayoutGrid className="size-5" aria-hidden="true" />,
  },
  {
    href: "/map",
    title: "Kenya map",
    description: "County compliance across the country at a glance",
    icon: <Map className="size-5" aria-hidden="true" />,
  },
  {
    href: "/standards",
    title: "Standards",
    description: "ICTA.6.003:2023 §6.5 — the rulebook behind every scan",
    icon: <BookOpen className="size-5" aria-hidden="true" />,
  },
  {
    href: "/review",
    title: "Officer review",
    description: "Guided manual review queue for site inspections",
    icon: <ClipboardCheck className="size-5" aria-hidden="true" />,
  },
  {
    href: "/health",
    title: "System health",
    description: "Frontend & backend connectivity check",
    icon: <Activity className="size-5" aria-hidden="true" />,
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flag-stripe h-1.5 w-full shrink-0" aria-hidden="true" />

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
            className="mb-4 text-4xl font-bold tracking-tight text-icta-black animate-fade-in-up sm:text-6xl font-serif"
            style={{ animationDelay: "200ms" }}
          >
            Keep government websites compliant
          </h1>

          <p
            className="mx-auto mb-2 max-w-2xl text-lg text-icta-gray-600 animate-fade-in-up sm:text-xl"
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
              <ScrollReveal key={benefit.title} delay={index * 60}>
                <article className="card card-hover h-full px-5 py-5">
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
              </ScrollReveal>
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
              <ScrollReveal key={item.href} delay={index * 60}>
                <Link
                  href={item.href}
                  className="card card-hover group flex h-full items-start gap-3 px-4 py-4 text-left"
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-icta-gray-50 text-icta-black ring-1 ring-inset ring-icta-gray-200 transition-colors group-hover:bg-icta-black group-hover:text-white">
                    {item.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-icta-black">
                      {item.title}
                      <ArrowRight
                        className="size-3.5 -translate-x-0.5 text-icta-gray-600 transition-transform group-hover:translate-x-0 group-hover:text-icta-black"
                        aria-hidden="true"
                      />
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-icta-gray-600">
                      {item.description}
                    </span>
                  </span>
                </Link>
              </ScrollReveal>
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
