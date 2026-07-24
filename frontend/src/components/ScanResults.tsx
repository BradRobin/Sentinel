"use client";

import { useEffect, useMemo, useState } from "react";

import { ComparisonSidePanel } from "@/components/ComparisonSidePanel";
import { FindingsSidePanel } from "@/components/FindingsSidePanel";
import { CategoryScoreBars, StatusDonut } from "@/components/ScoreCharts";
import {
  getScanComparison,
  type CategoryScore,
  type ComparisonResponse,
  type Finding,
} from "@/lib/api";
import {
  findingSummaryLine,
  findingVisualWeight,
  groupFindingsByCategory,
  labelCategory,
  sortFindingsByPriority,
  summarizeFindings,
  topFailFindings,
  type StatFilter,
} from "@/lib/findings";
import { btnSecondarySm } from "@/lib/ui";

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
}

function InlineStat({
  count,
  label,
  onClick,
  tone,
}: {
  count: number;
  label: string;
  onClick: () => void;
  tone: "fail" | "review" | "pass" | "neutral";
}) {
  const toneClass =
    tone === "fail"
      ? "text-icta-red"
      : tone === "pass"
        ? "text-icta-green"
        : "text-icta-black";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`underline decoration-from-font underline-offset-2 hover:opacity-80 ${toneClass}`}
    >
      {count} {label}
    </button>
  );
}

function FindingListItem({
  finding,
  onOpen,
}: {
  finding: Finding;
  onOpen: () => void;
}) {
  const weight = findingVisualWeight(finding.status, finding.severity);
  return (
    <li>
      <button
        type="button"
        className={`flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm hover:bg-icta-gray-50 ${weight.row}`}
        onClick={onOpen}
      >
        <span
          className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs uppercase ${weight.badge}`}
        >
          {finding.status === "manual_review" ? "review" : finding.status}
        </span>
        <span className="min-w-0 flex-1">
          <span className={weight.name}>{finding.check_name}</span>
          <span className="mt-0.5 block text-xs text-icta-gray-600">
            clause {finding.clause_reference} ·{" "}
            <span className={weight.severityLabel}>{finding.severity}</span>
          </span>
        </span>
      </button>
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

  useEffect(() => {
    if (!jobId || !resultsReady) {
      setComparison(null);
      return;
    }
    let cancelled = false;
    getScanComparison(jobId)
      .then((data) => {
        if (!cancelled) setComparison(data);
      })
      .catch(() => {
        if (!cancelled) setComparison({ has_history: false });
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, resultsReady]);

  const hasHistory = comparison?.has_history === true;
  const overallDelta = comparison?.delta?.overall ?? null;
  const showDeclineHeadline =
    hasHistory &&
    overallDelta != null &&
    overallDelta <= DECLINE_HEADLINE_THRESHOLD &&
    comparison?.previous &&
    comparison?.current;

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
    return (
      <div className="rounded-md border border-dashed border-icta-gray-200 px-4 py-8 text-center text-sm text-icta-gray-600">
        No findings were returned for this scan.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
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
            <p className="text-sm font-medium text-icta-gray-600">
              Overall score pending…
            </p>
            <p className="mt-1 text-xs text-icta-gray-600">
              Weighted score and summary appear when all checks finish.
            </p>
          </div>
        ) : null}

        {showDeclineHeadline && comparison?.previous && comparison?.current && (
          <p className="mb-3 text-base text-icta-black">
            <button
              type="button"
              onClick={() => setComparisonOpen(true)}
              className="text-left underline decoration-from-font underline-offset-2 hover:opacity-80"
            >
              Compliance dropped from{" "}
              {comparison.previous.overall_score.toFixed(0)}% to{" "}
              {comparison.current.overall_score.toFixed(0)}% since{" "}
              {comparison.previous.quarter}
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
            tone="fail"
            onClick={() => openPanel("fail")}
          />
          ,{" "}
          <InlineStat
            count={stats.manual_review}
            label="needing review"
            tone="review"
            onClick={() => openPanel("manual_review")}
          />
          , and{" "}
          <InlineStat
            count={stats.pass}
            label={stats.pass === 1 ? "pass" : "passes"}
            tone="pass"
            onClick={() => openPanel("pass")}
          />{" "}
          across{" "}
          <InlineStat
            count={stats.total}
            label="checks"
            tone="neutral"
            onClick={() => openPanel("all")}
          />
          .
        </p>

        <div className="mt-5">
          <StatusDonut
            findings={findings}
            onSelect={(filter) => openPanel(filter)}
          />
        </div>

        {resultsReady && jobId && comparison !== null && (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              disabled={!hasHistory}
              onClick={() => setComparisonOpen(true)}
              className={btnSecondarySm}
            >
              Compare to last quarter
            </button>
            {!hasHistory && (
              <span className="text-sm text-icta-gray-600">
                No historical data yet — check back next quarter.
              </span>
            )}
          </div>
        )}
      </section>

      {resultsReady && narrative ? (
        <section aria-label="Scan summary">
          <h2 className="mb-2 text-lg font-semibold text-icta-black">Summary</h2>
          <p className="text-base leading-relaxed text-icta-black">{narrative}</p>
        </section>
      ) : !resultsReady ? (
        <section aria-label="Scan summary pending" aria-busy="true">
          <h2 className="mb-2 text-lg font-semibold text-icta-black">Summary</h2>
          <p className="text-sm text-icta-gray-600">
            Summary will appear after scoring finishes.
          </p>
        </section>
      ) : null}

      {resultsReady && topIssues.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-icta-black">
            Top issues
          </h2>
          <ul className="space-y-2">
            {topIssues.map((f) => {
              const weight = findingVisualWeight(f.status, f.severity);
              return (
                <li key={`top-${f.category}-${f.check_name}-${f.clause_reference}`}>
                  <button
                    type="button"
                    className={`w-full px-3 py-3 text-left hover:bg-icta-gray-50 ${weight.row}`}
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
          <p className="text-sm text-icta-gray-600">
            Top issues will be ranked once all categories complete.
          </p>
        </section>
      ) : null}

      {resultsReady && categoryScores.length > 0 && (
        <section>
          <CategoryScoreBars
            categoryScores={categoryScores}
            findings={findings}
            onCategoryClick={(category) => openPanel("all", category)}
          />
        </section>
      )}

      <section className="space-y-6">
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
                    className="underline decoration-from-font underline-offset-2 hover:opacity-80"
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
                      className="text-icta-red underline decoration-from-font underline-offset-2"
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
        onClose={() => setComparisonOpen(false)}
      />
    </div>
  );
}
