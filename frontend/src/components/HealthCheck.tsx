"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { SentinelMark } from "@/components/SentinelMark";
import { fetchBackendHealth, type HealthResponse } from "@/lib/api";
import type { SentinelMarkState } from "@/lib/sentinel-mark-paths";

function StatusBadge({ label, value }: { label: string; value: string }) {
  const ok = value === "ok";
  return (
    <div className="flex items-center justify-between rounded-lg border border-icta-gray-200 px-4 py-3">
      <span className="text-sm font-medium text-icta-gray-600">{label}</span>
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
          ok
            ? "bg-icta-green/10 text-icta-green"
            : "bg-icta-red/10 text-icta-red"
        }`}
      >
        {value}
      </span>
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
        setMarkState(data.status === "ok" ? "complete" : "idle");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Unknown error");
        setMarkState("idle");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex h-2 w-full">
        <div className="flex-1 bg-icta-black" />
        <div className="flex-1 bg-icta-red" />
        <div className="flex-1 bg-icta-green" />
      </div>

      <main className="mx-auto w-full max-w-lg flex-1 px-6 py-16">
        <Link
          href="/"
          className="mb-8 inline-block text-sm text-icta-gray-600 hover:text-icta-black"
        >
          ← Back
        </Link>

        <div className="mb-8 flex flex-col items-center gap-3">
          <SentinelMark state={markState} size={120} />
          <p className="text-sm text-icta-gray-600">
            {markState === "processing" && "Checking backend connectivity…"}
            {markState === "complete" && "All systems operational"}
            {markState === "idle" && error && "Backend unreachable"}
            {markState === "idle" && !error && health?.status === "degraded" &&
              "Some services degraded"}
          </p>
        </div>

        <h1 className="mb-2 text-2xl font-bold text-icta-black">
          System health
        </h1>
        <p className="mb-8 text-sm text-icta-gray-600">
          Frontend and backend connectivity check
        </p>

        <div className="mb-6 rounded-lg border border-icta-gray-200 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-icta-gray-600">
            Frontend
          </h2>
          <StatusBadge label="Next.js" value="ok" />
        </div>

        <div className="rounded-lg border border-icta-gray-200 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-icta-gray-600">
            Backend API
          </h2>

          {markState === "processing" && (
            <p className="text-sm text-icta-gray-600">Fetching status…</p>
          )}

          {error && (
            <div className="rounded-lg bg-icta-red/10 px-4 py-3 text-sm text-icta-red">
              {error}
            </div>
          )}

          {health && markState !== "processing" && (
            <div className="space-y-2">
              <StatusBadge label="Overall" value={health.status} />
              <div className="flex items-center justify-between rounded-lg border border-icta-gray-200 px-4 py-3">
                <span className="text-sm font-medium text-icta-gray-600">
                  Version
                </span>
                <span className="font-mono text-sm text-icta-black">
                  {health.version}
                </span>
              </div>
              <StatusBadge label="Redis" value={health.redis} />
              <StatusBadge label="Database" value={health.db} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
