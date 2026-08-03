"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { ComparisonSidePanel } from "@/components/ComparisonSidePanel";
import { ClauseLink, StandardDocLink } from "@/components/ClauseLink";
import { EmptyState } from "@/components/EmptyState";
import { FindingsSidePanel } from "@/components/FindingsSidePanel";
import { Skeleton } from "@/components/Skeleton";
import { CategoryScoreBars, StatusDonut } from "@/components/ScoreCharts";
import {
  COMPARISON_PERIOD_OPTIONS,
  getScanComparison,
  getScanComparisonAvailability,
  type CategoryScore,
  type ComparisonPeriod,
  type ComparisonResponse,
  type Finding,
} from "@/lib/api";
import {
  badgeLabelForFinding,
  findingSummaryLine,
  findingVisualWeight,
  groupFindingsByCategory,
  labelCategory,
  sortFindingsByPriority,
  summarizeFindings,
  topFailFindings,
  type StatFilter,
} from "@/lib/findings";
import { btnSecondarySm, inputBase, linkUnderline, textLink } from "@/lib/ui";
import {
  findNarrativeStatLinks,
  type NarrativeStatKind,
} from "@/lib/narrativeLinks";

/** Show drop headline when overall compliance fell by this many points or more */
const DECLINE_HEADLINE_THRESHOLD = -5;

interface ScanResultsProps {
  findings: Finding[];
  overallScore: number | null;
  categoryScores: CategoryScore[];
  cacheHit?: boolean;
  scannedUrl?: string | null;
  jobId?: string | null;
  narrative?: string | null;
  /** False while categories are still streaming; gates score / top issues / narrative. */
  resultsReady?: boolean;
  /** Server-reported total finding count (may differ from partial streams). */
  findingCount?: number;
  /** Source of the scoring weights — "database" or "defaults". */
  weightsSource?: string;
  /** ISO timestamp of the last status update from the API. */
  updatedAt?: string | null;
}

function InlineStat({
  count,
  label,
  onClick,
}: {
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={textLink}
    >
      {count} {label}
    </button>
  );
}

const narrativeLinkClass = textLink;

/** Link ICTA doc citations and clause numbers inside plain narrative text. */
function linkStandardsInText(text: string, keyPrefix: string): ReactNode[] {
  if (!text) return [];
  const pattern =
    /\bICTA\.6\.003:\d{4}(?:\s*(?:Section|§)\s*6\.5)?|\bSection\s+6\.5\b|\b(?:clause\s+)?(6\.5\.\d+(?:\.[ivx]+)?)\b/gi;
  const parts: ReactNode[] = [];
  let cursor = 0;
  let i = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index == null) continue;
    const start = match.index;
    const end = start + match[0].length;
    if (start > cursor) parts.push(text.slice(cursor, start));
    const clause = match[1];
    if (clause) {
      parts.push(
        <ClauseLink
          key={`${keyPrefix}-c-${start}-${i}`}
          clause={clause}
          showPrefix={/^clause\s+/i.test(match[0])}
        />,
      );
    } else {
      parts.push(
        <StandardDocLink key={`${keyPrefix}-d-${start}-${i}`}>
          {match[0]}
        </StandardDocLink>,
      );
    }
    cursor = end;
    i += 1;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts.length > 0 ? parts : [text];
}

