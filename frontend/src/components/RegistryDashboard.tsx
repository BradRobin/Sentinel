"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import {
  getRegistry,
  type RegistryEntry,
  type RegistryTrend,
} from "@/lib/api";

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

type OrgFilter = "all" | "ministry" | "agency" | "county";

export function RegistryDashboard() {
  const [items, setItems] = useState<RegistryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [orgFilter, setOrgFilter] = useState<OrgFilter>("all");
  const [pending, startTransition] = useTransition();

  function load(nextQuery: string, nextFilter: OrgFilter) {
    startTransition(async () => {
      try {
        setError(null);
        const data = await getRegistry({
          q: nextQuery.trim() || undefined,
          orgType: nextFilter === "all" ? undefined : nextFilter,
          limit: 300,
        });
        setItems(data.items);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load registry",
        );
        setItems([]);
      }
    });
  }

  useEffect(() => {
    load("", "all");
  }, []);

  const scored = items.filter((i) => i.latest_score !== null).length;

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
        <Link
          href="/"
          className="mb-8 inline-block text-sm text-icta-gray-600 hover:text-icta-black"
        >
          ← Back
        </Link>

        <h1 className="mb-2 text-2xl font-bold text-icta-black">
          MCDA registry
        </h1>
        <p className="mb-6 max-w-2xl text-sm text-icta-gray-600">
          Known ministries, counties, and agencies with the latest compliance
          score from weekly scheduled scans. Trend compares the two most recent
          updates.
        </p>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:max-w-md">
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
              className="w-full rounded-md border border-icta-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  orgFilter === value
                    ? "bg-icta-black text-white"
                    : "border border-icta-gray-200 text-icta-gray-600 hover:bg-icta-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => load(query, orgFilter)}
              className="rounded-md bg-icta-red px-3 py-1.5 text-sm font-semibold text-white"
            >
              Refresh
            </button>
          </div>
        </div>

        <p className="mb-4 text-xs text-icta-gray-600">
          {pending ? "Loading…" : `${items.length} MCDAs`}
          {!pending && scored > 0 ? ` · ${scored} with scores` : ""}
        </p>

        {error && (
          <div
            className="mb-6 rounded-md border border-icta-red/20 bg-icta-red/5 px-4 py-3 text-sm text-icta-red"
            role="alert"
          >
            {error}
            <span className="mt-1 block text-icta-gray-600">
              Apply the registry migration and run{" "}
              <code className="text-xs">scripts/seed_mcda_registry.py</code> if
              the table is empty.
            </span>
          </div>
        )}

        <div className="overflow-x-auto border-t border-icta-gray-200">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-icta-gray-200 text-xs uppercase tracking-wide text-icta-gray-600">
                <th className="py-3 pr-4 font-medium">Organization</th>
                <th className="py-3 pr-4 font-medium">Type</th>
                <th className="py-3 pr-4 font-medium">Score</th>
                <th className="py-3 pr-4 font-medium">Trend</th>
                <th className="py-3 font-medium">Last checked</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !pending && !error && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-10 text-center text-icta-gray-600"
                  >
                    No verified MCDAs yet. Seed the registry to populate this
                    list.
                  </td>
                </tr>
              )}
              {items.map((row) => (
                <tr
                  key={row.domain_id}
                  className="border-b border-icta-gray-100 align-top"
                >
                  <td className="py-3 pr-4">
                    <div className="font-medium text-icta-black">
                      {row.registered_name || row.org_name}
                    </div>
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-xs text-icta-gray-600 hover:text-icta-black"
                    >
                      {row.url}
                    </a>
                  </td>
                  <td className="py-3 pr-4 capitalize text-icta-gray-600">
                    {row.org_type}
                  </td>
                  <td className="py-3 pr-4 font-medium tabular-nums text-icta-black">
                    {formatScore(row.latest_score)}
                  </td>
                  <td className={`py-3 pr-4 font-medium ${trendClass(row.trend)}`}>
                    {trendLabel(row.trend)}
                    {row.score_delta !== null && row.trend !== "unknown" ? (
                      <span className="ml-1 text-xs font-normal tabular-nums">
                        ({row.score_delta > 0 ? "+" : ""}
                        {row.score_delta.toFixed(1)})
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 text-icta-gray-600">
                    {formatChecked(row.last_checked_at)}
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
