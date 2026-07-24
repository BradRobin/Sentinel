"use client";

import { useId, useMemo } from "react";

import type { CategoryScore, Finding } from "@/lib/api";
import { labelCategory, summarizeFindings } from "@/lib/findings";

const GREEN = "var(--icta-green)";
const RED = "var(--icta-red)";
const GRAY_TEXT = "var(--icta-gray-600)";

interface StatusCounts {
  pass: number;
  fail: number;
  review: number;
}

function countsFromFindings(findings: Finding[]): StatusCounts {
  const s = summarizeFindings(findings);
  return { pass: s.pass, fail: s.fail, review: s.manual_review };
}

function countsForCategory(
  findings: Finding[],
  category: string,
  score?: CategoryScore,
): StatusCounts {
  const items = findings.filter((f) => f.category === category);
  if (items.length > 0) {
    return {
      pass: items.filter((f) => f.status === "pass").length,
      fail: items.filter((f) => f.status === "fail").length,
      review: items.filter((f) => f.status === "manual_review").length,
    };
  }
  return {
    pass: score?.pass_count ?? 0,
    fail: score?.fail_count ?? 0,
    review: score?.manual_review_count ?? 0,
  };
}

/** Polar → cartesian for donut arcs (angles in degrees, 0 = top). */
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startDeg: number,
  endDeg: number,
): string {
  const sweep = endDeg - startDeg;
  if (sweep <= 0.05) return "";
  const large = sweep > 180 ? 1 : 0;
  const o0 = polar(cx, cy, rOuter, startDeg);
  const o1 = polar(cx, cy, rOuter, endDeg);
  const i1 = polar(cx, cy, rInner, endDeg);
  const i0 = polar(cx, cy, rInner, startDeg);
  return [
    `M ${o0.x} ${o0.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${o1.x} ${o1.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${i0.x} ${i0.y}`,
    "Z",
  ].join(" ");
}

export function StatusDonut({
  findings,
  onSelect,
  size = 120,
}: {
  findings: Finding[];
  onSelect?: (filter: "fail" | "manual_review" | "pass") => void;
  size?: number;
}) {
  const counts = useMemo(() => countsFromFindings(findings), [findings]);
  const total = counts.pass + counts.fail + counts.review;
  const uid = useId();

  const segments = useMemo(() => {
    if (total === 0) return [];
    const parts = (
      [
        { key: "fail" as const, count: counts.fail, color: RED, label: "Failures" },
        {
          key: "manual_review" as const,
          count: counts.review,
          color: "var(--icta-gray-600)",
          label: "Needs review",
          fillOpacity: 0.35,
        },
        { key: "pass" as const, count: counts.pass, color: GREEN, label: "Passes" },
      ] as const
    ).filter((p) => p.count > 0);

    let angle = 0;
    return parts.map((p) => {
      const sweep = (p.count / total) * 360;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      const paths =
        sweep >= 359.9
          ? [
              arcPath(50, 50, 48, 28, 0, 180),
              arcPath(50, 50, 48, 28, 180, 360),
            ]
          : [arcPath(50, 50, 48, 28, start, end)];
      return { ...p, paths, start, end };
    });
  }, [counts, total]);

  if (total === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        role="img"
        aria-labelledby={`${uid}-title ${uid}-desc`}
      >
        <title id={`${uid}-title`}>Check outcome split</title>
        <desc id={`${uid}-desc`}>
          {counts.fail} failures, {counts.review} needing review, {counts.pass}{" "}
          passes
        </desc>
        {segments.map((seg) =>
          seg.paths.map((d, i) =>
            d ? (
              <path
                key={`${seg.key}-${i}`}
                d={d}
                fill={seg.color}
                fillOpacity={"fillOpacity" in seg ? seg.fillOpacity : 1}
                className={
                  onSelect
                    ? "cursor-pointer opacity-95 transition-opacity hover:opacity-80"
                    : undefined
                }
                onClick={() => onSelect?.(seg.key)}
              >
                <title>
                  {seg.label}: {seg.count}
                </title>
              </path>
            ) : null,
          ),
        )}
        <text
          x="50"
          y="48"
          textAnchor="middle"
          className="fill-icta-black"
          style={{ fontSize: 14, fontWeight: 700 }}
        >
          {total}
        </text>
        <text
          x="50"
          y="60"
          textAnchor="middle"
          style={{ fontSize: 7, fill: GRAY_TEXT }}
        >
          checks
        </text>
      </svg>

      <ul className="space-y-1.5 text-sm">
        <li>
          <button
            type="button"
            className="inline-flex items-center gap-2 text-icta-red underline decoration-from-font underline-offset-2 hover:opacity-80"
            onClick={() => onSelect?.("fail")}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm bg-icta-red"
              aria-hidden
            />
            {counts.fail} {counts.fail === 1 ? "failure" : "failures"}
          </button>
        </li>
        <li>
          <button
            type="button"
            className="inline-flex items-center gap-2 text-icta-gray-600 underline decoration-from-font underline-offset-2 hover:opacity-80"
            onClick={() => onSelect?.("manual_review")}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm bg-icta-gray-200 ring-1 ring-icta-gray-600/30"
              aria-hidden
            />
            {counts.review} needing review
          </button>
        </li>
        <li>
          <button
            type="button"
            className="inline-flex items-center gap-2 text-icta-green underline decoration-from-font underline-offset-2 hover:opacity-80"
            onClick={() => onSelect?.("pass")}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm bg-icta-green"
              aria-hidden
            />
            {counts.pass} {counts.pass === 1 ? "pass" : "passes"}
          </button>
        </li>
      </ul>
    </div>
  );
}

