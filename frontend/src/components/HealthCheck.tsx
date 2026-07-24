"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { SentinelMark } from "@/components/SentinelMark";
import { fetchBackendHealth, type HealthResponse } from "@/lib/api";
import type { SentinelMarkState } from "@/lib/sentinel-mark-paths";
import { linkQuiet } from "@/lib/ui";

function statusTone(value: string): {
  pill: string;
  dot: string;
} {
  if (value === "ok") {
    return {
      pill: "bg-icta-green/10 text-icta-green",
      dot: "bg-icta-green",
    };
  }
  if (value === "degraded") {
    return {
      pill: "bg-icta-amber/10 text-icta-amber",
      dot: "bg-icta-amber",
    };
  }
  return {
    pill: "bg-icta-red/10 text-icta-red",
    dot: "bg-icta-red",
  };
}

function StatusBadge({ label, value }: { label: string; value: string }) {
  const tone = statusTone(value);
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-icta-gray-200 bg-white px-4 py-3">
      <span className="text-sm font-medium text-icta-black">{label}</span>
      <span
        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${tone.pill}`}
      >
        <span
          className={`size-1.5 shrink-0 rounded-full ${tone.dot}`}
          aria-hidden="true"
        />
        {value}
      </span>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-icta-gray-200 bg-white px-4 py-3">
      <span className="text-sm font-medium text-icta-black">{label}</span>
      <span className="font-mono text-sm text-icta-gray-600">{value}</span>
    </div>
  );
}

export function HealthCheck() {
  const [markState, setMarkState] = useState<SentinelMarkState>("processing");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setMarkState("processing");
      setError(null);
      try {
        const data = await fetchBackendHealth();
        if (cancelled) return;
        setHealth(data);
        if (data.status === "ok") setMarkState("complete");
        else if (data.status === "degraded") setMarkState("idle");
        else setMarkState("error");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Unknown error");
        setMarkState("error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-lg flex-1 px-6 py-16">
        <Link href="/" className={`mb-8 inline-block ${linkQuiet}`}>
          ← Back
        </Link>

        <div className="mb-8 flex flex-col items-center gap-3">
          <SentinelMark state={markState} size={120} />
          <p className="text-center text-sm text-icta-gray-600">
            {markState === "processing" && "Checking backend connectivity…"}
            {markState === "complete" && "All systems operational"}
            {markState === "error" && "Backend unreachable"}
            {markState === "idle" &&
              health?.status === "degraded" &&
              "Some services degraded"}
          </p>
        </div>

        <h1 className="mb-2 text-2xl font-bold text-icta-black">
          System health
        </h1>
        <p className="mb-8 text-sm text-icta-gray-600">
          Frontend and backend connectivity check
        </p>

        <section className="mb-6 rounded-md border border-icta-gray-200 p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-icta-gray-600">
            Frontend
          </h2>
          <StatusBadge label="Next.js" value="ok" />
        </section>

        <section className="rounded-md border border-icta-gray-200 p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-icta-gray-600">
            Backend API
          </h2>

          {markState === "processing" && (
            <p className="text-sm text-icta-gray-600">Fetching status…</p>
          )}

          {error && (
            <div
              className="rounded-md border border-icta-red/20 bg-icta-red/5 px-4 py-3 text-sm text-icta-red"
              role="alert"
            >
              {error}
            </div>
          )}

          {health && markState !== "processing" && (
            <div className="space-y-2">
              <StatusBadge label="Overall" value={health.status} />
              <MetaRow label="Version" value={health.version} />
              <StatusBadge label="Redis" value={health.redis} />
              <StatusBadge label="Database" value={health.db} />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
