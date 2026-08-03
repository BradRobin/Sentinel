"use client";

import { useMemo } from "react";
import { Copy, Minus, TrendingDown, TrendingUp, X } from "lucide-react";

import type { RegistryEntry } from "@/lib/api";
import { labelCategory, SCORED_CATEGORIES } from "@/lib/findings";
import { copyScanUrl } from "@/lib/scan-url-clipboard";
import { trendClass, trendLabel } from "@/lib/trend";
import {
  btnGhost,
  btnMuted,
  card,
  panelBackdrop,
  panelHeader,
  panelShell,
} from "@/lib/ui";
import { useSidePanel } from "@/hooks/useSidePanel";
import { useToast } from "@/components/Toast";

interface RegistryDetailDrawerProps {
  open: boolean;
  entry: RegistryEntry | null;
  peers: RegistryEntry[];
  onClose: () => void;
}

function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return "—";
  return score.toFixed(1);
}

function formatDelta(delta: number | null | undefined): string | null {
  if (delta === null || delta === undefined) return null;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}`;
}

function formatChecked(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function orgTypeLabel(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function scoreBarColor(score: number): string {
  if (score >= 70) return "bg-icta-green";
  if (score >= 40) return "bg-icta-amber";
  return "bg-icta-red";
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function DeltaChip({ delta }: { delta: number | null | undefined }) {
  if (delta === null || delta === undefined) return null;
  const up = delta > 0;
  const down = delta < 0;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium tabular-nums ${
        up ? "text-icta-green" : down ? "text-icta-red" : "text-icta-gray-600"
      }`}
    >
      <Icon className="size-3" aria-hidden="true" />
      {formatDelta(delta)}
    </span>
  );
}

