"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, TriangleAlert } from "lucide-react";

import { SentinelMark } from "@/components/SentinelMark";
import { ErrorState } from "@/components/ErrorState";
import { fetchBackendHealth, type HealthResponse } from "@/lib/api";
import type { SentinelMarkState } from "@/lib/sentinel-mark-paths";
import { badgeAmber, badgeGreen, badgeRed, meta, sectionLabel } from "@/lib/ui";

function statusBadge(value: string) {
  if (value === "ok") {
    return {
      className: badgeGreen,
      icon: <CheckCircle2 className="size-3.5 text-icta-green" aria-hidden="true" />,
      dot: "bg-icta-green",
    };
  }
  if (value === "degraded") {
    return {
      className: badgeAmber,
      icon: <TriangleAlert className="size-3.5 text-icta-amber" aria-hidden="true" />,
      dot: "bg-icta-amber",
    };
  }
  return {
    className: badgeRed,
    icon: <TriangleAlert className="size-3.5 text-icta-red" aria-hidden="true" />,
    dot: "bg-icta-red",
  };
}

function StatusBadge({ label, value }: { label: string; value: string }) {
  const tone = statusBadge(value);
  return (
    <div className="card flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm font-medium text-icta-gray-900">{label}</span>
      <span className={`${tone.className} gap-1.5`}>
        {tone.icon}
        <span className={`size-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
        {value}
      </span>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="card flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm font-medium text-icta-gray-900">{label}</span>
      <span className={`font-mono text-sm ${meta}`}>{value}</span>
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

        <h1 className="mb-2 text-2xl font-bold tracking-tight text-icta-gray-900 font-serif">
          System health
        </h1>
        <p className="mb-8 text-sm text-icta-gray-600">
          Frontend and backend connectivity check
        </p>

        <section className="mb-6 card animate-fade-in-up p-4">
          <h2 className={`mb-3 ${sectionLabel}`}>Frontend</h2>
          <StatusBadge label="Next.js" value="ok" />
        </section>

        <section
          className="card animate-fade-in-up p-4"
          style={{ animationDelay: "100ms" }}
        >
          <h2 className={`mb-3 ${sectionLabel}`}>Backend API</h2>

          {markState === "processing" && (
            <p className="flex items-center gap-2 text-sm text-icta-gray-600">
              <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
              Fetching status…
            </p>
          )}

          {error && <ErrorState message={error} />}

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
