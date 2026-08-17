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
import { Card, CardContent } from "@/components/ui/card";
import {
  badgeGreen,
  iconTile,
  iconTileAmber,
  iconTileGreen,
  iconTileInfo,
} from "@/lib/ui";

const METRICS: Array<{ value: string; label: string }> = [
  { value: "8", label: "Standard categories" },
  { value: "47", label: "Counties monitored" },
  { value: "24h", label: "Fresh results" },
  { value: "§6.5", label: "The rulebook" },
];

const BENEFITS: Array<{
  title: string;
  description: string;
  icon: ReactNode;
  tile: string;
}> = [
  {
    title: "Automated compliance checks",
    description:
      "Every scan runs the ICTA.6.003:2023 §6.5 checklist automatically — domain identity, security, accessibility, and more.",
    icon: <ShieldCheck className="size-5" aria-hidden="true" />,
    tile: iconTileGreen,
  },
  {
    title: "Live MCDA registry",
    description:
      "Compliance scores for ministries, counties, and agencies in one dashboard — refreshed by weekly scans.",
    icon: <BarChart3 className="size-5" aria-hidden="true" />,
    tile: iconTileInfo,
  },
  {
    title: "Kenya compliance map",
    description:
      "County websites colour-coded by compliance score, so gaps across the country are visible at a glance.",
    icon: <MapPin className="size-5" aria-hidden="true" />,
    tile: iconTileAmber,
  },
  {
    title: "Officer review workflow",
    description:
      "A guided manual review queue with sign-off steps and audit trail for checks that need a human decision.",
    icon: <MessageSquare className="size-5" aria-hidden="true" />,
    tile: iconTileInfo,
  },
  {
    title: "Track progress over time",
    description:
      "Compare scans against earlier snapshots — weekly, monthly, quarterly, or yearly — and see what changed.",
    icon: <CalendarClock className="size-5" aria-hidden="true" />,
    tile: iconTileGreen,
  },
  {
    title: "Standards embedded",
    description:
      "Every finding links straight to the exact clause in the official standard PDF — no more hunting through documents.",
    icon: <BookOpen className="size-5" aria-hidden="true" />,
    tile: iconTileAmber,
  },
];