function NarrativeSummary({
  text,
  stats,
  overallScore,
  onStatClick,
}: {
  text: string;
  stats: { fail: number; pass: number; manual_review: number; total: number };
  overallScore: number | null;
  onStatClick: (kind: NarrativeStatKind) => void;
}) {
  const spans = useMemo(
    () =>
      findNarrativeStatLinks(
        text,
        {
          fail: stats.fail,
          pass: stats.pass,
          manual_review: stats.manual_review,
          total: stats.total,
        },
        overallScore,
      ),
    [
      text,
      stats.fail,
      stats.pass,
      stats.manual_review,
      stats.total,
      overallScore,
    ],
  );

  const parts: ReactNode[] = [];
  let cursor = 0;
  spans.forEach((span, i) => {
    if (span.start > cursor) {
      parts.push(
        ...linkStandardsInText(text.slice(cursor, span.start), `pre-${i}`),
      );
    }
    parts.push(
      <button
        key={`${span.kind}-${span.start}-${i}`}
        type="button"
        className={narrativeLinkClass}
        onClick={() => onStatClick(span.kind)}
      >
        {text.slice(span.start, span.end)}
      </button>,
    );
    cursor = span.end;
  });
  if (cursor < text.length) {
    parts.push(...linkStandardsInText(text.slice(cursor), "tail"));
  }

  return (
    <p className="text-base leading-relaxed text-icta-black">
      {parts.length > 0 ? parts : linkStandardsInText(text, "all")}
    </p>
  );
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function FindingListItem({
  finding,
  onOpen,
}: {
  finding: Finding;
  onOpen: () => void;
}) {
  const weight = findingVisualWeight(finding.status, finding.severity);
  const badgeText = badgeLabelForFinding(finding);
  return (
    <li className={`hover:bg-icta-gray-50 ${weight.row}`}>
      <div className="flex items-start gap-3 px-3 py-2.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-3 text-left text-sm hover:opacity-90"
          onClick={onOpen}
        >
          <span
            className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs uppercase ${weight.badge}`}
          >
            {badgeText}
          </span>
          <span className="min-w-0 flex-1">
            <span className={weight.name}>{finding.check_name}</span>
            <span className="mt-0.5 block text-xs text-icta-gray-600">
              <span className={weight.severityLabel}>{finding.severity}</span>{" "}
              severity
            </span>
          </span>
        </button>
        <ClauseLink
          clause={finding.clause_reference}
          showPrefix
          className="mt-0.5 shrink-0 text-xs"
        />
      </div>
    </li>
  );
}

export function ScanResults({
  findings,
  overallScore,
  categoryScores,
  cacheHit,
  scannedUrl,
  jobId,
  narrative,
  resultsReady = true,
  findingCount,
  weightsSource,
  updatedAt,
}: ScanResultsProps) {
  const stats = useMemo(() => summarizeFindings(findings), [findings]);
  const grouped = useMemo(() => groupFindingsByCategory(findings), [findings]);
  const topIssues = useMemo(
    () => (resultsReady ? topFailFindings(findings, 3) : []),
    [findings, resultsReady],
  );
  const scoreByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of categoryScores) map.set(c.category, c.score);
    return map;
  }, [categoryScores]);

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTitle, setPanelTitle] = useState("");
  const [panelSubtitle, setPanelSubtitle] = useState<string | undefined>();
  const [panelFindings, setPanelFindings] = useState<Finding[]>([]);

  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparePeriod, setComparePeriod] =
    useState<ComparisonPeriod>("quarter");
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [periodLabels, setPeriodLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!jobId || !resultsReady) {
      setComparison(null);
      setAvailablePeriods([]);
      return;
    }
    let cancelled = false;
    getScanComparisonAvailability(jobId)
      .then((data) => {
        if (cancelled) return;
        const available = data.available_periods ?? [];
        setAvailablePeriods(available);
        setPeriodLabels(data.period_labels ?? {});
        setComparePeriod((current) =>
          available.includes(current)
            ? current
            : available.includes("quarter")
              ? "quarter"
              : ((available[0] as ComparisonPeriod | undefined) ?? "quarter"),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setAvailablePeriods([]);
          setPeriodLabels({});
        }
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, resultsReady]);

  useEffect(() => {
    if (!jobId || !resultsReady) {
      setComparison(null);
      return;
    }
    if (availablePeriods.length === 0) {
      setComparison({
        has_history: false,
        requested_period: comparePeriod,
        available_periods: [],
      });
      return;
    }
    if (!availablePeriods.includes(comparePeriod)) {
      return;
    }
    let cancelled = false;
    getScanComparison(jobId, comparePeriod)
      .then((data) => {
        if (!cancelled) setComparison(data);
      })
      .catch(() => {
        if (!cancelled) {
          setComparison({
            has_history: false,
            requested_period: comparePeriod,
            available_periods: availablePeriods,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, resultsReady, comparePeriod, availablePeriods]);

  const comparedSnapshot = comparison?.compared_to ?? comparison?.previous;
  const hasHistory = comparison?.has_history === true;
  const overallDelta = comparison?.delta?.overall ?? null;
  const periodLabel =
    comparison?.period_label ||
    periodLabels[comparePeriod] ||
    COMPARISON_PERIOD_OPTIONS.find((o) => o.value === comparePeriod)?.label ||
    "the selected period";
  const showDeclineHeadline =
    hasHistory &&
    overallDelta != null &&
    overallDelta <= DECLINE_HEADLINE_THRESHOLD &&
    comparedSnapshot &&
    comparison?.current;
  const anyHistoryAvailable = availablePeriods.length > 0;

  function openFindings(list: Finding[], title: string, subtitle?: string) {
    setPanelTitle(title);
    setPanelSubtitle(subtitle);
    setPanelFindings(sortFindingsByPriority(list));
    setPanelOpen(true);
  }

  function openPanel(filter: StatFilter, category?: string) {
    let list = findings;
    let title = "Findings";
    let subtitle: string | undefined;

    if (category) {
      list = findings.filter((f) => f.category === category);
      title = labelCategory(category);
      subtitle = `${list.length} check${list.length === 1 ? "" : "s"}`;
    } else if (filter === "fail") {
      list = findings.filter((f) => f.status === "fail");
      title = "Failed checks";
      subtitle = `${list.length} finding${list.length === 1 ? "" : "s"}`;
    } else if (filter === "manual_review") {
      list = findings.filter((f) => f.status === "manual_review");
      title = "Needs manual review";
      subtitle = `${list.length} finding${list.length === 1 ? "" : "s"}`;
    } else if (filter === "pass") {
      list = findings.filter((f) => f.status === "pass");
      title = "Passed checks";
      subtitle = `${list.length} finding${list.length === 1 ? "" : "s"}`;
    } else {
      title = "All findings";
      subtitle = `${list.length} total`;
    }

    openFindings(list, title, subtitle);
  }

  if (findings.length === 0) {
    return <EmptyState>No findings were returned for this scan.</EmptyState>;
  }

  return (
    <div className="space-y-8">
      <section className="animate-fade-in-up">
        {resultsReady && overallScore !== null && overallScore !== undefined ? (
          <div className="mb-3 text-4xl font-bold tracking-tight text-icta-black">
            {Number(overallScore).toFixed(1)}%
            <span className="ml-2 text-base font-medium text-icta-gray-600">
              compliance
            </span>
          </div>
        ) : !resultsReady ? (
          <div
            className="mb-3 rounded-md border border-dashed border-icta-gray-200 px-3 py-4"
            aria-live="polite"
          >
            <Skeleton className="mb-1 h-5 w-24 rounded-md" />
            <p className="mt-1 text-xs text-icta-gray-600">
              Weighted score and summary appear when all checks finish.
            </p>
          </div>
        ) : null}

        {showDeclineHeadline && comparedSnapshot && comparison?.current && (
          <p className="mb-3 text-base text-icta-black">
            <button
              type="button"
              onClick={() => setComparisonOpen(true)}
              className={`text-left ${linkUnderline}`}
            >
              Compliance dropped from{" "}
              {comparedSnapshot.overall_score.toFixed(0)}% to{" "}
              {comparison.current.overall_score.toFixed(0)}% since{" "}
              {periodLabel}
            </button>
          </p>
        )}

        <p className="text-base leading-relaxed text-icta-black">
          Scan of{" "}
          <span className="font-medium">{scannedUrl ?? "this site"}</span>
          {cacheHit ? " (cached)" : ""}
          {!resultsReady ? " so far" : ""} found{" "}
          <InlineStat
            count={stats.fail}
            label={stats.fail === 1 ? "failure" : "failures"}
            onClick={() => openPanel("fail")}
          />
          ,{" "}
          <InlineStat
            count={stats.manual_review}
            label="needing review"
            onClick={() => openPanel("manual_review")}
          />
          , and{" "}
          <InlineStat
            count={stats.pass}
            label={stats.pass === 1 ? "pass" : "passes"}
            onClick={() => openPanel("pass")}
          />{" "}
          across{" "}
          <InlineStat
            count={stats.total}
            label="checks"
            onClick={() => openPanel("all")}
          />
          .
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-icta-gray-600">
          {resultsReady && findingCount != null && findingCount !== stats.total && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-icta-gray-100 px-2 py-1 tabular-nums">
              {findingCount} total findings
            </span>
          )}
          {weightsSource && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-icta-gray-100 px-2 py-1">
              Weights: {weightsSource === "database" ? "configured" : "defaults"}
            </span>
          )}
          {updatedAt && (
            <time
              dateTime={updatedAt}
              className="inline-flex items-center gap-1.5 rounded-md bg-icta-gray-100 px-2 py-1 tabular-nums"
            >
              {formatTimestamp(updatedAt)}
            </time>
          )}
        </div>

        <div className="mt-5">
          <StatusDonut
            findings={findings}
            onSelect={(filter) => openPanel(filter)}
          />
        </div>

        {resultsReady && jobId && comparison !== null && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
            <label className="flex flex-wrap items-center gap-2 text-sm text-icta-black">
              <span className="text-icta-gray-600">Compare to</span>
              <select
                value={comparePeriod}
                disabled={!anyHistoryAvailable}
                onChange={(e) =>
                  setComparePeriod(e.target.value as ComparisonPeriod)
                }
                className={`${inputBase} w-auto min-w-[10rem] py-1.5`}
                aria-label="Comparison period"
              >
                {COMPARISON_PERIOD_OPTIONS.map((option) => {
                  const enabled = availablePeriods.includes(option.value);
                  return (
                    <option
                      key={option.value}
                      value={option.value}
                      disabled={!enabled}
                    >
                      {option.label}
                      {!enabled ? " (no data yet)" : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            <button
              type="button"
              disabled={!hasHistory}
              onClick={() => setComparisonOpen(true)}
              className={btnSecondarySm}
            >
              View comparison
            </button>
            {!anyHistoryAvailable && (
              <span className="text-sm text-icta-gray-600">
                No earlier snapshots yet — scan again after some time to compare.
              </span>
            )}
            {anyHistoryAvailable && !hasHistory && (
              <span className="text-sm text-icta-gray-600">
                No snapshot available for {periodLabel} yet.
              </span>
            )}
          </div>
        )}
      </section>

      {resultsReady && narrative ? (
        <section aria-label="Scan summary" className="animate-fade-in-up" style={{ animationDelay: "60ms" }}>
          <h2 className="mb-2 text-lg font-semibold text-icta-black">Summary</h2>
          <NarrativeSummary
            text={narrative}
            stats={stats}
            overallScore={
              overallScore !== null && overallScore !== undefined
                ? Number(overallScore)
                : null
            }
            onStatClick={(kind) => {
              if (kind === "score") openPanel("all");
              else openPanel(kind);
            }}
          />
        </section>
      ) : !resultsReady ? (
        <section aria-label="Scan summary pending" aria-busy="true">
          <h2 className="mb-2 text-lg font-semibold text-icta-black">Summary</h2>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-5/6 rounded-md" />
            <Skeleton className="h-4 w-2/3 rounded-md" />
          </div>
        </section>
      ) : null}

      {resultsReady && topIssues.length > 0 ? (
        <section className="animate-fade-in-up" style={{ animationDelay: "120ms" }}>
          <h2 className="mb-3 text-lg font-semibold text-icta-black">
            Top issues
          </h2>
          <ul className="space-y-2">
            {topIssues.map((f) => {
              const weight = findingVisualWeight(f.status, f.severity);
              return (
                <li
                  key={`top-${f.category}-${f.check_name}-${f.clause_reference}`}
                  className={`${weight.row}`}
                >
                  <div className="px-3 py-3">
                    <button
                      type="button"
                      className="w-full text-left hover:opacity-90"
                      onClick={() =>
                        openFindings(
                          [f],
                          f.check_name,
                          `${labelCategory(f.category)} · clause ${f.clause_reference}`,
                        )
                      }
                    >
                      <div className={`text-sm ${weight.name}`}>{f.check_name}</div>
                      <div className="mt-0.5 text-xs text-icta-gray-600">
                        {labelCategory(f.category)} ·{" "}
                        <span className={weight.severityLabel}>{f.severity}</span>
                      </div>
                      <p className="mt-1 text-sm text-icta-gray-600">
                        {findingSummaryLine(f)}
                      </p>
                    </button>
                    <div className="mt-1.5 text-xs">
                      <ClauseLink clause={f.clause_reference} showPrefix />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : !resultsReady ? (
        <section aria-busy="true">
          <h2 className="mb-3 text-lg font-semibold text-icta-black">
            Top issues
          </h2>
          <div className="space-y-3">
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-4/5 rounded-md" />
          </div>
        </section>
      ) : null}

      {resultsReady && categoryScores.length > 0 && (
        <section className="animate-fade-in-up" style={{ animationDelay: "180ms" }}>
          <CategoryScoreBars
            categoryScores={categoryScores}
            findings={findings}
            onCategoryClick={(category) => openPanel("all", category)}
          />
        </section>
      )}

      <section className="space-y-6 animate-fade-in-up" style={{ animationDelay: "240ms" }}>
        <h2 className="text-lg font-semibold text-icta-black">
          Findings by category
          {!resultsReady ? (
            <span className="ml-2 text-sm font-normal text-icta-gray-600">
              (updating)
            </span>
          ) : null}
        </h2>
        {grouped.map((group) => {
          const catScore = scoreByCategory.get(group.category);
          const fails = group.findings.filter((f) => f.status === "fail").length;
          return (
            <div key={group.category}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold text-icta-black">
                  <button
                    type="button"
                    className={linkUnderline}
                    onClick={() => openPanel("all", group.category)}
                  >
                    {group.label}
                  </button>
                </h3>
                <span className="text-sm text-icta-gray-600">
                  {catScore != null ? `${Number(catScore).toFixed(1)}% · ` : ""}
                  {fails > 0 ? (
                    <button
                      type="button"
                      className={textLink}
                      onClick={() =>
                        openFindings(
                          group.findings.filter((f) => f.status === "fail"),
                          `${group.label} — failures`,
                          `${fails} failed`,
                        )
                      }
                    >
                      {fails} failed
                    </button>
                  ) : (
                    `${group.findings.length} checks`
                  )}
                </span>
              </div>
              <ul className="divide-y divide-icta-gray-100 border border-icta-gray-200">
                {group.findings.map((f) => (
                  <FindingListItem
                    key={`${f.check_name}-${f.clause_reference}`}
                    finding={f}
                    onOpen={() =>
                      openFindings(
                        [f],
                        f.check_name,
                        `${labelCategory(f.category)} · clause ${f.clause_reference}`,
                      )
                    }
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <FindingsSidePanel
        open={panelOpen}
        title={panelTitle}
        subtitle={panelSubtitle}
        findings={panelFindings}
        onClose={() => setPanelOpen(false)}
      />

        <ComparisonSidePanel
          open={comparisonOpen}
          comparison={comparison}
          periodLabel={periodLabel}
          onClose={() => setComparisonOpen(false)}
        />
    </div>
  );
}
