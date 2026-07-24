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
      ordered.push({ category: cat, label: labelCategory(cat), findings: items });
      map.delete(cat);
    }
  }
  for (const [category, items] of map) {
    ordered.push({ category, label: labelCategory(category), findings: items });
  }
  return ordered;
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
