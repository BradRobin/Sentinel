"use client";

import { useMemo, useState } from "react";

import { FindingsSidePanel } from "@/components/FindingsSidePanel";
import type { CategoryScore, Finding } from "@/lib/api";
import {
  groupFindingsByCategory,
  labelCategory,
  summarizeFindings,
  type StatFilter,
} from "@/lib/findings";

interface ScanResultsProps {
  findings: Finding[];
  overallScore: number | null;
  categoryScores: CategoryScore[];
  cacheHit?: boolean;
  scannedUrl?: string | null;
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

function statusBadge(status: string): string {
  if (status === "pass") return "bg-icta-green/10 text-icta-green";
  if (status === "fail") return "bg-icta-red/10 text-icta-red";
  return "bg-icta-gray-100 text-icta-gray-600";
}

export function ScanResults({
  findings,
  overallScore,
  categoryScores,
  cacheHit,
  scannedUrl,
}: ScanResultsProps) {
  const stats = useMemo(() => summarizeFindings(findings), [findings]);
  const grouped = useMemo(() => groupFindingsByCategory(findings), [findings]);
  const scoreByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of categoryScores) map.set(c.category, c.score);
    return map;
  }, [categoryScores]);

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTitle, setPanelTitle] = useState("");
  const [panelSubtitle, setPanelSubtitle] = useState<string | undefined>();
  const [panelFindings, setPanelFindings] = useState<Finding[]>([]);

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

    setPanelTitle(title);
    setPanelSubtitle(subtitle);
    setPanelFindings(list);
    setPanelOpen(true);
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
      {/* Score + summary sentence with clickable inline stats */}
      <section>
        {overallScore !== null && overallScore !== undefined && (
          <div className="mb-3 text-4xl font-bold tracking-tight text-icta-black">
            {Number(overallScore).toFixed(1)}%
            <span className="ml-2 text-base font-medium text-icta-gray-600">
              compliance
            </span>
          </div>
        )}

        <p className="text-base leading-relaxed text-icta-black">
          Scan of{" "}
          <span className="font-medium">{scannedUrl ?? "this site"}</span>
          {cacheHit ? " (cached)" : ""} found{" "}
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

        {categoryScores.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[280px] text-left text-sm">
              <thead>
                <tr className="border-b border-icta-gray-200 text-icta-gray-600">
                  <th className="py-2 pr-4 font-medium">Category</th>
                  <th className="py-2 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {categoryScores.map((c) => (
                  <tr key={c.category} className="border-b border-icta-gray-100">
                    <td className="py-2 pr-4">
                      <button
                        type="button"
                        className="text-left text-icta-black underline decoration-from-font underline-offset-2 hover:opacity-80"
                        onClick={() => openPanel("all", c.category)}
                      >
                        {labelCategory(c.category)}
                      </button>
                    </td>
                    <td className="py-2 font-mono text-icta-black">
                      {Number(c.score).toFixed(1)}%
                      {c.weight != null ? (
                        <span className="ml-2 text-icta-gray-600">
                          wt {c.weight}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Grouped findings */}
      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-icta-black">
          Findings by category
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
                      onClick={() => {
                        setPanelTitle(`${group.label} — failures`);
                        setPanelSubtitle(`${fails} failed`);
                        setPanelFindings(
                          group.findings.filter((f) => f.status === "fail"),
                        );
                        setPanelOpen(true);
                      }}
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
                  <li key={`${f.check_name}-${f.clause_reference}`}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm hover:bg-icta-gray-50"
                      onClick={() => {
                        setPanelTitle(f.check_name);
                        setPanelSubtitle(
                          `${labelCategory(f.category)} · clause ${f.clause_reference}`,
                        );
                        setPanelFindings([f]);
                        setPanelOpen(true);
                      }}
                    >
                      <span
                        className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold uppercase ${statusBadge(f.status)}`}
                      >
                        {f.status === "manual_review" ? "review" : f.status}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="font-medium text-icta-black">
                          {f.check_name}
                        </span>
                        <span className="mt-0.5 block text-xs text-icta-gray-600">
                          clause {f.clause_reference} · {f.severity}
                        </span>
                      </span>
                    </button>
                  </li>
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
    </div>
  );
}
