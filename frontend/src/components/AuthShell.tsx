"use client";

import type { ReactNode } from "react";

import { SentinelMark } from "@/components/SentinelMark";
import { card, eyebrow } from "@/lib/ui";

/** Centered card shell shared by login / register / onboarding pages. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  markLabel,
  eyebrowLabel,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  markLabel?: string;
  eyebrowLabel?: string;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12 animate-fade-in-up">
        <div className={`${card} relative overflow-hidden px-6 py-9 sm:px-9`}>
          <div className="flag-stripe absolute inset-x-0 top-0 h-1" aria-hidden="true" />
          <div className="mb-6 flex flex-col items-center text-center">
            <SentinelMark state="idle" size={68} label={markLabel} />
            {eyebrowLabel ? (
              <p className={`mt-4 ${eyebrow}`}>{eyebrowLabel}</p>
            ) : null}
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-icta-gray-900 font-serif">
              {title}
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-icta-gray-600">
              {subtitle}
            </p>
          </div>
          {children}
        </div>

        {footer && (
          <p className="mt-6 text-center text-sm text-icta-gray-600">
            {footer}
          </p>
        )}
      </main>
    </div>
  );
}
