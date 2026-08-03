"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

import { StandardDocLink } from "@/components/ClauseLink";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { ScanResults } from "@/components/ScanResults";
import { SentinelMark } from "@/components/SentinelMark";
import { TypingPlaceholder } from "@/components/TypingPlaceholder";
import { usePolling } from "@/hooks/usePolling";
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
import {
  matchKnownDomain,
  SCAN_URL_PLACEHOLDER_EXAMPLES,
  type KnownDomain,
} from "@/lib/known-domains";
import { getCopiedScanUrl } from "@/lib/scan-url-clipboard";
import {
  clearActiveScan,
  loadActiveScan,
  saveActiveScan,
} from "@/lib/scan-session";
import type { SentinelMarkState } from "@/lib/sentinel-mark-paths";
import {
  btnGhost,
  btnPrimary,
  btnSecondarySm,
  inputBase,
  inputError,
} from "@/lib/ui";

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

  if (status.progress && !status.current_category) {
    return status.progress;
  }

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

  if (!/^https?:\/\//i.test(trimmed)) {
    return "invalid_url";
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "invalid_url";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "invalid_url";
  }
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return "invalid_url";
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
    <EmptyState title="No scan yet">
      Enter a public .go.ke or .gov.ke URL above to run compliance checks.
    </EmptyState>
  );
}

