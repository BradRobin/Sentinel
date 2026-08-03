"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronsUpDown, Copy } from "lucide-react";

import { SentinelMark } from "@/components/SentinelMark";
import { ErrorState } from "@/components/ErrorState";
import { RegistryDetailDrawer } from "@/components/RegistryDetailDrawer";
import { Skeleton } from "@/components/Skeleton";
import { Spinner } from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import {
  getRegistry,
  getRegistryScanBatch,
  startRegistryScan,
  type RegistryEntry,
  type RegistryScanBatchStatus,
} from "@/lib/api";
import { useApiResource } from "@/hooks/useApiResource";
import { usePolling } from "@/hooks/usePolling";
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
  inputBase,
} from "@/lib/ui";
import { trendClass, trendLabel } from "@/lib/trend";

type OrgFilter = "all" | "ministry" | "agency" | "county";
type DashboardView = "registry" | "leaderboard";
type SortKey = "name" | "type" | "score" | "trend" | "checked" | "rank";
type SortDir = "asc" | "desc";
interface SortState {
  key: SortKey;
  dir: SortDir;
}

function sortedValue(
  row: RegistryEntry,
  key: SortKey,
): string | number | null {
  switch (key) {
    case "name":
      return (row.registered_name || row.org_name).toLowerCase();
    case "type":
      return row.org_type;
    case "score":
      return row.latest_score;
    case "trend":
      return row.trend;
    case "checked":
      return row.last_checked_at ?? "";
    case "rank":
      return row.latest_score;
  }
}