const TOOLS: Array<{
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
  tile: string;
}> = [
  {
    href: "/scan",
    title: "Scan a site",
    description: "Run compliance checks on a .go.ke / .gov.ke site",
    icon: <ScanSearch className="size-5" aria-hidden="true" />,
    tile: iconTileGreen,
  },
  {
    href: "/registry",
    title: "MCDA registry",
    description: "Compliance scores for ministries, counties & agencies",
    icon: <LayoutGrid className="size-5" aria-hidden="true" />,
    tile: iconTileInfo,
  },
  {
    href: "/map",
    title: "Kenya map",
    description: "County compliance across the country at a glance",
    icon: <Map className="size-5" aria-hidden="true" />,
    tile: iconTileAmber,
  },
  {
    href: "/standards",
    title: "Standards",
    description: "ICTA.6.003:2023 §6.5 — the rulebook behind every scan",
    icon: <BookOpen className="size-5" aria-hidden="true" />,
    tile: iconTileInfo,
  },
  {
    href: "/review",
    title: "Officer review",
    description: "Guided manual review queue for site inspections",
    icon: <ClipboardCheck className="size-5" aria-hidden="true" />,
    tile: iconTileGreen,
  },
  {
    href: "/health",
    title: "System health",
    description: "Frontend & backend connectivity check",
    icon: <Activity className="size-5" aria-hidden="true" />,
    tile: iconTileAmber,
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flag-stripe h-1.5 w-full shrink-0" aria-hidden="true" />

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center bg-background px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-20 md:pt-24">
        <div className="hero-backdrop relative isolate w-full max-w-6xl overflow-hidden">
          <div className="hero-grid pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />

          <div className="relative mx-auto max-w-3xl text-center">
            <div className="mb-4 flex justify-center sm:mb-6 animate-fade-in-up">
              <SentinelMark state="idle" size={96} className="sm:hidden [&>div]:!w-[96px] [&>div]:!h-[96px]" />
              <SentinelMark state="idle" size={128} className="hidden sm:block" />
            </div>

            <p
              className="mb-2.5 flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-icta-gray-500 animate-fade-in-up sm:mb-3 sm:text-sm"
              style={{ animationDelay: "120ms" }}
            >
              <span className="h-px w-4 bg-icta-green/40 sm:w-6" aria-hidden="true" />
              ICT Authority, Kenya
              <span className="h-px w-4 bg-icta-red/40 sm:w-6" aria-hidden="true" />
            </p>

            <h1
              className="mb-4 text-[1.75rem] font-bold tracking-tight text-icta-gray-900 animate-fade-in-up text-balance sm:mb-5 sm:text-5xl md:text-6xl font-serif"
              style={{ animationDelay: "200ms" }}
            >
              Keep government websites{" "}
              <span className="text-gradient">compliant</span>
            </h1>

            <p
              className="mx-auto mb-2 max-w-2xl text-base text-icta-gray-600 animate-fade-in-up sm:text-lg md:text-xl"
              style={{ animationDelay: "280ms" }}
            >
              Sentinel scans public{" "}
              <StandardDocLink>ICTA.6.003:2023 §6.5</StandardDocLink> compliance
              — automated checks, scoring, and officer review in one place.
            </p>

            <p
              className="mb-8 text-sm text-icta-gray-500 animate-fade-in-up sm:mb-10"
              style={{ animationDelay: "340ms" }}
            >
              For ministries, counties, and agencies across Kenya
            </p>

            <div className="animate-fade-in-up" style={{ animationDelay: "400ms" }}>
              <HomeHeroActions />
            </div>

            {/* Floating hero cards — hidden on mobile, shown on lg+ */}
            <div
              className="relative mx-auto mt-10 w-full max-w-xl animate-fade-in-up sm:mt-14 lg:mt-14"
              style={{ animationDelay: "480ms" }}
            >
              <div
                className="glass-card animate-float-slow absolute -left-32 top-8 hidden w-48 items-center gap-2.5 rounded-2xl p-3 lg:flex"
                aria-hidden="true"
              >
                <SentinelMark state="complete" size={34} />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-icta-gray-900">
                    Scan complete
                  </span>
                  <span className="block text-[11px] text-icta-gray-600">
                    8 categories · 41s
                  </span>
                </span>
              </div>

              <div
                className="glass-card animate-float-slower absolute -right-32 bottom-10 hidden w-48 items-center gap-2.5 rounded-2xl p-3 lg:flex"
                aria-hidden="true"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-icta-amber-tint/70 text-icta-amber">
                  <ClipboardCheck className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-icta-gray-900">
                    Review queue
                  </span>
                  <span className="block text-[11px] text-icta-gray-600">
                    3 findings await sign-off
                  </span>
                </span>
              </div>

              <div className="glass-card animate-float rounded-2xl p-4 text-left sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-icta-gray-500">
                      <span className="size-1.5 rounded-full bg-icta-green" aria-hidden="true" />
                      Latest scan · Ministry of Health
                    </p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="font-serif text-2xl font-bold tabular-nums text-icta-gray-900 sm:text-3xl">
                        92.4
                      </span>
                      <span className={badgeGreen}>Up 2.1</span>
                    </div>
                  </div>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-icta-green-tint/70 text-icta-green sm:size-12">
                    <ShieldCheck className="size-5 sm:size-6" aria-hidden="true" />
                  </span>
                </div>
                <div
                  className="mt-3 h-2 overflow-hidden rounded-full bg-icta-gray-200/70"
                  aria-hidden="true"
                >
                  <div className="h-full w-[92%] rounded-full bg-gradient-to-r from-icta-green-deep to-icta-green-bright" />
                </div>
                <p className="mt-2 flex items-center justify-between text-[11px] text-icta-gray-600">
                  <span>12 / 12 standards passed</span>
                  <span className="tabular-nums">Next check: Fri</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics strip */}
        <dl className="mx-auto mt-12 grid w-full max-w-3xl grid-cols-2 gap-4 sm:mt-16 sm:gap-x-6 sm:gap-y-8 md:grid-cols-4">
          {METRICS.map((metric) => (
            <div key={metric.label} className="rounded-xl border border-icta-gray-200/60 bg-white px-4 py-3 text-center shadow-card sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
              <dd className="font-serif text-2xl font-bold text-icta-gray-900 sm:text-3xl">
                {metric.value}
              </dd>
              <dt className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-icta-gray-500 sm:mt-1 sm:text-xs">
                {metric.label}
              </dt>
            </div>
          ))}
        </dl>

        {/* Benefits */}
        <section
          className="mx-auto mt-14 w-full max-w-5xl sm:mt-20"
          aria-labelledby="benefits-heading"
        >
          <h2
            id="benefits-heading"
            className="mb-2 text-center text-xl font-bold tracking-tight text-icta-gray-900 sm:mb-3 sm:text-2xl md:text-3xl font-serif"
          >
            Why Sentinel
          </h2>
          <p className="mx-auto mb-6 max-w-2xl text-center text-sm text-icta-gray-600 sm:mb-10 sm:text-base">
            Everything your team needs to understand and improve website
            compliance across the public sector.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {BENEFITS.map((benefit, index) => (
              <ScrollReveal key={benefit.title} delay={index * 60}>
                <Card className="card-hover h-full">
                  <CardContent className="p-4 sm:p-5">
                    <span className={`${iconTile} ${benefit.tile} mb-3 size-9 sm:mb-4 sm:size-10`}>
                      {benefit.icon}
                    </span>
                    <h3 className="mb-1 text-sm font-semibold text-icta-gray-900 sm:mb-1.5 sm:text-base font-serif">
                      {benefit.title}
                    </h3>
                    <p className="text-xs leading-relaxed text-icta-gray-600 sm:text-sm">
                      {benefit.description}
                    </p>
                  </CardContent>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* Tools */}
        <section className="mx-auto mt-14 w-full max-w-5xl sm:mt-20" aria-labelledby="tools-heading">
          <h2
            id="tools-heading"
            className="mb-2 text-center text-xl font-bold tracking-tight text-icta-gray-900 sm:mb-3 sm:text-2xl md:text-3xl font-serif"
          >
            Tools
          </h2>
          <p className="mx-auto mb-6 max-w-2xl text-center text-sm text-icta-gray-600 sm:mb-10 sm:text-base">
            Jump straight into the workspace.
          </p>

          <nav
            aria-label="Sentinel tools"
            className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3"
          >
            {TOOLS.map((item, index) => (
              <ScrollReveal key={item.href} delay={index * 60}>
                <Link
                  href={item.href}
                  className="card card-hover group flex h-full items-center gap-3 px-3 py-3 text-left sm:items-start sm:px-4 sm:py-4"
                >
                  <span
                    className={`${iconTile} ${item.tile} size-9 shrink-0 transition-transform group-hover:scale-105 sm:size-10`}
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-icta-gray-900">
                      {item.title}
                      <ArrowRight
                        className="size-3.5 -translate-x-0.5 text-icta-gray-500 transition-transform group-hover:translate-x-0 group-hover:text-icta-green"
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
        <section className="mt-14 w-full max-w-4xl text-center sm:mt-20">
          <div className="relative overflow-hidden rounded-2xl border border-icta-green-deep/60 bg-gradient-to-br from-[#002e14] via-icta-green-deep to-icta-green px-5 py-10 shadow-pop sm:px-6 sm:py-14">
            <div
              className="hero-grid pointer-events-none absolute inset-0 opacity-40"
              aria-hidden="true"
            />
            <div className="relative">
              <span className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-inset ring-white/20 sm:mb-6 sm:size-14">
                <ShieldCheck className="size-6 sm:size-7" aria-hidden="true" />
              </span>
              <h2 className="mb-2 text-xl font-bold tracking-tight text-white sm:mb-3 sm:text-2xl md:text-3xl font-serif">
                Ready to check your first site?
              </h2>
              <p className="mx-auto mb-6 max-w-xl text-sm text-white/85 sm:mb-8 sm:text-base">
                Create an account and run a compliance scan on any public .go.ke
                or .gov.ke website — results are ready in under a minute.
              </p>
              <HomeHeroActions tone="on-dark" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
