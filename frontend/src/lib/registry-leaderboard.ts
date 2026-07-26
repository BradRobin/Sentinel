import type { RegistryEntry } from "@/lib/api";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/findings";

/** Scored categories only (monitoring is not on the registry leaderboard). */
export const LEADERBOARD_CATEGORIES = CATEGORY_ORDER.filter(
  (key) => key !== "monitoring",
);

export type LeaderboardMetric = "overall" | (typeof LEADERBOARD_CATEGORIES)[number];

export const LEADERBOARD_METRIC_OPTIONS: Array<{
  value: LeaderboardMetric;
  label: string;
  headline: string;
}> = [
  {
    value: "overall",
    label: "Overall",
    headline: "Most compliant government sites",
  },
  {
    value: "security",
    label: "Security",
    headline: "Most secure government sites",
  },
  {
    value: "accessibility",
    label: "Accessibility",
    headline: "Most accessible government sites",
  },
  {
    value: "seo",
    label: "SEO",
    headline: "Most visible government sites",
  },
  {
    value: "domain_identity",
    label: "Domain",
    headline: "Strongest domain & identity compliance",
  },
  {
    value: "interoperability",
    label: "Interop",
    headline: "Strongest interoperability compliance",
  },
  {
    value: "design_branding",
    label: "Design",
    headline: "Strongest design & branding compliance",
  },
  {
    value: "multimedia_performance",
    label: "Performance",
    headline: "Strongest multimedia & performance compliance",
  },
  {
    value: "legal_content",
    label: "Legal",
    headline: "Strongest legal & content compliance",
  },
];

export function metricLabel(metric: LeaderboardMetric): string {
  if (metric === "overall") return "Overall";
  return CATEGORY_LABELS[metric] ?? metric.replaceAll("_", " ");
}

export function scoreForMetric(
  entry: RegistryEntry,
  metric: LeaderboardMetric,
): number | null {
  if (metric === "overall") {
    return entry.latest_score ?? null;
  }
  const raw = entry.category_breakdown?.[metric];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

export function rankRegistryEntries(
  entries: RegistryEntry[],
  metric: LeaderboardMetric,
): Array<RegistryEntry & { rank_score: number }> {
  return entries
    .map((entry) => {
      const rank_score = scoreForMetric(entry, metric);
      return rank_score === null ? null : { ...entry, rank_score };
    })
    .filter((row): row is RegistryEntry & { rank_score: number } => row !== null)
    .sort((a, b) => {
      if (b.rank_score !== a.rank_score) return b.rank_score - a.rank_score;
      const nameA = (a.registered_name || a.org_name).toLowerCase();
      const nameB = (b.registered_name || b.org_name).toLowerCase();
      return nameA.localeCompare(nameB);
    });
}