export function CategoryScoreBars({
  categoryScores,
  findings,
  onCategoryClick,
}: {
  categoryScores: CategoryScore[];
  findings: Finding[];
  onCategoryClick?: (category: string) => void;
}) {
  const rows = useMemo(() => {
    return categoryScores.map((c) => {
      const counts = countsForCategory(findings, c.category, c);
      const total = counts.pass + counts.fail + counts.review;
      return {
        category: c.category,
        label: labelCategory(c.category),
        score: Number(c.score),
        weight: c.weight,
        counts,
        total,
      };
    });
  }, [categoryScores, findings]);

  if (rows.length === 0) return null;

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-icta-black">
        Scores by category
      </h2>
      <p className="mb-4 text-xs text-icta-gray-600">
        Bar segments show pass / fail / review mix; label shows category score.
      </p>
      <ul className="space-y-3">
        {rows.map((row) => {
          const { pass, fail, review } = row.counts;
          const denom = row.total || 1;
          return (
            <li key={row.category}>
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <button
                  type="button"
                  className="text-left text-sm font-medium text-icta-black underline decoration-from-font underline-offset-2 hover:opacity-80"
                  onClick={() => onCategoryClick?.(row.category)}
                >
                  {row.label}
                </button>
                <span className="font-mono text-sm text-icta-black">
                  {row.score.toFixed(1)}%
                  {row.weight != null ? (
                    <span className="ml-2 text-xs text-icta-gray-600">
                      wt {row.weight}
                    </span>
                  ) : null}
                </span>
              </div>
              <div
                className="flex h-3 w-full overflow-hidden rounded-sm bg-icta-gray-100"
                role="img"
                aria-label={`${row.label}: ${pass} pass, ${fail} fail, ${review} review, score ${row.score.toFixed(1)} percent`}
              >
                {row.total === 0 ? (
                  <div
                    className="h-full bg-icta-gray-200"
                    style={{ width: `${Math.max(row.score, 2)}%` }}
                  />
                ) : (
                  <>
                    {pass > 0 && (
                      <div
                        className="h-full bg-icta-green"
                        style={{ width: `${(pass / denom) * 100}%` }}
                        title={`${pass} pass`}
                      />
                    )}
                    {fail > 0 && (
                      <div
                        className="h-full bg-icta-red"
                        style={{ width: `${(fail / denom) * 100}%` }}
                        title={`${fail} fail`}
                      />
                    )}
                    {review > 0 && (
                      <div
                        className="h-full bg-icta-gray-200"
                        style={{ width: `${(review / denom) * 100}%` }}
                        title={`${review} review`}
                      />
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-icta-gray-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-icta-green" aria-hidden /> Pass
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-icta-red" aria-hidden /> Fail
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-sm bg-icta-gray-200 ring-1 ring-icta-gray-600/30"
            aria-hidden
          />{" "}
          Review
        </span>
      </div>
    </div>
  );
}
