"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { SentinelMark } from "@/components/SentinelMark";
import { useCountUp } from "@/hooks/useCountUp";
import {
  getRegistry,
  getRegistryScanBatch,
  startRegistryScan,
  type RegistryEntry,
  type RegistryScanBatchStatus,
  type RegistryTrend,
} from "@/lib/api";
import { scoreBandRowBorderClass } from "@/lib/kenya-map";
import { copyScanUrl } from "@/lib/scan-url-clipboard";
import {
  LEADERBOARD_METRIC_OPTIONS,
  metricLabel,
  rankRegistryEntries,
  type LeaderboardMetric,
} from "@/lib/registry-leaderboard";
import type { SentinelMarkState } from "@/lib/sentinel-mark-paths";
import {
  btnFilterActive,
  btnFilterIdle,
  btnGhost,
  btnMuted,
  btnPrimary,
  btnSecondary,
  btnSecondarySm,
  inputBase,
  linkQuiet,
} from "@/lib/ui";

function trendLabel(trend: RegistryTrend): string {
  switch (trend) {
    case "up":
      return "Up";
    case "down":
      return "Down";
    case "flat":
      return "Flat";
    default:
      return "—";
  }
}

function trendClass(trend: RegistryTrend): string {
  switch (trend) {
    case "up":
      return "text-icta-green";
    case "down":
      return "text-icta-red";
    case "flat":
      return "text-icta-gray-600";
    default:
      return "text-icta-gray-600";
  }
}

