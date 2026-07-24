import type { Finding } from "@/lib/api";

/** Display order aligned with SRS scoring categories */
export const CATEGORY_ORDER = [
  "domain_identity",
  "security",
  "interoperability",
  "accessibility",
  "design_branding",
  "multimedia_performance",
  "legal_content",
  "seo",
  "monitoring",
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  domain_identity: "Domain & identity",
  security: "Security",
  interoperability: "Interoperability",
  accessibility: "Accessibility",
  design_branding: "Design & branding",
  multimedia_performance: "Multimedia & performance",
  legal_content: "Legal & content",
  seo: "SEO & visibility",
  monitoring: "Monitoring",
};

/** Processing-state labels driven by polled `current_category` keys */
export const CHECKING_CATEGORY_LABELS: Record<string, string> = {
  domain_identity: "Checking domain identity…",
  security: "Checking security…",
  interoperability: "Checking interoperability…",
  accessibility: "Checking accessibility…",
  design_branding: "Checking design and branding…",
  multimedia_performance: "Checking multimedia and performance…",
  legal_content: "Checking legal and content…",
  seo: "Checking SEO and visibility…",
};

export const SCORED_CATEGORY_COUNT = 8;

export type StatFilter = "fail" | "manual_review" | "pass" | "all";

export interface FindingStats {
  total: number;
  pass: number;
  fail: number;
  manual_review: number;
}

export function labelCategory(category: string): string {
  return CATEGORY_LABELS[category] ?? category.replaceAll("_", " ");
}

export function checkingLabel(category: string | null | undefined): string | null {
  if (!category) return null;
  return (
    CHECKING_CATEGORY_LABELS[category] ??
    `Checking ${labelCategory(category).toLowerCase()}…`
  );
}

export function summarizeFindings(findings: Finding[]): FindingStats {
  const stats: FindingStats = { total: findings.length, pass: 0, fail: 0, manual_review: 0 };
  for (const f of findings) {
    if (f.status === "pass") stats.pass += 1;
    else if (f.status === "fail") stats.fail += 1;
    else if (f.status === "manual_review") stats.manual_review += 1;
  }
  return stats;
}

/** Schema values from Finding.severity — high | medium | low */
export type FindingSeverity = "high" | "medium" | "low";

const STATUS_RANK: Record<string, number> = {
  fail: 0,
  manual_review: 1,
  pass: 2,
};

const SEVERITY_RANK: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/** fail (high→low), then manual_review (high→low), then pass */
export function compareFindingsPriority(a: Finding, b: Finding): number {
  const byStatus =
    (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99);
  if (byStatus !== 0) return byStatus;
  return (
    (SEVERITY_RANK[a.severity] ?? 99) - (SEVERITY_RANK[b.severity] ?? 99)
  );
}

export function sortFindingsByPriority(findings: Finding[]): Finding[] {
  return [...findings].sort(compareFindingsPriority);
}

export function groupFindingsByCategory(
  findings: Finding[],
): { category: string; label: string; findings: Finding[] }[] {
  const map = new Map<string, Finding[]>();
  for (const f of findings) {
    const list = map.get(f.category) ?? [];
    list.push(f);
    map.set(f.category, list);
  }

  const ordered: { category: string; label: string; findings: Finding[] }[] = [];
  for (const cat of CATEGORY_ORDER) {
    const items = map.get(cat);
    if (items?.length) {
      ordered.push({
        category: cat,
        label: labelCategory(cat),
        findings: sortFindingsByPriority(items),
      });
      map.delete(cat);
    }
  }
  for (const [category, items] of map) {
    ordered.push({
      category,
      label: labelCategory(category),
      findings: sortFindingsByPriority(items),
    });
  }
  return ordered;
}

/** Highest-severity fails across the whole scan (for Top issues). */
export function topFailFindings(
  findings: Finding[],
  limit = 3,
): Finding[] {
  return findings
    .filter((f) => f.status === "fail")
    .sort((a, b) => {
      const bySev =
        (SEVERITY_RANK[a.severity] ?? 99) - (SEVERITY_RANK[b.severity] ?? 99);
      if (bySev !== 0) return bySev;
      return a.check_name.localeCompare(b.check_name);
    })
    .slice(0, limit);
}

