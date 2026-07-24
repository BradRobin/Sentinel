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

/** Keys rendered as prose callouts in the side-panel detail view. */
const DETAIL_MESSAGE_KEYS = [
  "error",
  "fetch_error",
  "certificate_error",
  "reason",
  "message",
  "summary",
  "note",
] as const;

/** Meta flags already reflected by finding status / badges — omit from detail. */
const DETAIL_SKIP_KEYS = new Set(["requires_manual_review"]);

const DETAIL_KEY_LABELS: Record<string, string> = {
  error: "Error",
  fetch_error: "Fetch error",
  certificate_error: "Certificate error",
  reason: "Reason",
  message: "Message",
  summary: "Summary",
  note: "Note",
  missing: "Missing",
  exposed: "Exposed paths",
  issues: "Issues",
  probed: "Paths probed",
  samples: "Sample images",
  unlabeled: "Unlabeled inputs",
  oversized: "Oversized images",
  decorative_with_nonempty_alt: "Decorative images with alt text",
  autoplay_elements: "Autoplay elements",
  duplicate_urls: "Duplicate URLs",
  fonts_detected: "Fonts detected",
  unapproved: "Unapproved fonts",
  allowed_suffixes: "Allowed suffixes",
  present: "Headers present",
  sample_headers: "Sample headers",
  robots_txt: "robots.txt",
  sitemap_xml: "sitemap.xml",
  standard_band_ms: "Standard band (ms)",
  https_enforced: "HTTPS enforced",
  certificate_valid: "Certificate valid",
  certificate_expires_at: "Certificate expires",
  skip_navigation_detected: "Skip navigation detected",
  linked_or_mentioned: "Linked or mentioned",
  cookies_detected: "Cookies detected",
  consent_ui: "Consent UI",
  utf8_declared: "UTF-8 declared",
  declared_charset: "Declared charset",
  content_type: "Content type",
  has_doctype: "Has doctype",
  has_title: "Has title",
  has_description: "Has description",
  indexable_signals: "Indexable signals",
  robots_meta: "Robots meta",
  x_robots_tag: "X-Robots-Tag",
  robots_disallow_all: "Robots disallow all",
  excessive_inline: "Excessive inline styles",
  external_stylesheets: "External stylesheets",
  style_blocks: "Style blocks",
  inline_style_attrs: "Inline style attributes",
  images_total: "Images total",
  missing_alt_count: "Missing alt count",
  tables_total: "Tables total",
  tables_missing_th: "Tables missing headers",
  images_found: "Images found",
  images_checked: "Images checked",
  threshold_bytes: "Size threshold",
  elapsed_ms: "Elapsed",
  max_ms: "Maximum allowed",
  max_allowed: "Maximum allowed",
  http_status: "HTTP status",
  registrable_part: "Registrable part",
};

export function labelDetailKey(key: string): string {
  if (DETAIL_KEY_LABELS[key]) return DETAIL_KEY_LABELS[key];
  const spaced = key.replaceAll("_", " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMs(n: number): string {
  if (n >= 1000) {
    const sec = Math.round((n / 1000) * 10) / 10;
    return `${sec}s (${n} ms)`;
  }
  return `${n} ms`;
}

export function formatDetailScalar(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (
      key === "bytes" ||
      key === "threshold_bytes" ||
      key.endsWith("_bytes")
    ) {
      return formatBytes(value);
    }
    if (key === "elapsed_ms" || key === "max_ms" || key.endsWith("_ms")) {
      return formatMs(value);
    }
    return String(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || "—";
  }
  if (Array.isArray(value)) {
    return value.map((item) => formatDetailListItem(item)).join(", ");
  }
  return String(value);
}

/** Compact one-line representation of a list item (string or object). */
export function formatDetailListItem(item: unknown): string {
  if (item === null || item === undefined) return "—";
  if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
    return String(item);
  }
  if (typeof item !== "object") return String(item);

  const o = item as Record<string, unknown>;

  if (typeof o.path === "string") {
    const parts = [o.path];
    if (o.status_code != null) parts.push(`HTTP ${o.status_code}`);
    if (typeof o.bytes === "number") parts.push(formatBytes(o.bytes));
    return parts.join(" · ");
  }

  if (typeof o.url === "string") {
    const parts = [o.url];
    if (typeof o.bytes === "number") parts.push(formatBytes(o.bytes));
    return parts.join(" · ");
  }

  if (typeof o.src === "string") {
    const parts = [o.src];
    if (typeof o.alt === "string" && o.alt) parts.push(`alt: “${o.alt}”`);
    return parts.join(" · ");
  }

  if ("name" in o || "type" in o || "id" in o) {
    const parts: string[] = [];
    if (o.name != null && o.name !== "") parts.push(`name: ${o.name}`);
    if (o.type != null && o.type !== "") parts.push(`type: ${o.type}`);
    if (o.id != null && o.id !== "") parts.push(`id: ${o.id}`);
    if (parts.length) return parts.join(" · ");
  }

  return Object.entries(o)
    .map(([k, v]) => `${labelDetailKey(k)}: ${formatDetailScalar(k, v)}`)
    .join(" · ");
}