function formatChecked(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatScore(score: number | null): string {
  if (score === null || score === undefined) return "—";
  return score.toFixed(1);
}

function formatDelta(delta: number | null): string | null {
  if (delta === null || delta === undefined) return null;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}`;
}

function orgTypeLabel(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

type OrgFilter = "all" | "ministry" | "agency" | "county";
type DashboardView = "registry" | "leaderboard";

const BATCH_POLL_MS = 2500;
const BATCH_STORAGE_KEY = "sentinel.registry.scanBatchId";

function batchMarkState(
  scanning: boolean,
  status: RegistryScanBatchStatus | null,
  hasError: boolean,
): SentinelMarkState {
  if (hasError && !scanning) return "error";
  if (!status) return scanning ? "processing" : "idle";
  if (status.done) {
    const failed = status.counts.failed;
    const complete = status.counts.complete;
    if (failed > 0 && complete === 0) return "error";
    return "complete";
  }
  return "processing";
}

function StatusChip({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "running" | "ok" | "bad";
}) {
  const toneClass =
    tone === "running"
      ? "text-icta-black"
      : tone === "ok"
        ? "text-icta-green"
        : tone === "bad"
          ? "text-icta-red"
          : "text-icta-gray-600";
  return (
    <span className={`tabular-nums ${toneClass}`}>
      <span className="font-semibold">{value}</span> {label}
    </span>
  );
}

function RegistrySummaryStrip({ items }: { items: RegistryEntry[] }) {
  const stats = useMemo(() => {
    const scored = items.filter((i) => i.latest_score != null);
    const avg =
      scored.length > 0
        ? scored.reduce((sum, i) => sum + (i.latest_score as number), 0) /
          scored.length
        : 0;
    return {
      total: items.length,
      avg,
      hasScores: scored.length > 0,
      up: items.filter((i) => i.trend === "up").length,
      down: items.filter((i) => i.trend === "down").length,
    };
  }, [items]);

  const total = useCountUp(stats.total, { enabled: stats.total > 0 });
  const avg = useCountUp(stats.avg, {
    decimals: 1,
    enabled: stats.hasScores,
  });
  const up = useCountUp(stats.up, { enabled: stats.total > 0 });
  const down = useCountUp(stats.down, { enabled: stats.total > 0 });

  return (
    <div
      className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm"
      aria-label="Registry summary"
    >
      <p className="tabular-nums text-icta-black">
        <span className="text-lg font-semibold">{total}</span>{" "}
        <span className="text-icta-gray-600">MCDAs tracked</span>
      </p>
      <p className="tabular-nums text-icta-black">
        <span className="text-lg font-semibold">
          {stats.hasScores ? avg.toFixed(1) : "—"}
        </span>{" "}
        <span className="text-icta-gray-600">avg score</span>
      </p>
      <p className="tabular-nums text-icta-gray-600">
        <span className="font-semibold text-icta-green">{up}</span> up
        <span className="mx-1.5 text-icta-gray-200">·</span>
        <span className="font-semibold text-icta-red">{down}</span> down
        <span className="ml-1">since last check</span>
      </p>
    </div>
  );
}

export function RegistryDashboard() {
  const [items, setItems] = useState<RegistryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [showErrorDetail, setShowErrorDetail] = useState(false);
  const [query, setQuery] = useState("");
  const [orgFilter, setOrgFilter] = useState<OrgFilter>("all");
  const [view, setView] = useState<DashboardView>("registry");
  const [leaderboardMetric, setLeaderboardMetric] =
    useState<LeaderboardMetric>("overall");
  const [pending, startTransition] = useTransition();
  const [copiedDomainId, setCopiedDomainId] = useState<string | null>(null);
  const [scanStarting, setScanStarting] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<RegistryScanBatchStatus | null>(
    null,
  );
  const [showFinishedBanner, setShowFinishedBanner] = useState(false);
  const lastRefreshComplete = useRef(0);
  const queryRef = useRef(query);
  const orgFilterRef = useRef(orgFilter);
  queryRef.current = query;
  orgFilterRef.current = orgFilter;

  async function onCopyUrl(row: RegistryEntry) {
    await copyScanUrl(row.url);
    setCopiedDomainId(row.domain_id);
    window.setTimeout(() => {
      setCopiedDomainId((current) =>
        current === row.domain_id ? null : current,
      );
    }, 1600);
  }

  function load(nextQuery: string, nextFilter: OrgFilter) {
    startTransition(async () => {
      try {
        setError(null);
        setErrorDetail(null);
        setShowErrorDetail(false);
        const data = await getRegistry({
          q: nextQuery.trim() || undefined,
          orgType: nextFilter === "all" ? undefined : nextFilter,
          limit: 300,
        });
        setItems(data.items);
      } catch (err) {
        const detail =
          err instanceof Error ? err.message : "Failed to load registry";
        console.error("[registry] load failed:", detail, err);
        setError("Couldn't load the registry right now.");
        setErrorDetail(detail);
        setItems([]);
      }
    });
  }

  useEffect(() => {
    let initialFilter: OrgFilter = "all";
    try {
      const params = new URLSearchParams(window.location.search);
      const ot = params.get("org_type");
      if (ot === "ministry" || ot === "agency" || ot === "county") {
        initialFilter = ot;
        setOrgFilter(ot);
      }
    } catch {
      // ignore
    }
    load("", initialFilter);
    try {
      const saved = window.sessionStorage.getItem(BATCH_STORAGE_KEY);
      if (saved) setBatchId(saved);
    } catch {
      // ignore storage errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!batchId) return;

    let cancelled = false;
    let timer: number | undefined;

    async function tick() {
      try {
        const status = await getRegistryScanBatch(batchId!);
        if (cancelled) return;
        setBatchStatus(status);
        setScanError(null);

        const finished = status.counts.complete + status.counts.failed;
        if (finished > lastRefreshComplete.current || status.done) {
          lastRefreshComplete.current = finished;
          load(queryRef.current, orgFilterRef.current);
        }

        if (status.done) {
          setShowFinishedBanner(true);
          try {
            window.sessionStorage.removeItem(BATCH_STORAGE_KEY);
          } catch {
            // ignore
          }
          setBatchId(null);
          return;
        }
      } catch (err) {
        if (!cancelled) {
          setScanError(
            err instanceof Error
              ? err.message
              : "Failed to poll registry scan status",
          );
        }
      }
      if (!cancelled) {
        timer = window.setTimeout(() => {
          void tick();
        }, BATCH_POLL_MS);
      }
    }

    void tick();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [batchId]);

  async function onScanAll() {
    setScanStarting(true);
    setScanError(null);
    setShowFinishedBanner(false);
    try {
      const result = await startRegistryScan();
      lastRefreshComplete.current = 0;
      setBatchId(result.batch_id);
      setBatchStatus(null);
      try {
        window.sessionStorage.setItem(BATCH_STORAGE_KEY, result.batch_id);
      } catch {
        // ignore
      }
    } catch (err) {
      setScanError(
        err instanceof Error ? err.message : "Failed to start registry scan",
      );
    } finally {
      setScanStarting(false);
    }
  }

  function dismissScanBanner() {
    setShowFinishedBanner(false);
    setBatchStatus(null);
    setScanError(null);
  }

  const scored = items.filter((i) => i.latest_score !== null).length;
  const scanning = Boolean(batchId) || scanStarting;
  const showScanPanel =
    scanning || showFinishedBanner || Boolean(batchStatus && !batchStatus.done);
  const counts = batchStatus?.counts;
  const finished = (counts?.complete ?? 0) + (counts?.failed ?? 0);
  const total = batchStatus?.domain_count ?? 0;
  const progressPct =
    total > 0 ? Math.min(100, Math.round((finished / total) * 100)) : 0;
  const scanDone = Boolean(batchStatus?.done) || showFinishedBanner;
  const markState = batchMarkState(scanning, batchStatus, Boolean(scanError));
  const barClass = scanDone
    ? counts && counts.failed > 0 && counts.complete === 0
      ? "bg-icta-gray-600"
      : "bg-icta-green"
    : "bg-icta-black";

  const leaderboardRows = rankRegistryEntries(items, leaderboardMetric);
  const activeMetric =
    LEADERBOARD_METRIC_OPTIONS.find((m) => m.value === leaderboardMetric) ??
    LEADERBOARD_METRIC_OPTIONS[0];
  const scoreColumnLabel =
    view === "leaderboard" ? metricLabel(leaderboardMetric) : "Score";

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 sm:py-16">
        <Link href="/" className={`mb-8 inline-block ${linkQuiet}`}>
          ← Back
        </Link>

        <header className="mb-8">
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-icta-black sm:text-3xl">
            MCDA registry
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-icta-gray-600">
            Ministries, counties, and agencies with compliance scores from
            weekly scans. Switch to the leaderboard to rank the most compliant
            sites overall or by category. Use{" "}
            <span className="text-icta-black">Scan all</span> to re-check every
            listed site. County choropleth and national HQ pins live on the{" "}
            <Link href="/map" className="text-icta-link hover:underline">
              Kenya map
            </Link>
            .
          </p>
        </header>

        <div
          className="mb-5 flex flex-wrap gap-1.5"
          role="tablist"
          aria-label="Registry views"
        >
          {(
            [
              ["registry", "Registry"],
              ["leaderboard", "Leaderboard"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              onClick={() => setView(value)}
              className={view === value ? btnFilterActive : btnFilterIdle}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mb-5 flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-2 lg:max-w-md">
              <label
                htmlFor="registry-search"
                className="text-xs font-medium text-icta-gray-600"
              >
                Search
              </label>
              <input
                id="registry-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") load(query, orgFilter);
                }}
                placeholder="Name, alias, or URL…"
                className={inputBase}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void onScanAll()}
                disabled={scanning || items.length === 0}
                className={btnPrimary}
              >
                {scanning ? "Scanning…" : "Scan all MCDAs"}
              </button>
              <button
                type="button"
                onClick={() => load(query, orgFilter)}
                disabled={pending}
                className={btnSecondary}
              >
                {pending ? "Refreshing…" : "Refresh list"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-b border-icta-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Organization type"
            >
              {(
                [
                  ["all", "All"],
                  ["ministry", "Ministries"],
                  ["agency", "Agencies"],
                  ["county", "Counties"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setOrgFilter(value);
                    load(query, value);
                  }}
                  className={
                    orgFilter === value ? btnFilterActive : btnFilterIdle
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs tabular-nums text-icta-gray-600">
              {pending ? "Loading…" : `${items.length} MCDAs`}
              {!pending && scored > 0 ? ` · ${scored} with scores` : ""}
            </p>
          </div>

          {!error && !pending && items.length > 0 && view === "registry" && (
            <RegistrySummaryStrip items={items} />
          )}

          {view === "leaderboard" && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-icta-black">
                {activeMetric.headline}
              </p>
              <div
                className="flex flex-wrap gap-1.5"
                role="group"
                aria-label="Leaderboard ranking"
              >
                {LEADERBOARD_METRIC_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setLeaderboardMetric(option.value)}
                    className={
                      leaderboardMetric === option.value
                        ? btnFilterActive
                        : btnFilterIdle
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-icta-gray-600">
                {leaderboardRows.length > 0
                  ? `Showing ${leaderboardRows.length} scored site${leaderboardRows.length === 1 ? "" : "s"}`
                  : "No scored sites yet — run Scan all to populate rankings."}
              </p>
            </div>
          )}
        </div>

        {showScanPanel && (
          <section
            className="mb-6 card animate-fade-in-up"
            role="status"
            aria-live="polite"
            aria-label={
              scanDone ? "Registry scan finished" : "Scanning registry MCDAs"
            }
          >
            <div className="flex gap-4 px-4 py-4 sm:px-5">
              <div className="shrink-0 pt-0.5">
                <SentinelMark
                  state={markState}
                  size={44}
                  label={
                    markState === "processing"
                      ? "Sentinel scanning registry"
                      : markState === "complete"
                        ? "Registry scan complete"
                        : markState === "error"
                          ? "Registry scan error"
                          : "Sentinel"
                  }
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-icta-black">
                      {scanDone
                        ? markState === "error"
                          ? "Registry scan finished with errors"
                          : "Registry scan finished"
                        : "Scanning registry MCDAs"}
                    </p>
                    <p className="mt-0.5 text-xs text-icta-gray-600">
                      {scanDone
                        ? "Latest scores are in the table below."
                        : "Scores update in the table as each scan completes."}
                      {batchStatus?.triggered_type && !scanDone && (
                        <>
                          {" "}
                          ·{" "}
                          <span className="capitalize">
                            {batchStatus.triggered_type}
                          </span>{" "}
                          batch
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {total > 0 && (
                      <p className="text-xs font-medium tabular-nums text-icta-black">
                        {finished}/{total}
                        <span className="font-normal text-icta-gray-600">
                          {" "}
                          · {progressPct}%
                        </span>
                      </p>
                    )}
                    {scanDone && (
                      <button
                        type="button"
                        onClick={dismissScanBanner}
                        className={btnGhost}
                        aria-label="Dismiss scan status"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>

                <div
                  className="mt-3 h-2 overflow-hidden rounded-full bg-icta-gray-100"
                  aria-hidden
                >
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none ${barClass}`}
                    style={{
                      width: `${scanDone ? 100 : Math.max(progressPct, scanning && progressPct === 0 ? 4 : progressPct)}%`,
                    }}
                  />
                </div>

                {counts && (
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {!scanDone && (
                      <>
                        <StatusChip
                          label="running"
                          value={counts.running}
                          tone="running"
                        />
                        <StatusChip label="queued" value={counts.queued} />
                      </>
                    )}
                    <StatusChip
                      label="complete"
                      value={counts.complete}
                      tone="ok"
                    />
                    {counts.failed > 0 && (
                      <StatusChip
                        label="failed"
                        value={counts.failed}
                        tone="bad"
                      />
                    )}
                    {(counts.unknown ?? 0) > 0 && (
                      <StatusChip label="unknown" value={counts.unknown ?? 0} />
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {scanError && (
          <div
            className="mb-6 rounded-md border border-icta-red/20 bg-icta-red/5 px-4 py-3 text-sm text-icta-red"
            role="alert"
          >
            {scanError}
          </div>
        )}

        {error && (
          <div
            className="mb-6 rounded-md border border-icta-red/20 bg-icta-red/5 px-4 py-4"
            role="alert"
          >
            <p className="text-sm text-icta-gray-600">{error}</p>
            <button
              type="button"
              onClick={() => load(query, orgFilter)}
              className={`mt-4 ${btnSecondarySm}`}
              disabled={pending}
            >
              {pending ? "Retrying…" : "Retry"}
            </button>
            {errorDetail && (
              <div className="mt-3">
                <button
                  type="button"
                  className="text-xs font-medium text-icta-gray-600 underline-offset-2 hover:underline"
                  onClick={() => setShowErrorDetail((v) => !v)}
                  aria-expanded={showErrorDetail}
                >
                  {showErrorDetail ? "Hide technical details" : "Technical details"}
                </button>
                {showErrorDetail && (
                  <pre className="mt-2 overflow-x-auto rounded-md bg-white/80 px-3 py-2 text-[11px] leading-relaxed text-icta-gray-600">
                    {errorDetail}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-icta-gray-200 text-xs uppercase tracking-wide text-icta-gray-600">
                <th className="w-10 py-3 pr-3 font-medium tabular-nums">#</th>
                <th className="py-3 pr-4 font-medium">Organization</th>
                <th className="py-3 pr-4 font-medium">Type</th>
                <th className="py-3 pr-4 font-medium">{scoreColumnLabel}</th>
                {view === "leaderboard" && leaderboardMetric !== "overall" && (
                  <th className="py-3 pr-4 font-medium">Overall</th>
                )}
                {view === "registry" && (
                  <>
                    <th className="py-3 pr-4 font-medium">Trend</th>
                    <th className="py-3 pr-4 font-medium">Last checked</th>
                  </>
                )}
                <th className="py-3 text-right font-medium">
                  <span className="sr-only">Copy URL</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {view === "registry" &&
                items.length === 0 &&
                !pending &&
                !error && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-10 text-center text-icta-gray-600"
                    >
                      No verified MCDAs yet. Seed the registry to populate this
                      list.
                    </td>
                  </tr>
                )}
              {view === "leaderboard" &&
                leaderboardRows.length === 0 &&
                !pending &&
                !error && (
                  <tr>
                    <td
                      colSpan={leaderboardMetric === "overall" ? 5 : 6}
                      className="py-10 text-center text-icta-gray-600"
                    >
                      No scored sites in this view yet. Run{" "}
                      <span className="text-icta-black">Scan all MCDAs</span>{" "}
                      to build the leaderboard.
                    </td>
                  </tr>
                )}
              {view === "registry" &&
                items.map((row, index) => (
                  <tr
                    key={row.domain_id}
                    className={`border-b border-icta-gray-100 align-top transition-colors hover:bg-icta-gray-50/80 animate-fade-in ${scoreBandRowBorderClass(row.latest_score)}`}
                    style={{ animationDelay: `${Math.min(index * 20, 300)}ms` }}
                  >
                    <td className="py-3 pr-3 pl-3 tabular-nums text-icta-gray-600">
                      {index + 1}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-icta-black">
                          {row.registered_name || row.org_name}
                        </span>
                        {row.sector && (
                          <span className="rounded-md bg-icta-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-icta-gray-600">
                            {row.sector}
                          </span>
                        )}
                      </div>
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block break-all text-xs text-icta-link underline-offset-2 hover:underline"
                      >
                        {row.url}
                      </a>
                      {row.aliases.length > 0 && (
                        <span className="mt-1 block truncate text-[11px] text-icta-gray-600">
                          {row.aliases.slice(0, 3).join(" · ")}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 capitalize text-icta-gray-600">
                      {orgTypeLabel(row.org_type)}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="font-medium tabular-nums text-icta-black">
                        {formatScore(row.latest_score)}
                      </div>
                      {row.previous_score != null && row.latest_score != null && (
                        <div className="mt-0.5 text-[11px] tabular-nums text-icta-gray-600">
                          prev {row.previous_score.toFixed(1)}
                        </div>
                      )}
                    </td>
                    <td className={`py-3 pr-4 font-medium ${trendClass(row.trend)}`}>
                      <span className="inline-flex items-center gap-1">
                        {trendLabel(row.trend)}
                        {formatDelta(row.score_delta) && (
                          <span
                            className={`text-[11px] tabular-nums ${row.score_delta != null && row.score_delta < 0 ? "text-icta-red" : "text-icta-green"}`}
                          >
                            {formatDelta(row.score_delta)}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-icta-gray-600">
                      <div>{formatChecked(row.last_checked_at)}</div>
                      {row.last_source && (
                        <div className="mt-0.5 text-[11px] text-icta-gray-600/80">
                          {row.last_source === "manual" ? "manual scan" : row.last_source}
                        </div>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void onCopyUrl(row)}
                        className={btnMuted}
                        aria-label={`Copy ${row.url} for scanning`}
                      >
                        {copiedDomainId === row.domain_id ? "Copied" : "Copy"}
                      </button>
                    </td>
                  </tr>
                ))}
              {view === "leaderboard" &&
                leaderboardRows.map((row, index) => (
                  <tr
                    key={`${leaderboardMetric}-${row.domain_id}`}
                    className="border-b border-icta-gray-100 align-top transition-colors hover:bg-icta-gray-50/80 animate-fade-in"
                    style={{ animationDelay: `${Math.min(index * 20, 300)}ms` }}
                  >
                    <td className="py-3 pr-3 tabular-nums font-medium text-icta-black">
                      {index + 1}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="font-medium text-icta-black">
                        {row.registered_name || row.org_name}
                      </div>
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block break-all text-xs text-icta-link underline-offset-2 hover:underline"
                      >
                        {row.url}
                      </a>
                    </td>
                    <td className="py-3 pr-4 capitalize text-icta-gray-600">
                      {row.org_type}
                    </td>
                    <td className="py-3 pr-4 font-semibold tabular-nums text-icta-black">
                      {formatScore(row.rank_score)}
                    </td>
                    {leaderboardMetric !== "overall" && (
                      <td className="py-3 pr-4 tabular-nums text-icta-gray-600">
                        {formatScore(row.latest_score)}
                      </td>
                    )}
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void onCopyUrl(row)}
                        className={btnMuted}
                        aria-label={`Copy ${row.url} for scanning`}
                      >
                        {copiedDomainId === row.domain_id ? "Copied" : "Copy"}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
