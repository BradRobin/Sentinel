"use client";

import type { ReactNode } from "react";

import { SentinelMark } from "@/components/SentinelMark";

/** Centered card shell shared by login / register / onboarding pages. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  markLabel,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  markLabel?: string;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12 animate-fade-in-up">
        <div className="card px-6 py-8 sm:px-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <SentinelMark state="idle" size={72} label={markLabel} />
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-icta-black">
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