export function RegistryDetailDrawer({
  open,
  entry,
  peers,
  onClose,
}: RegistryDetailDrawerProps) {
  const { toast } = useToast();
  const panelRef = useSidePanel(open, onClose);

  const stats = useMemo(() => {
    if (!entry) return null;
    const typePeers = peers.filter(
      (p) =>
        p.org_type === entry.org_type &&
        p.latest_score !== null &&
        p.latest_score !== undefined,
    );
    const rank =
      1 +
      typePeers.filter(
        (p) => (p.latest_score ?? 0) > (entry.latest_score ?? 0),
      ).length;
    const typeAvg = mean(typePeers.map((p) => p.latest_score as number));
    const overallVsAvg =
      entry.latest_score !== null &&
      entry.latest_score !== undefined &&
      typeAvg !== null
        ? entry.latest_score - typeAvg
        : null;
    return { typePeers, rank, typeAvg, overallVsAvg };
  }, [entry, peers]);

  const categoryRows = useMemo(() => {
    if (!entry || !stats) return [];
    const { typePeers } = stats;
    return SCORED_CATEGORIES.map((key) => {
      const raw = entry.category_breakdown?.[key];
      const score =
        typeof raw === "number" && Number.isFinite(raw) ? raw : null;
      const peerValues = typePeers
        .map((p) => p.category_breakdown?.[key])
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      const avg = mean(peerValues);
      return {
        key,
        label: labelCategory(key),
        score,
        vsAvg: score !== null && avg !== null ? score - avg : null,
        hasPeers: peerValues.length > 0,
      };
    });
  }, [entry, stats]);

  if (!entry) return null;

  const name = entry.registered_name || entry.org_name;
  const title = `MCDA details — ${name}`;

  return (
    <>
      <div
        className={`${panelBackdrop} ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        ref={panelRef}
        className={`${panelShell} ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
        tabIndex={-1}
      >
        <header className={panelHeader}>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-icta-black">
              {name}
            </h2>
            <a
              href={entry.url}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 block truncate text-sm text-icta-link underline-offset-2 hover:underline"
            >
              {entry.url}
            </a>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={btnGhost}
            aria-label="Close details"
          >
            <X className="size-4" aria-hidden="true" />
            Close
          </button>
        </header>

        <div className="panel-content-in flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-icta-gray-100 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-icta-gray-600">
                {orgTypeLabel(entry.org_type)}
              </span>
              {entry.sector && (
                <span className="rounded-md bg-icta-gray-100 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-icta-gray-600">
                  {entry.sector}
                </span>
              )}
              {entry.last_source && (
                <span className="rounded-md bg-icta-gray-100 px-2 py-1 text-[11px] font-medium text-icta-gray-600">
                  {entry.last_source === "manual"
                    ? "manual scan"
                    : entry.last_source}
                </span>
              )}
            </div>

            <section className={`${card} p-4`}>
              <p className="text-xs font-medium uppercase tracking-wide text-icta-gray-600">
                Latest score
              </p>
              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                <span className="text-3xl font-bold text-icta-black">
                  {entry.latest_score !== null &&
                  entry.latest_score !== undefined
                    ? `${formatScore(entry.latest_score)}%`
                    : "—"}
                </span>
                {entry.latest_score !== null && (
                  <span
                    className={`text-sm font-medium ${trendClass(entry.trend)}`}
                  >
                    {trendLabel(entry.trend)}
                    {formatDelta(entry.score_delta) && (
                      <span
                        className={`ml-1 text-xs tabular-nums ${
                          entry.score_delta != null && entry.score_delta < 0
                            ? "text-icta-red"
                            : "text-icta-green"
                        }`}
                      >
                        {formatDelta(entry.score_delta)}
                      </span>
                    )}
                  </span>
                )}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-icta-gray-100 pt-3 text-xs text-icta-gray-600">
                <div>
                  <dt className="uppercase tracking-wide">Previous</dt>
                  <dd className="mt-0.5 tabular-nums text-icta-black">
                    {entry.previous_score !== null &&
                    entry.previous_score !== undefined
                      ? `${formatScore(entry.previous_score)}%`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide">Last checked</dt>
                  <dd className="mt-0.5 text-icta-black">
                    {formatChecked(entry.last_checked_at)}
                  </dd>
                </div>
              </dl>
            </section>

            {stats && (
              <section>
                <h3 className="mb-3 text-sm font-semibold text-icta-black">
                  vs other {orgTypeLabel(entry.org_type)}s
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className={`${card} p-3`}>
                    <p className="text-xs font-medium text-icta-gray-600">
                      Rank by score
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-icta-black">
                      #{stats.rank}
                      <span className="text-sm font-normal text-icta-gray-600">
                        {" "}
                        of {stats.typePeers.length}
                      </span>
                    </p>
                  </div>
                  <div className={`${card} p-3`}>
                    <p className="text-xs font-medium text-icta-gray-600">
                      Type average
                    </p>
                    <p className="mt-1 flex items-baseline gap-1.5 text-lg font-semibold tabular-nums text-icta-black">
                      {formatScore(stats.typeAvg)}%
                      {stats.overallVsAvg !== null && (
                        <DeltaChip delta={stats.overallVsAvg} />
                      )}
                    </p>
                  </div>
                </div>
                {stats.overallVsAvg !== null && (
                  <p className="mt-2 text-xs text-icta-gray-600">
                    {stats.overallVsAvg > 0
                      ? `Scores ${formatDelta(stats.overallVsAvg)} points above the ${orgTypeLabel(entry.org_type)} average.`
                      : stats.overallVsAvg < 0
                        ? `Scores ${formatDelta(stats.overallVsAvg)} points below the ${orgTypeLabel(entry.org_type)} average.`
                        : "In line with the type average."}
                  </p>
                )}
              </section>
            )}

            <section>
              <h3 className="mb-1 text-sm font-semibold text-icta-black">
                Scores by category
              </h3>
              <p className="mb-3 text-xs text-icta-gray-600">
                Compare against the {entry.org_type} average where available.
              </p>
              {categoryRows.length === 0 ? (
                <p className="text-sm text-icta-gray-600">
                  No per-category scores yet — run a scan to populate.
                </p>
              ) : (
                <ul className="space-y-3">
                  {categoryRows.map((row) => (
                    <li key={row.key}>
                      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-icta-black">
                          {row.label}
                        </span>
                        <span className="flex items-baseline gap-2">
                          {row.hasPeers && <DeltaChip delta={row.vsAvg} />}
                          <span className="font-mono text-sm tabular-nums text-icta-black">
                            {row.score !== null
                              ? `${formatScore(row.score)}%`
                              : "—"}
                          </span>
                        </span>
                      </div>
                      <div
                        className="h-2 w-full overflow-hidden rounded-sm bg-icta-gray-100"
                        role="img"
                        aria-label={`${row.label}: ${formatScore(row.score)} percent`}
                      >
                        <div
                          className={`h-full rounded-sm transition-[width] duration-500 ease-out motion-reduce:transition-none ${
                            row.score === null
                              ? "bg-icta-gray-200"
                              : scoreBarColor(row.score)
                          }`}
                          style={{
                            width: `${Math.max(row.score === null ? 0 : row.score, 0)}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {entry.aliases.length > 0 && (
              <section className="text-xs text-icta-gray-600">
                <span className="font-medium uppercase tracking-wide">
                  Also known as
                </span>
                <p className="mt-1">{entry.aliases.join(" · ")}</p>
              </section>
            )}

            <button
              type="button"
              className={btnMuted}
              onClick={() => {
                void copyScanUrl(entry.url);
                toast({
                  title: "Scan URL copied",
                  description: `Paste into the scan page to check ${entry.url}`,
                  variant: "info",
                  duration: 2400,
                });
              }}
            >
              <Copy className="size-3.5" aria-hidden="true" />
              Copy URL
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
