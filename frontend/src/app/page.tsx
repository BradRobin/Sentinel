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
  iconTile,
  iconTileAmber,
  iconTileGreen,
  iconTileInfo,
} from "@/lib/ui";

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
      <main className="flex flex-1 flex-col items-center bg-background px-6 pb-16 pt-16 sm:pt-24">
        <div className="hero-backdrop relative isolate w-full max-w-6xl overflow-hidden">
          <div className="hero-grid pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />

          <div className="relative mx-auto max-w-3xl text-center">
            <div className="mb-6 flex justify-center animate-fade-in-up">
              <SentinelMark state="idle" size={128} />
            </div>

            <p
              className="mb-3 flex items-center justify-center gap-2 text-sm font-medium uppercase tracking-[0.2em] text-icta-gray-500 animate-fade-in-up"
              style={{ animationDelay: "120ms" }}
            >
              <span className="h-px w-6 bg-icta-green/40" aria-hidden="true" />
              ICT Authority, Kenya
              <span className="h-px w-6 bg-icta-red/40" aria-hidden="true" />
            </p>

            <h1
              className="mb-5 text-4xl font-bold tracking-tight text-icta-gray-900 animate-fade-in-up text-balance sm:text-6xl font-serif"
              style={{ animationDelay: "200ms" }}
            >
              Keep government websites{" "}
              <span className="text-gradient">compliant</span>
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
              className="mb-10 text-sm text-icta-gray-500 animate-fade-in-up"
              style={{ animationDelay: "340ms" }}
            >
              For ministries, counties, and agencies across Kenya
            </p>

            <div className="animate-fade-in-up" style={{ animationDelay: "400ms" }}>
              <HomeHeroActions />
            </div>
          </div>
        </div>

        {/* Benefits */}
        <section
          className="mx-auto mt-20 w-full max-w-5xl"
          aria-labelledby="benefits-heading"
        >
          <h2
            id="benefits-heading"
            className="mb-3 text-center text-2xl font-bold tracking-tight text-icta-gray-900 sm:text-3xl font-serif"
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
                <Card className="card-hover h-full">
                  <CardContent className="p-5">
                    <span className={`${iconTile} ${benefit.tile} mb-4`}>
                      {benefit.icon}
                    </span>
                    <h3 className="mb-1.5 font-semibold text-icta-gray-900 font-serif">
                      {benefit.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-icta-gray-600">
                      {benefit.description}
                    </p>
                  </CardContent>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* Tools */}
        <section className="mx-auto mt-20 w-full max-w-5xl" aria-labelledby="tools-heading">
          <h2
            id="tools-heading"
            className="mb-3 text-center text-2xl font-bold tracking-tight text-icta-gray-900 sm:text-3xl font-serif"
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
                  <span
                    className={`${iconTile} ${item.tile} size-10 transition-transform group-hover:scale-105`}
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
        <section className="mt-20 w-full max-w-4xl text-center">
          <div className="relative overflow-hidden rounded-2xl border border-icta-green-deep/60 bg-gradient-to-br from-[#002e14] via-icta-green-deep to-icta-green px-6 py-14 shadow-pop">
            <div
              className="hero-grid pointer-events-none absolute inset-0 opacity-40"
              aria-hidden="true"
            />
            <div className="relative">
              <span className="mb-6 inline-flex size-14 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-inset ring-white/20">
                <ShieldCheck className="size-7" aria-hidden="true" />
              </span>
              <h2 className="mb-3 text-2xl font-bold tracking-tight text-white sm:text-3xl font-serif">
                Ready to check your first site?
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-sm text-white/85 sm:text-base">
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