export interface PartitionedFindingDetail {
  messages: { key: string; value: string }[];
  lists: { key: string; items: unknown[] }[];
  objects: { key: string; value: Record<string, unknown> }[];
  scalars: { key: string; value: unknown }[];
}

/**
 * Split detail jsonb into display buckets: prose messages, lists,
 * nested objects, and scalar rows. Unknown shapes fall through to scalars.
 */
export function partitionFindingDetail(
  detail: Record<string, unknown> | null | undefined,
): PartitionedFindingDetail {
  const d = detail ?? {};
  const used = new Set<string>();
  const messages: PartitionedFindingDetail["messages"] = [];
  const lists: PartitionedFindingDetail["lists"] = [];
  const objects: PartitionedFindingDetail["objects"] = [];
  const scalars: PartitionedFindingDetail["scalars"] = [];

  for (const key of DETAIL_MESSAGE_KEYS) {
    const v = d[key];
    if (typeof v === "string" && v.trim()) {
      messages.push({ key, value: v.trim() });
      used.add(key);
    }
  }

  for (const [key, value] of Object.entries(d)) {
    if (used.has(key) || DETAIL_SKIP_KEYS.has(key)) continue;

    if (Array.isArray(value)) {
      lists.push({ key, items: value });
      used.add(key);
      continue;
    }

    if (value !== null && typeof value === "object") {
      objects.push({ key, value: value as Record<string, unknown> });
      used.add(key);
      continue;
    }

    // Skip empty strings already covered; still show other scalars
    if (typeof value === "string" && !value.trim()) {
      used.add(key);
      continue;
    }

    scalars.push({ key, value });
    used.add(key);
  }

  return { messages, lists, objects, scalars };
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
  | "domain_not_allowed"
  | "unreachable"
  | "blocked_by_target"
  | "timeout"
  | "internal_error"
  | "generic";

/** Officer-facing copy for scan-level failures (SentinelMark error state). */
export function scanFailureMessage(kind: ScanErrorKind): string {
  switch (kind) {
    case "unreachable":
      return "This site couldn't be reached. It may be down or the address may be incorrect.";
    case "blocked_by_target":
      return "This site blocked the scan. This can happen with sites that restrict automated requests.";
    case "timeout":
      return "This scan took too long and was stopped. You can try again.";
    case "internal_error":
      return "Something went wrong on our end. Please try again, and let us know if it keeps happening.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function isFormValidationError(kind: ScanErrorKind): boolean {
  return kind === "invalid_url" || kind === "domain_not_allowed";
}

export function classifyScanError(
  message: string,
  category?: string | null,
): ScanErrorKind {
  if (category === "invalid_url") return "invalid_url";
  if (category === "domain_not_allowed" || category === "not_allowed") {
    return "domain_not_allowed";
  }
  if (category === "unreachable") return "unreachable";
  if (category === "blocked_by_target") return "blocked_by_target";
  if (category === "timeout") return "timeout";
  if (category === "internal_error") return "internal_error";

  const m = message.toLowerCase();
  if (m.includes("timed out") || m.includes("timeout")) return "timeout";
  if (
    m.includes("not allowed") ||
    m.includes("restricted to") ||
    m.includes("only .go.ke")
  ) {
    return "domain_not_allowed";
  }
  if (m.includes("blocked")) return "blocked_by_target";
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
  if (m.includes("our end") || m.includes("unexpected")) return "internal_error";
  return "generic";
}

export function formValidationMessage(kind: ScanErrorKind): string {
  switch (kind) {
    case "domain_not_allowed":
      return "Only .go.ke and .gov.ke domains can be scanned.";
    case "invalid_url":
      return "Enter a full URL starting with https://, for example https://www.ict.go.ke";
    default:
      return "Please check the URL and try again.";
  }
}

export function errorTitle(kind: ScanErrorKind): string {
  switch (kind) {
    case "invalid_url":
      return "Invalid URL";
    case "domain_not_allowed":
      return "Domain not allowed";
    case "unreachable":
      return "Site unreachable";
    case "blocked_by_target":
      return "Scan blocked";
    case "timeout":
      return "Scan timed out";
    case "internal_error":
      return "Something went wrong";
    default:
      return "Something went wrong";
  }
}

export function errorHint(kind: ScanErrorKind): string {
  if (isFormValidationError(kind)) return formValidationMessage(kind);
  return scanFailureMessage(kind);
}