export function ScanWorkspace() {
  const [url, setUrl] = useState("");
  const [force, setForce] = useState(false);
  const [markState, setMarkState] = useState<SentinelMarkState>("idle");
  const [fieldError, setFieldError] = useState<ScanErrorKind | null>(null);
  const [scanError, setScanError] = useState<ScanLevelError | null>(null);
  const [scan, setScan] = useState<ScanStatusResponse | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [attachedNote, setAttachedNote] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [pendingPasteUrl, setPendingPasteUrl] = useState<string | null>(null);
  const [urlFocused, setUrlFocused] = useState(false);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const lastCategoryRef = useRef<string | null>(null);
  const lastCategoryAtRef = useRef(0);

  const busy = markState === "processing";
  const suggestion =
    !busy && !suggestionDismissed ? matchKnownDomain(url) : null;
  const showPaste =
    Boolean(pendingPasteUrl) &&
    !busy &&
    pendingPasteUrl?.trim() !== url.trim();
  const showTypingPlaceholder =
    !urlFocused && !url.trim() && !busy && !showPaste;

  useEffect(() => {
    function refreshPendingPaste() {
      setPendingPasteUrl(getCopiedScanUrl());
    }
    refreshPendingPaste();
    window.addEventListener("focus", refreshPendingPaste);
    document.addEventListener("visibilitychange", refreshPendingPaste);
    window.addEventListener(
      "sentinel:scan-url-copied",
      refreshPendingPaste as EventListener,
    );
    return () => {
      window.removeEventListener("focus", refreshPendingPaste);
      document.removeEventListener("visibilitychange", refreshPendingPaste);
      window.removeEventListener(
        "sentinel:scan-url-copied",
        refreshPendingPaste as EventListener,
      );
    };
  }, []);

  // Keep the latest job id so Standards (or any navigation) can resume.
  useEffect(() => {
    if (scan?.job_id) {
      saveActiveScan(scan.job_id, scan.url || url);
    }
  }, [scan?.job_id, scan?.url, url]);

  function pasteCopiedUrl() {
    const next = getCopiedScanUrl() ?? pendingPasteUrl;
    if (!next) return;
    setUrl(next);
    setSuggestionDismissed(false);
    setFieldError(null);
    setPendingPasteUrl(next);
  }

  const resultsReady = scan?.status === "complete";
  const overallScore = resultsReady
    ? (scan?.result?.overall_score ?? scan?.result?.scores?.overall_score ?? null)
    : null;
  const categoryScores = resultsReady ? (scan?.result?.scores?.categories ?? []) : [];
  const narrative = resultsReady ? (scan?.result?.narrative ?? null) : null;
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

  /** Reset per-session category-staleness tracking and begin polling. */
  function startPolling(jobId: string) {
    lastCategoryRef.current = null;
    lastCategoryAtRef.current = Date.now();
    setPollingJobId(jobId);
  }

  usePolling(
    async () => {
      const status = await getScan(pollingJobId!);
      const now = Date.now();
      const category = status.current_category ?? null;

      if (category !== lastCategoryRef.current) {
        lastCategoryRef.current = category;
        lastCategoryAtRef.current = now;
      }

      setScan(status);
      setMarkState(markStateFromStatus(status.status));

      const nextFindings = status.result?.findings;
      if (nextFindings && nextFindings.length > 0) {
        setFindings(nextFindings);
      }

      if (status.status === "complete") {
        setFindings(status.result?.findings ?? []);
        setProgressLabel(null);
        return true;
      }
      if (status.status === "failed") {
        if (status.error_category === "duplicate_in_progress") {
          setProgressLabel("A scan for this URL is already in progress…");
          return false;
        }
        const kind = classifyScanError(
          status.error ?? "",
          status.error_category,
        );
        setScanLevelFailure(
          isFormValidationError(kind) ? "internal_error" : kind,
        );
        return true;
      }

      setProgressLabel(
        processingLabel(status, "Queued…", lastCategoryAtRef.current, now),
      );
      return false;
    },
    [pollingJobId],
    {
      intervalMs: POLL_INTERVAL_MS,
      maxAttempts: MAX_POLLS,
      enabled: pollingJobId !== null,
      onDone: () => setPollingJobId(null),
      onExhausted: () => {
        setScanLevelFailure("timeout");
        setPollingJobId(null);
      },
      onError: (err) => {
        const apiErr =
          err instanceof ScanApiError
            ? err
            : err &&
                typeof err === "object" &&
                "errorCategory" in err &&
                typeof (err as { message?: unknown }).message === "string"
              ? (err as ScanApiError)
              : null;
        const category = apiErr?.errorCategory ?? null;
        const message =
          apiErr?.message ??
          (err instanceof Error ? err.message : "Unknown error");
        const kind = classifyScanError(message, category);

        if (isFormValidationError(kind)) {
          setFieldError(kind);
          setMarkState("idle");
          setProgressLabel(null);
          setScanError(null);
        } else {
          setScanLevelFailure(kind === "generic" ? "internal_error" : kind);
        }
        setPollingJobId(null);
      },
    },
  );

  // Restore the last scan for this browser tab after navigating away.
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const saved = loadActiveScan();
      if (!saved) return;

      try {
        const status = await getScan(saved.jobId);
        if (cancelled) return;

        setUrl(saved.url || status.url || "");
        setHasSubmitted(true);
        setFieldError(null);
        setScanError(null);
        setScan(status);
        setFindings(status.result?.findings ?? []);
        setMarkState(markStateFromStatus(status.status));
        setAttachedNote(Boolean(status.attached_to_existing));

        if (status.status === "complete") {
          setProgressLabel(null);
          return;
        }

        if (status.status === "failed") {
          if (status.error_category === "duplicate_in_progress") {
            setProgressLabel("A scan for this URL is already in progress…");
            setMarkState("processing");
            startPolling(status.job_id);
            return;
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

        setProgressLabel(status.progress ?? "Resuming scan…");
        setMarkState("processing");
        startPolling(status.job_id);
      } catch {
        if (!cancelled) clearActiveScan();
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  async function startScan(options?: {
    forceFresh?: boolean;
    urlOverride?: string;
  }) {
    const forceFresh = options?.forceFresh ?? force;
    setHasSubmitted(true);
    setFieldError(null);
    setScanError(null);
    setScan(null);
    setFindings([]);
    setAttachedNote(false);
    setPollingJobId(null);

    const trimmed = (options?.urlOverride ?? url).trim();
    if (options?.urlOverride) {
      setUrl(trimmed);
    }
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

      startPolling(job.job_id);
    } catch (err) {
      const apiErr =
        err instanceof ScanApiError
          ? err
          : err &&
              typeof err === "object" &&
              "errorCategory" in err &&
              typeof (err as { message?: unknown }).message === "string"
            ? (err as ScanApiError)
            : null;
      const category = apiErr?.errorCategory ?? null;
      const message =
        apiErr?.message ??
        (err instanceof Error ? err.message : "Unknown error");
      const kind = classifyScanError(message, category);

      if (isFormValidationError(kind)) {
        setFieldError(kind);
        setMarkState("idle");
        setProgressLabel(null);
        setScanError(null);
        return;
      }

      setScanLevelFailure(kind === "generic" ? "internal_error" : kind);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (suggestion) {
      await acceptSuggestion(suggestion);
      return;
    }
    await startScan();
  }

  async function onRetry() {
    setForce(true);
    await startScan({ forceFresh: true });
  }

  function acceptSuggestion(entry: KnownDomain) {
    setSuggestionDismissed(true);
    setFieldError(null);
    return startScan({ urlOverride: entry.url });
  }

  function onUrlKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (busy || !suggestion) return;
    if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      void acceptSuggestion(suggestion);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setSuggestionDismissed(true);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 animate-fade-in">
        <div className="mb-8 flex flex-col items-center gap-3 animate-fade-in-up">
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
            {markState === "idle" &&
              hasSubmitted &&
              fieldError &&
              "Check the URL"}
            {markState === "idle" &&
              hasSubmitted &&
              !fieldError &&
              !scanError &&
              "Enter a .go.ke URL to scan"}
          </p>
        </div>

        <h1 className="mb-2 text-2xl font-bold text-icta-black">Scan</h1>
        <p className="mb-6 text-sm text-icta-gray-600">
          <StandardDocLink>ICTA.6.003:2023 §6.5</StandardDocLink> compliance
          checks — results cached for 24 hours
        </p>

        <form onSubmit={onSubmit} noValidate className="mb-8 space-y-3">
          <div>
            <div className="relative">
              <input
                type="text"
                inputMode="url"
                autoComplete="off"
                name="scan-url"
                required
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setSuggestionDismissed(false);
                  if (fieldError) setFieldError(null);
                }}
                onFocus={() => setUrlFocused(true)}
                onBlur={() => setUrlFocused(false)}
                onKeyDown={onUrlKeyDown}
                placeholder=""
                aria-label="Government website URL"
                className={`${inputBase} ${showPaste ? "pr-20" : ""} ${fieldError ? inputError : ""}`}
                disabled={busy}
                aria-invalid={Boolean(fieldError)}
                aria-autocomplete="list"
                aria-expanded={Boolean(suggestion)}
                aria-controls={suggestion ? "domain-suggestion" : undefined}
                aria-describedby={
                  [
                    fieldError ? "url-field-error" : null,
                    suggestion ? "domain-suggestion" : null,
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
              />
              <TypingPlaceholder
                examples={SCAN_URL_PLACEHOLDER_EXAMPLES}
                active={showTypingPlaceholder}
              />
              {showPaste && (
                <button
                  type="button"
                  onClick={pasteCopiedUrl}
                  className={`${btnGhost} absolute right-1 top-1/2 -translate-y-1/2`}
                  aria-label="Paste copied registry URL"
                >
                  Paste
                </button>
              )}
            </div>
            {suggestion && (
              <button
                type="button"
                id="domain-suggestion"
                onClick={() => void acceptSuggestion(suggestion)}
                className="mt-1.5 flex w-full items-baseline justify-between gap-3 rounded-md border border-icta-gray-200 bg-icta-gray-50 px-3 py-2 text-left transition-colors hover:border-icta-black/30 hover:bg-white"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-icta-black">
                    {suggestion.name}
                  </span>
                  <span className="block truncate text-xs text-icta-gray-600">
                    {suggestion.url}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-icta-gray-600">
                  Tab / Enter
                </span>
              </button>
            )}
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
          <button type="submit" disabled={busy} className={btnPrimary}>
            Start scan
          </button>
        </form>

        {scanError && markState === "error" && (
          <ErrorState
            className="mb-8"
            muted
            message={scanFailureMessage(scanError.kind)}
            action={
              <button type="button" onClick={onRetry} className={btnSecondarySm}>
                Try again
              </button>
            }
          />
        )}

        {showEmptyIdle && <EmptyIdle />}

        {showEmptyComplete && (
          <EmptyState className="py-8">
            Scan finished, but no findings were returned.
          </EmptyState>
        )}

        {scan && findings.length > 0 && (
          <div className="mb-4 text-xs text-icta-gray-600">
            Job {scan.job_id}
            {scan.cache_hit ? " · cache" : ""}
            {!resultsReady ? " · results updating…" : ""}
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
            jobId={resultsReady ? scan?.job_id : null}
            narrative={narrative}
            resultsReady={resultsReady}
            findingCount={resultsReady ? scan?.result?.finding_count : undefined}
            weightsSource={resultsReady ? scan?.result?.scores?.weights_source : undefined}
            updatedAt={resultsReady ? (scan?.updated_at ?? null) : null}
          />
        )}
      </main>
    </div>
  );
}