function compareSorted(a: RegistryEntry, b: RegistryEntry, key: SortKey): number {
  const va = sortedValue(a, key);
  const vb = sortedValue(b, key);
  if (va === null && vb === null) return 0;
  if (va === null) return 1;
  if (vb === null) return -1;
  if (typeof va === "number" && typeof vb === "number") return va - vb;
  return String(va).localeCompare(String(vb));
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
  right,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState | null;
  onSort: (key: SortKey) => void;
  className?: string;
  right?: boolean;
}) {
  const active = sort?.key === sortKey;
  const dir = active ? sort!.dir : null;
  const SortIcon = active
    ? dir === "asc"
      ? ArrowUp
      : ArrowDown
    : ChevronsUpDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
      className={className}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 font-medium uppercase tracking-wide transition-colors hover:text-icta-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-black ${
          right ? "justify-end" : ""
        }`}
      >
        {label}
        <SortIcon
          className={`size-3.5 ${
            active ? "text-icta-black" : "text-icta-gray-400"
          }`}
          aria-hidden="true"
        />
      </button>
    </th>
  );
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

export function RegistryDashboard() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [request, setRequest] = useState<{ query: string; orgFilter: OrgFilter }>({
    query: "",
    orgFilter: "all",
  });
  const [view, setView] = useState<DashboardView>("registry");
  const [leaderboardMetric, setLeaderboardMetric] =
    useState<LeaderboardMetric>("overall");
  const [copiedDomainId, setCopiedDomainId] = useState<string | null>(null);
  const [scanStarting, setScanStarting] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<RegistryScanBatchStatus | null>(
    null,
  );
  const [showFinishedBanner, setShowFinishedBanner] = useState(false);
  const [drawerEntry, setDrawerEntry] = useState<RegistryEntry | null>(null);
  const [sort, setSort] = useState<SortState | null>(null);
  const lastRefreshComplete = useRef(0);
  const queryRef = useRef("");
  const orgFilterRef = useRef<OrgFilter>("all");

  const { data, loading, error, reload } = useApiResource(
    () =>
      getRegistry({
        q: request.query.trim() || undefined,
        orgType: request.orgFilter === "all" ? undefined : request.orgFilter,
        limit: 300,
      }),
    [request],
  );

  const items = useMemo(() => data?.items ?? [], [data]);
  const errorMessage =
    error instanceof Error
      ? error.message
      : error
        ? "Failed to load registry"
        : null;

  function load(nextQuery: string, nextFilter: OrgFilter) {
    queryRef.current = nextQuery;
    orgFilterRef.current = nextFilter;
    setRequest({ query: nextQuery, orgFilter: nextFilter });
    reload();
  }

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current && current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : {
            key,
            dir:
              key === "score" || key === "checked" || key === "rank"
                ? "desc"
                : "asc",
          },
    );
  }

  const sortedItems = useMemo(() => {
    if (!sort) return items;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...items].sort(
      (a, b) => compareSorted(a, b, sort.key) * dir,
    );
  }, [items, sort]);

  const sortedLeaderboardRows = useMemo(() => {
    const rows = rankRegistryEntries(items, leaderboardMetric);
    if (!sort || sort.key !== "rank") return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => (a.rank_score - b.rank_score) * dir);
  }, [items, leaderboardMetric, sort]);

  function openDetails(row: RegistryEntry) {
    setDrawerEntry(row);
  }

  async function onCopyUrl(row: RegistryEntry) {
    await copyScanUrl(row.url);
    toast({
      title: "Scan URL copied",
      description: `Paste into the scan page to check ${row.url}`,
      variant: "info",
      duration: 2400,
    });
    setCopiedDomainId(row.domain_id);
    window.setTimeout(() => {
      setCopiedDomainId((current) =>
        current === row.domain_id ? null : current,
      );
    }, 1600);
  }

  usePolling(
    async () => {
      const status = await getRegistryScanBatch(batchId!);
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
        return true;
      }
      return false;
    },
    [batchId],
    {
      intervalMs: BATCH_POLL_MS,
      enabled: batchId !== null,
      retryOnError: true,
      onError: (err) => {
        setScanError(
          err instanceof Error
            ? err.message
            : "Failed to poll registry scan status",
        );
      },
    },
  );

  // Restore an in-flight batch from a previous visit.
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(BATCH_STORAGE_KEY);
      if (saved) setBatchId(saved);
    } catch {
      // ignore storage errors
    }
  }, []);

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
      const message =
        err instanceof Error ? err.message : "Failed to start registry scan";
      setScanError(message);
      toast({ title: "Scan failed to start", description: message, variant: "error" });
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

  const leaderboardRows = sortedLeaderboardRows;
  const activeMetric =
    LEADERBOARD_METRIC_OPTIONS.find((m) => m.value === leaderboardMetric) ??
    LEADERBOARD_METRIC_OPTIONS[0];
  const scoreColumnLabel =
    view === "leaderboard" ? metricLabel(leaderboardMetric) : "Score";

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 sm:py-16">
        <header className="mb-8">
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-icta-black sm:text-3xl">
            MCDA registry
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-icta-gray-600">
            Ministries, counties, and agencies with compliance scores from
            weekly scans. Switch to the leaderboard to rank the most compliant
            sites overall or by category. Use{" "}
            <span className="text-icta-black">Scan all</span> to re-check every
            listed site.
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
                  if (e.key === "Enter") load(query, request.orgFilter);
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
                {scanning ? (
                  <>
                    <Spinner size="sm" />
                    Scanning…
                  </>
                ) : (
                  "Scan all MCDAs"
                )}
              </button>
              <button
                type="button"
                onClick={() => load(query, request.orgFilter)}
                disabled={loading}
                className={btnSecondary}
              >
                {loading ? (
                  <>
                    <Spinner size="sm" />
                    Refreshing…
                  </>
                ) : (
                  "Refresh list"
                )}
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
                    setRequest((current) => ({
                      ...current,
                      orgFilter: value,
                    }));
                    load(query, value);
                  }}
                  className={
                    request.orgFilter === value
                      ? btnFilterActive
                      : btnFilterIdle
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="text-xs tabular-nums text-icta-gray-600">
              {loading ? (
                <Skeleton className="h-4 w-32 rounded-md" />
              ) : (
                `${items.length} MCDAs`
              )}
              {!loading && scored > 0 ? ` · ${scored} with scores` : ""}
            </div>
          </div>

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

        {scanError && <ErrorState message={scanError} className="mb-6" />}

        {errorMessage && (
          <ErrorState
            message={errorMessage}
            className="mb-6"
            hint={
              <>
                Check that the API is running and can reach Postgres. With
                Docker,{" "}
                <code className="mx-1 text-xs">
                  docker compose up --build
                </code>{" "}
                starts a local DB and seeds the MCDA registry automatically.
              </>
            }
          />
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-icta-gray-200 text-xs uppercase tracking-wide text-icta-gray-600">
                <th
                  scope="col"
                  className="w-10 py-3 pr-3 font-medium tabular-nums"
                >
                  #
                </th>
                <SortableHeader
                  label="Organization"
                  sortKey="name"
                  sort={sort}
                  onSort={toggleSort}
                  className="py-3 pr-4"
                />
                <SortableHeader
                  label="Type"
                  sortKey="type"
                  sort={sort}
                  onSort={toggleSort}
                  className="py-3 pr-4"
                />
                <SortableHeader
                  label={scoreColumnLabel}
                  sortKey={view === "leaderboard" ? "rank" : "score"}
                  sort={sort}
                  onSort={toggleSort}
                  className="py-3 pr-4"
                />
                {view === "leaderboard" && leaderboardMetric !== "overall" && (
                  <th className="py-3 pr-4 font-medium">Overall</th>
                )}
                {view === "registry" && (
                  <>
                    <SortableHeader
                      label="Trend"
                      sortKey="trend"
                      sort={sort}
                      onSort={toggleSort}
                      className="py-3 pr-4"
                    />
                    <SortableHeader
                      label="Last checked"
                      sortKey="checked"
                      sort={sort}
                      onSort={toggleSort}
                      className="py-3 pr-4"
                    />
                  </>
                )}
                <th className="py-3 text-right font-medium">
                  <span className="sr-only">Copy URL</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 && (
                <tr>
                  <td
                    colSpan={view === "leaderboard" ? 6 : 7}
                    className="px-4 py-8"
                    role="status"
                    aria-busy="true"
                  >
                    <div className="space-y-3">
                      <Skeleton className="h-5 w-full rounded-md" />
                      <Skeleton className="h-5 w-5/6 rounded-md" />
                      <Skeleton className="h-5 w-2/3 rounded-md" />
                      <Skeleton className="h-5 w-3/4 rounded-md" />
                    </div>
                  </td>
                </tr>
              )}
              {view === "registry" &&
                items.length === 0 &&
                !loading &&
                !errorMessage && (
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
                !loading &&
                !errorMessage && (
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
                sortedItems.map((row, index) => (
                  <tr
                    key={row.domain_id}
                    className="border-b border-icta-gray-100 align-top transition-colors hover:bg-icta-gray-50/80 animate-fade-in"
                    style={{ animationDelay: `${Math.min(index * 20, 300)}ms` }}
                  >
                    <td className="py-3 pr-3 tabular-nums text-icta-gray-600">
                      {index + 1}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openDetails(row)}
                          className="font-medium text-icta-black underline decoration-transparent underline-offset-2 transition-colors hover:decoration-icta-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-black"
                          aria-label={`View details for ${row.registered_name || row.org_name}`}
                        >
                          {row.registered_name || row.org_name}
                        </button>
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
                        {copiedDomainId === row.domain_id ? (
                          <>
                            <Check className="size-3.5 text-icta-green" aria-hidden="true" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="size-3.5" aria-hidden="true" />
                            Copy
                          </>
                        )}
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
                      <button
                        type="button"
                        onClick={() => openDetails(row)}
                        className="font-medium text-icta-black underline decoration-transparent underline-offset-2 transition-colors hover:decoration-icta-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-black"
                        aria-label={`View details for ${row.registered_name || row.org_name}`}
                      >
                        {row.registered_name || row.org_name}
                      </button>
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
                        {copiedDomainId === row.domain_id ? (
                          <>
                            <Check className="size-3.5 text-icta-green" aria-hidden="true" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="size-3.5" aria-hidden="true" />
                            Copy
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <RegistryDetailDrawer
          open={Boolean(drawerEntry)}
          entry={drawerEntry}
          peers={items}
          onClose={() => setDrawerEntry(null)}
        />
      </main>
    </div>
  );
}
