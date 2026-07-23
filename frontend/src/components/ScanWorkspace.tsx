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
  const [markState, setMarkState] = useState<SentinelMarkState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanStatusResponse | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);

  async function pollUntilDone(jobId: string) {
    for (let i = 0; i < 60; i++) {
      const status = await getScan(jobId);
      setScan(status);
      setMarkState(markStateFromStatus(status.status));

      if (status.status === "complete") {
        setFindings(status.result?.findings ?? []);
        return;
      }
      if (status.status === "failed") {
        setError(status.error ?? "Scan failed");
        return;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    setError("Scan timed out");
    setMarkState("idle");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setScan(null);
    setFindings([]);
    setMarkState("processing");

    try {
      const job = await createScan(url.trim());
      setScan({ ...job, url: job.url, result: null, error: null });
      await pollUntilDone(job.job_id);
    } catch (err) {
      setMarkState("idle");
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
            {markState === "processing" && "Running compliance checks…"}
            {markState === "complete" && "Scan complete"}
            {markState === "idle" && !scan && "Enter a .go.ke URL to scan"}
          </p>
        </div>

        <h1 className="mb-2 text-2xl font-bold text-icta-black">Scan</h1>
        <p className="mb-6 text-sm text-icta-gray-600">
          Security, domain format, and SEO checks (Phase 2 preview)
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
            {scan.url ? ` · ${scan.url}` : ""}
          </p>
        )}

        {findings.length > 0 && (
          <div>
            <h2 className="mb-3 text-lg font-semibold">Findings ({findings.length})</h2>
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