/** One-line plain description from finding.detail for summaries. */
export function findingSummaryLine(finding: Finding): string {
  const d = finding.detail ?? {};
  for (const key of ["error", "note", "message", "summary", "reason"]) {
    const v = d[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  if (Array.isArray(d.missing) && d.missing.length > 0) {
    return `Missing: ${d.missing.map(String).join(", ")}`;
  }
  if (Array.isArray(d.exposed) && d.exposed.length > 0) {
    return `Exposed: ${d.exposed.map(String).join(", ")}`;
  }
  if (Array.isArray(d.issues) && d.issues.length > 0) {
    return String(d.issues[0]);
  }
  for (const v of Object.values(d)) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return `Clause ${finding.clause_reference}`;
}

export interface FindingVisualWeight {
  /** Left border + optional tint — non-color severity cue */
  row: string;
  /** Side-panel / section header accent */
  header: string;
  name: string;
  badge: string;
  severityLabel: string;
}

/**
 * Visual weight from status + severity.
 * Passes stay quiet; only fail / manual_review escalate.
 * Border width + font weight reinforce color (WCAG — not color alone).
 */
export function findingVisualWeight(
  status: string,
  severity: string,
): FindingVisualWeight {
  if (status === "pass") {
    return {
      row: "border-l-2 border-l-transparent",
      header: "border-l-4 border-l-icta-green",
      name: "font-medium text-icta-black",
      badge: "bg-icta-green/10 text-icta-green font-semibold",
      severityLabel: "text-icta-gray-600",
    };
  }

  if (status === "manual_review") {
    return {
      row: "border-l-[3px] border-l-icta-gray-200",
      header: "border-l-4 border-l-icta-gray-200",
      name: "font-medium text-icta-black",
      badge: "bg-icta-gray-100 text-icta-gray-600 font-semibold",
      severityLabel: "text-icta-gray-600",
    };
  }

  // fail
  if (severity === "high") {
    return {
      row: "border-l-4 border-l-icta-red bg-icta-red/[0.04]",
      header: "border-l-4 border-l-icta-red bg-icta-red/[0.04]",
      name: "font-bold text-icta-black",
      badge: "bg-icta-red/15 text-icta-red font-bold",
      severityLabel: "font-semibold text-icta-red",
    };
  }
  if (severity === "medium") {
    return {
      row: "border-l-[3px] border-l-icta-amber",
      header: "border-l-4 border-l-icta-amber",
      name: "font-semibold text-icta-black",
      badge: "bg-icta-amber/10 text-icta-amber font-semibold",
      severityLabel: "font-medium text-icta-amber",
    };
  }
  // low
  return {
    row: "border-l-2 border-l-icta-red/45",
    header: "border-l-4 border-l-icta-red/45",
    name: "font-medium text-icta-black",
    badge: "bg-icta-red/10 text-icta-red font-semibold",
    severityLabel: "text-icta-gray-600",
  };
}

export type ScanErrorKind =
  | "invalid_url"
  | "unreachable"
  | "timeout"
  | "not_allowed"
  | "generic";

export function classifyScanError(message: string): ScanErrorKind {
  const m = message.toLowerCase();
  if (m.includes("timed out") || m.includes("timeout")) return "timeout";
  if (
    m.includes("not allowed") ||
    m.includes("restricted to") ||
    m.includes(".go.ke")
  ) {
    return "not_allowed";
  }
  if (
    m.includes("unable to resolve") ||
    m.includes("failed to reach") ||
    m.includes("unreachable") ||
    m.includes("connection") ||
    m.includes("name or service")
  ) {
    return "unreachable";
  }
  if (
    m.includes("url is required") ||
    m.includes("valid hostname") ||
    m.includes("only http") ||
    m.includes("invalid url") ||
    m.includes("malformed")
  ) {
    return "invalid_url";
  }
  return "generic";
}

export function errorTitle(kind: ScanErrorKind): string {
  switch (kind) {
    case "invalid_url":
      return "Invalid URL";
    case "unreachable":
      return "Site unreachable";
    case "timeout":
      return "Scan timed out";
    case "not_allowed":
      return "Domain not allowed";
    default:
      return "Something went wrong";
  }
}

export function errorHint(kind: ScanErrorKind): string {
  switch (kind) {
    case "invalid_url":
      return "Enter a full URL starting with https://, for example https://www.ict.go.ke";
    case "unreachable":
      return "We could not reach the API or the site. Check that Docker is running and the hostname resolves.";
    case "timeout":
      return "The scan took too long. Try again, or use Force fresh scan if the worker is busy.";
    case "not_allowed":
      return "Scans are limited to .go.ke and .gov.ke domains by default.";
    default:
      return "Review the details below and try again.";
  }
}
