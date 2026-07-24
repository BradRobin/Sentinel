"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { ScanResults } from "@/components/ScanResults";
import { SentinelMark } from "@/components/SentinelMark";
import {
  ScanApiError,
  createScan,
  getScan,
  type Finding,
  type ScanStatusResponse,
} from "@/lib/api";
import {
  checkingLabel,
  classifyScanError,
  formValidationMessage,
  isFormValidationError,
  scanFailureMessage,
  type ScanErrorKind,
} from "@/lib/findings";
import type { SentinelMarkState } from "@/lib/sentinel-mark-paths";

const POLL_INTERVAL_MS = 600;
const STALE_CATEGORY_MS = 15_000;
const MAX_POLLS = 120;

function markStateFromStatus(status: string | null): SentinelMarkState {
  if (!status || status === "queued" || status === "running") return "processing";
  if (status === "complete") return "complete";
  if (status === "failed") return "error";
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
  if (!category) return fallbackQueued;

  if (now - lastCategoryAt >= STALE_CATEGORY_MS) {
    return "Still working…";
  }

  return checkingLabel(category) ?? "Running compliance checks…";
}

function clientValidateUrl(raw: string): ScanErrorKind | null {
  const trimmed = raw.trim();
  if (!trimmed) return "invalid_url";
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "invalid_url";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "invalid_url";
  }
  const host = parsed.hostname.toLowerCase();
  if (!host.endsWith(".go.ke") && !host.endsWith(".gov.ke")) {
    return "domain_not_allowed";
  }
  return null;
}

interface ScanLevelError {
  kind: ScanErrorKind;
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
  const [fieldError, setFieldError] = useState<ScanErrorKind | null>(null);
  const [scanError, setScanError] = useState<ScanLevelError | null>(null);
  const [scan, setScan] = useState<ScanStatusResponse | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [attachedNote, setAttachedNote] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const overallScore =
    scan?.result?.overall_score ?? scan?.result?.scores?.overall_score ?? null;
  const categoryScores = scan?.result?.scores?.categories ?? [];
  const showEmptyIdle =
    !hasSubmitted &&
    !fieldError &&
    !scanError &&
    findings.length === 0 &&
    markState === "idle";
  const showEmptyComplete =
    hasSubmitted &&
    markState === "complete" &&
    !scanError &&
    findings.length === 0;

  function setScanLevelFailure(kind: ScanErrorKind) {
    setFieldError(null);
    setScanError({ kind });
    setMarkState("error");
    setProgressLabel(null);
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
        // duplicate_in_progress should never surface as an error UI
        if (status.error_category === "duplicate_in_progress") {
          setProgressLabel("A scan for this URL is already in progress…");
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
          continue;
        }
        const kind = classifyScanError(
          status.error ?? "",
          status.error_category,
        );
        setScanLevelFailure(
          isFormValidationError(kind) ? "internal_error" : kind,
        );
        return;
      }

      setProgressLabel(
        processingLabel(status, "Queued…", lastCategoryAt, now),
      );
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    setScanLevelFailure("timeout");
  }

  async function startScan(options?: { forceFresh?: boolean }) {
    const forceFresh = options?.forceFresh ?? force;
    setHasSubmitted(true);
    setFieldError(null);
    setScanError(null);
    setScan(null);
    setFindings([]);
    setAttachedNote(false);

    const trimmed = url.trim();
    const localKind = clientValidateUrl(trimmed);
    if (localKind && isFormValidationError(localKind)) {
      setFieldError(localKind);
      setMarkState("idle");
      setProgressLabel(null);
      return;
    }

    setProgressLabel("Queued…");
    setMarkState("processing");

    try {
      const job = await createScan(trimmed, { force: forceFresh });
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
        attached_to_existing: job.attached_to_existing ?? false,
      });

      if (job.attached_to_existing) {
        setAttachedNote(true);
      }

      if (job.status === "complete" && job.cache_hit) {
        const full = await getScan(job.job_id);
        setScan(full);
        setFindings(full.result?.findings ?? []);
        setMarkState("complete");
        setProgressLabel(null);
        setAttachedNote(false);
        return;
      }

      await pollUntilDone(job.job_id);
    } catch (err) {
      const category =
        err instanceof ScanApiError ? err.errorCategory : null;
      const message = err instanceof Error ? err.message : "Unknown error";
      const kind = classifyScanError(message, category);

      if (isFormValidationError(kind)) {
        setFieldError(kind);
        setMarkState("idle");
        setProgressLabel(null);
        setScanError(null);
        return;
      }

      // DNS unreachable etc. rejected at submission — show scan-level error mark
      setScanLevelFailure(kind === "generic" ? "internal_error" : kind);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await startScan();
  }

  async function onRetry() {
    setForce(true);
    await startScan({ forceFresh: true });
  }

  const busy = markState === "processing";

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
          <p className="text-center text-sm text-icta-gray-600">
            {markState === "processing" &&
              (attachedNote
                ? progressLabel
                  ? `${progressLabel} (already in progress)`
                  : "A scan for this URL is already in progress…"
                : progressLabel || "Queued…")}
            {markState === "complete" &&
              (scan?.cache_hit
                ? "Served from cache (fresh within 24h)"
                : "Scan complete")}
            {markState === "error" &&
              scanError &&
              scanFailureMessage(scanError.kind)}
            {markState === "idle" &&
              !hasSubmitted &&
              "Enter a .go.ke URL to scan"}
            {markState === "idle" && hasSubmitted && fieldError && "Check the URL"}
          </p>
        </div>

        <h1 className="mb-2 text-2xl font-bold text-icta-black">Scan</h1>
        <p className="mb-6 text-sm text-icta-gray-600">
          ICTA.6.002:2019 §6.4 compliance checks — results cached for 24 hours
        </p>

        <form onSubmit={onSubmit} className="mb-8 space-y-3">
          <div>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (fieldError) setFieldError(null);
              }}
              placeholder="https://example.go.ke"
              className={`w-full rounded-md border px-3 py-2 text-sm ${
                fieldError
                  ? "border-icta-red focus:outline-icta-red"
                  : "border-icta-gray-200"
              }`}
              disabled={busy}
              aria-invalid={Boolean(fieldError)}
              aria-describedby={fieldError ? "url-field-error" : undefined}
            />
            {fieldError && (
              <p
                id="url-field-error"
                className="mt-1.5 text-sm text-icta-red"
                role="alert"
              >
                {formValidationMessage(fieldError)}
              </p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-icta-gray-600">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              disabled={busy}
            />
            Force fresh scan (bypass cache)
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-icta-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Start scan
          </button>
        </form>

        {scanError && markState === "error" && (
          <div
            className="mb-8 rounded-md border border-icta-red/20 bg-icta-red/5 px-4 py-4"
            role="alert"
          >
            <p className="text-sm text-icta-gray-600">
              {scanFailureMessage(scanError.kind)}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-md border border-icta-black px-3 py-1.5 text-sm font-semibold text-icta-black hover:bg-icta-gray-50"
            >
              Try again
            </button>
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
            narrative={scan?.result?.narrative ?? null}
          />
        )}
      </main>
    </div>
  );
}
