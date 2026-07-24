"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { ScanResults } from "@/components/ScanResults";
import { SentinelMark } from "@/components/SentinelMark";
import {
  createScan,
  getScan,
  type Finding,
  type ScanStatusResponse,
} from "@/lib/api";
import {
  checkingLabel,
  classifyScanError,
  errorHint,
  errorTitle,
  type ScanErrorKind,
} from "@/lib/findings";
import type { SentinelMarkState } from "@/lib/sentinel-mark-paths";

const POLL_INTERVAL_MS = 600;
const STALE_CATEGORY_MS = 15_000;
const MAX_POLLS = 120;

function markStateFromStatus(status: string | null): SentinelMarkState {
  if (!status || status === "queued" || status === "running") return "processing";
  if (status === "complete") return "complete";
  return "idle";
}

/** Label under SentinelMark while a job is processing — driven by Redis progress. */
function processingLabel(
  status: ScanStatusResponse | null,
  fallbackQueued: string,
  lastCategoryAt: number,
  now: number,
): string {
  if (!status || status.status === "queued") return fallbackQueued;
  if (status.status !== "running") return fallbackQueued;

  const category = status.current_category ?? null;
  // Gap between queued → worker start / fetch: stay on Queued… until first category
  if (!category) return fallbackQueued;

  if (now - lastCategoryAt >= STALE_CATEGORY_MS) {
    return "Still working…";
  }

  return checkingLabel(category) ?? "Running compliance checks…";
}

interface ErrorState {
  kind: ScanErrorKind;
  message: string;
}

function EmptyIdle() {
  return (
    <div className="rounded-md border border-dashed border-icta-gray-200 px-4 py-10 text-center">
      <p className="text-sm font-medium text-icta-black">No scan yet</p>
      <p className="mt-1 text-sm text-icta-gray-600">
        Enter a public .go.ke or .gov.ke URL above to run compliance checks.
      </p>
    </div>
  );
}

export function ScanWorkspace() {
  const [url, setUrl] = useState("https://www.ict.go.ke");
  const [force, setForce] = useState(false);
  const [markState, setMarkState] = useState<SentinelMarkState>("idle");
  const [error, setError] = useState<ErrorState | null>(null);
  const [scan, setScan] = useState<ScanStatusResponse | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const overallScore =
    scan?.result?.overall_score ?? scan?.result?.scores?.overall_score ?? null;
  const categoryScores = scan?.result?.scores?.categories ?? [];
  const showEmptyIdle =
    !hasSubmitted && !error && findings.length === 0 && markState === "idle";
  const showEmptyComplete =
    hasSubmitted &&
    markState === "complete" &&
    !error &&
    findings.length === 0;

  function setErrorFromMessage(message: string) {
    const kind = classifyScanError(message);
    setError({ kind, message });
  }

  async function pollUntilDone(jobId: string) {
    let lastCategory: string | null = null;
    let lastCategoryAt = Date.now();

    for (let i = 0; i < MAX_POLLS; i++) {
      const status = await getScan(jobId);
      const now = Date.now();
      const category = status.current_category ?? null;

      if (category !== lastCategory) {
        lastCategory = category;
        lastCategoryAt = now;
      }

      setScan(status);
      setMarkState(markStateFromStatus(status.status));

      if (status.status === "complete") {
        setFindings(status.result?.findings ?? []);
        setProgressLabel(null);
        return;
      }
      if (status.status === "failed") {
        const detail = status.error ?? "Scan failed";
        const withCategory = status.error_category
          ? `${detail} (${status.error_category})`
          : detail;
        setErrorFromMessage(withCategory);
        setProgressLabel(null);
        setMarkState("idle");
        return;
      }

      setProgressLabel(
        processingLabel(status, "Queued…", lastCategoryAt, now),
      );
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    setErrorFromMessage("Scan timed out");
    setMarkState("idle");
    setProgressLabel(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setHasSubmitted(true);
    setError(null);
    setScan(null);
    setFindings([]);
    setProgressLabel("Queued…");
    setMarkState("processing");

    const trimmed = url.trim();
    if (!trimmed) {
      setErrorFromMessage("URL is required");
      setMarkState("idle");
      setProgressLabel(null);
      return;
    }

    try {
      const job = await createScan(trimmed, { force });
      setScan({
        ...job,
        url: job.url,
        result: null,
        error: null,
        cache_hit: job.cache_hit,
        progress: job.progress ?? null,
        current_category: job.current_category ?? null,
        categories_completed: job.categories_completed ?? [],
        total_categories: job.total_categories ?? 8,
      });

      // Cache hit: skip processing flash — go straight to results
      if (job.status === "complete" && job.cache_hit) {
        const full = await getScan(job.job_id);
        setScan(full);
        setFindings(full.result?.findings ?? []);
        setMarkState("complete");
        setProgressLabel(null);
        return;
      }

      await pollUntilDone(job.job_id);
    } catch (err) {
      setMarkState("idle");
      setProgressLabel(null);
      setErrorFromMessage(err instanceof Error ? err.message : "Unknown error");
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <Link
          href="/"
          className="mb-8 inline-block text-sm text-icta-gray-600 hover:text-icta-black"
        >
          ← Back
        </Link>

        <div className="mb-8 flex flex-col items-center gap-3">
          <SentinelMark state={markState} size={120} />
          <p className="text-sm text-icta-gray-600">
            {markState === "processing" &&
              (progressLabel || "Queued…")}
            {markState === "complete" &&
              (scan?.cache_hit
                ? "Served from cache (fresh within 24h)"
                : "Scan complete")}
            {markState === "idle" && !hasSubmitted && "Enter a .go.ke URL to scan"}
            {markState === "idle" && hasSubmitted && error && errorTitle(error.kind)}
          </p>
        </div>

        <h1 className="mb-2 text-2xl font-bold text-icta-black">Scan</h1>
        <p className="mb-6 text-sm text-icta-gray-600">
          ICTA.6.002:2019 §6.4 compliance checks — results cached for 24 hours
        </p>

        <form onSubmit={onSubmit} className="mb-8 space-y-3">
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.go.ke"
            className="w-full rounded-md border border-icta-gray-200 px-3 py-2 text-sm"
            disabled={markState === "processing"}
          />
          <label className="flex items-center gap-2 text-sm text-icta-gray-600">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              disabled={markState === "processing"}
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
          <div
            className="mb-8 rounded-md border border-icta-red/20 bg-icta-red/5 px-4 py-4"
            role="alert"
          >
            <p className="font-semibold text-icta-red">{errorTitle(error.kind)}</p>
            <p className="mt-1 text-sm text-icta-gray-600">
              {errorHint(error.kind)}
            </p>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-icta-red/90">
              {error.message}
            </pre>
          </div>
        )}

        {showEmptyIdle && <EmptyIdle />}

        {showEmptyComplete && (
          <div className="rounded-md border border-dashed border-icta-gray-200 px-4 py-8 text-center text-sm text-icta-gray-600">
            Scan finished, but no findings were returned.
          </div>
        )}

        {scan && markState === "complete" && findings.length > 0 && (
          <div className="mb-4 text-xs text-icta-gray-600">
            Job {scan.job_id}
            {scan.cache_hit ? " · cache" : ""}
          </div>
        )}

        {findings.length > 0 && (
          <ScanResults
            findings={findings}
            overallScore={
              overallScore !== null && overallScore !== undefined
                ? Number(overallScore)
                : null
            }
            categoryScores={categoryScores}
            cacheHit={scan?.cache_hit}
            scannedUrl={scan?.url}
            jobId={scan?.job_id}
          />
        )}
      </main>
    </div>
  );
}
