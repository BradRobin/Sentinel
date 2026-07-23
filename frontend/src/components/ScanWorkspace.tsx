"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { SentinelMark } from "@/components/SentinelMark";
import {
  createScan,
  getScan,
  type Finding,
  type ScanStatusResponse,
} from "@/lib/api";
import type { SentinelMarkState } from "@/lib/sentinel-mark-paths";

function markStateFromStatus(status: string | null): SentinelMarkState {
  if (!status || status === "queued" || status === "running") return "processing";
  if (status === "complete") return "complete";
  return "idle";
}

export function ScanWorkspace() {
  const [url, setUrl] = useState("https://www.ict.go.ke");
  const [force, setForce] = useState(false);
  const [markState, setMarkState] = useState<SentinelMarkState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanStatusResponse | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [progress, setProgress] = useState<string | null>(null);

  const overallScore =
    scan?.result?.overall_score ?? scan?.result?.scores?.overall_score ?? null;
  const categoryScores = scan?.result?.scores?.categories ?? [];

  async function pollUntilDone(jobId: string) {
    for (let i = 0; i < 90; i++) {
      const status = await getScan(jobId);
      setScan(status);
      setProgress(status.progress ?? null);
      setMarkState(markStateFromStatus(status.status));

      if (status.status === "complete") {
        setFindings(status.result?.findings ?? []);
        setProgress(null);
        return;
      }
      if (status.status === "failed") {
        setError(status.error ?? "Scan failed");
        setProgress(null);
        return;
      }
      await new Promise((r) => setTimeout(r, 800));
    }
    setError("Scan timed out");
    setMarkState("idle");
    setProgress(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setScan(null);
    setFindings([]);
    setProgress("Queued…");
    setMarkState("processing");

    try {
      const job = await createScan(url.trim(), { force });
      setScan({
        ...job,
        url: job.url,
        result: null,
        error: null,
        cache_hit: job.cache_hit,
        progress: job.progress ?? null,
      });

      if (job.status === "complete" && job.cache_hit) {
        // Cache hit — fetch full payload (findings) via GET
        const full = await getScan(job.job_id);
        setScan(full);
        setFindings(full.result?.findings ?? []);
        setMarkState("complete");
        setProgress(null);
        return;
      }

      await pollUntilDone(job.job_id);
    } catch (err) {
      setMarkState("idle");
      setProgress(null);
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <Link
          href="/"
          className="mb-8 inline-block text-sm text-icta-gray-600 hover:text-icta-black"
        >
          ← Back
        </Link>

        <div className="mb-8 flex flex-col items-center gap-3">
          <SentinelMark state={markState} size={120} />
          <p className="text-sm text-icta-gray-600">
            {markState === "processing" && (progress || "Running compliance checks…")}
            {markState === "complete" &&
              (scan?.cache_hit
                ? "Served from cache (fresh within 24h)"
                : "Scan complete")}
            {markState === "idle" && !scan && "Enter a .go.ke URL to scan"}
          </p>
        </div>

        <h1 className="mb-2 text-2xl font-bold text-icta-black">Scan</h1>
        <p className="mb-6 text-sm text-icta-gray-600">
          Full ICTA.6.002:2019 §6.4 checklist preview — results cached for 24 hours
        </p>

        <form onSubmit={onSubmit} className="mb-8 space-y-3">
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.go.ke"
            className="w-full rounded-md border border-icta-gray-200 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-icta-gray-600">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
            />
            Force fresh scan (bypass cache)
          </label>
          <button
            type="submit"
            disabled={markState === "processing"}
            className="rounded-md bg-icta-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Start scan
          </button>
        </form>

        {error && (
          <pre className="mb-6 whitespace-pre-wrap rounded-md bg-icta-red/10 p-3 text-sm text-icta-red">
            {error}
          </pre>
        )}

        {scan && (
          <p className="mb-4 text-sm text-icta-gray-600">
            Job: {scan.job_id} · Status: {scan.status}
            {scan.cache_hit ? " · cache hit" : ""}
            {scan.url ? ` · ${scan.url}` : ""}
          </p>
        )}

        {overallScore !== null && overallScore !== undefined && (
          <div className="mb-8 rounded-md border border-icta-gray-200 p-4">
            <div className="mb-1 text-sm font-medium uppercase tracking-wide text-icta-gray-600">
              Compliance score
            </div>
            <div className="mb-4 text-4xl font-bold text-icta-black">
              {Number(overallScore).toFixed(1)}%
            </div>
            {categoryScores.length > 0 && (
              <ul className="space-y-1 text-sm text-icta-gray-600">
                {categoryScores.map((c) => (
                  <li key={c.category} className="flex justify-between gap-4">
                    <span>{c.category.replaceAll("_", " ")}</span>
                    <span className="font-mono text-icta-black">
                      {Number(c.score).toFixed(1)}%
                      {c.weight != null ? ` · wt ${c.weight}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {findings.length > 0 && (
          <div>
            <h2 className="mb-3 text-lg font-semibold">
              Findings ({findings.length})
            </h2>
            <ul className="space-y-3">
              {findings.map((f) => (
                <li
                  key={`${f.check_name}-${f.clause_reference}`}
                  className="rounded-md border border-icta-gray-200 p-3 text-sm"
                >
                  <div className="font-medium">
                    [{f.status}] {f.check_name} — clause {f.clause_reference}
                  </div>
                  <div className="text-icta-gray-600">
                    {f.category} · {f.severity} · {f.automatability_type}
                  </div>
                  <pre className="mt-2 overflow-x-auto text-xs">
                    {JSON.stringify(f.detail, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
