const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

function formatApiDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (
    typeof detail === "object" &&
    detail &&
    "message" in detail &&
    typeof (detail as { message: unknown }).message === "string"
  ) {
    return (detail as { message: string }).message;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        typeof item === "object" && item && "msg" in item
          ? String((item as { msg: string }).msg)
          : String(item),
      )
      .join("; ");
  }
  return "Request failed";
}

function extractErrorCategory(detail: unknown): string | null {
  if (
    typeof detail === "object" &&
    detail &&
    "error_category" in detail &&
    typeof (detail as { error_category: unknown }).error_category === "string"
  ) {
    return (detail as { error_category: string }).error_category;
  }
  return null;
}

function parseScanErrorBody(body: unknown): {
  message: string;
  category: string | null;
} {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  // Prefer FastAPI `detail` object; also accept top-level category/message.
  const detail = "detail" in record ? record.detail : body;
  const category =
    extractErrorCategory(detail) ??
    (typeof record.error_category === "string" ? record.error_category : null);
  const message =
    formatApiDetail(detail) ||
    (typeof record.message === "string" ? record.message : "Request failed");
  return { message, category };
}

export class ScanApiError extends Error {
  errorCategory: string | null;
  constructor(message: string, errorCategory: string | null = null) {
    super(message);
    this.name = "ScanApiError";
    this.errorCategory = errorCategory;
  }
}

export interface HealthResponse {
  status: string;
  version: string;
  redis: string;
  db: string;
}

export interface ScanJobResponse {
  job_id: string;
  status: string;
  url: string;
  cache_hit?: boolean;
  progress?: string | null;
  current_category?: string | null;
  categories_completed?: string[];
  total_categories?: number;
  attached_to_existing?: boolean;
}

export interface Finding {
  category: string;
  check_name: string;
  clause_reference: string;
  status: string;
  severity: string;
  automatability_type: string;
  detail: Record<string, unknown>;
}

export interface CategoryScore {
  category: string;
  weight?: number;
  score: number;
  pass_count?: number;
  fail_count?: number;
  manual_review_count?: number;
  scorable_count?: number;
}

export interface ScoresPayload {
  overall_score: number | null;
  weights_source?: string;
  categories: CategoryScore[];
}

export interface ScanStatusResponse {
  job_id: string;
  status: string;
  url: string | null;
  result: {
    findings?: Finding[];
    finding_count?: number;
    scores?: ScoresPayload;
    overall_score?: number | null;
    narrative?: string | null;
    /** True while categories are still running; false/absent when fully scored. */
    partial?: boolean;
  } | null;
  error: string | null;
  cache_hit?: boolean;
  progress?: string | null;
  current_category?: string | null;
  categories_completed?: string[];
  total_categories?: number;
  updated_at?: string | null;
  error_category?: string | null;
  attached_to_existing?: boolean;
}

export interface QuarterScoreSnapshot {
  quarter: string;
  overall_score: number;
  category_breakdown: Record<string, number>;
}

export interface ComparisonResponse {
  has_history: boolean;
  current?: QuarterScoreSnapshot | null;
  previous?: QuarterScoreSnapshot | null;
  delta?: {
    overall: number;
    category_breakdown: Record<string, number>;
  } | null;
}

export async function fetchBackendHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/health`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Backend health check failed: ${res.status}`);
  }
  return res.json();
}

export async function createScan(
  url: string,
  options?: { force?: boolean },
): Promise<ScanJobResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/scans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, force: options?.force ?? false }),
    });
  } catch {
    throw new ScanApiError(
      "Failed to reach the Sentinel API. Check that Docker is running.",
      "unreachable",
    );
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const { message, category } = parseScanErrorBody(body);
    throw new ScanApiError(message, category);
  }
  return res.json();
}

export async function getScan(jobId: string): Promise<ScanStatusResponse> {
  const res = await fetch(`${API_URL}/api/v1/scans/${jobId}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const { message, category } = parseScanErrorBody(body);
    throw new ScanApiError(message, category);
  }
  return res.json();
}

export async function getScanComparison(
  jobId: string,
): Promise<ComparisonResponse> {
  const res = await fetch(`${API_URL}/api/v1/scans/${jobId}/comparison`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = formatApiDetail((body as { detail?: unknown }).detail);
    throw new Error(
      `${detail} (GET ${API_URL}/api/v1/scans/${jobId}/comparison)`,
    );
  }
  return res.json();
}

export type RegistryTrend = "up" | "down" | "flat" | "unknown";

export interface RegistryEntry {
  domain_id: string;
  org_id: string;
  org_name: string;
  org_type: "ministry" | "county" | "agency";
  sector: string | null;
  url: string;
  registered_name: string | null;
  aliases: string[];
  latest_score: number | null;
  previous_score: number | null;
  last_checked_at: string | null;
  last_source: string | null;
  trend: RegistryTrend;
  score_delta: number | null;
}

export interface RegistryListResponse {
  count: number;
  items: RegistryEntry[];
}

export interface RegistrySuggestion {
  name: string;
  org_name: string;
  url: string;
  aliases: string[];
}

export async function getRegistry(options?: {
  orgType?: string;
  q?: string;
  limit?: number;
}): Promise<RegistryListResponse> {
  const params = new URLSearchParams();
  if (options?.orgType) params.set("org_type", options.orgType);
  if (options?.q) params.set("q", options.q);
  if (options?.limit) params.set("limit", String(options.limit));
  const qs = params.toString();
  const res = await fetch(
    `${API_URL}/api/v1/registry${qs ? `?${qs}` : ""}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`Registry list failed: ${res.status}`);
  }
  return res.json();
}

export async function getRegistrySuggestions(
  q: string,
  limit = 5,
): Promise<RegistrySuggestion[]> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  const res = await fetch(
    `${API_URL}/api/v1/registry/suggestions?${params}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`Registry suggestions failed: ${res.status}`);
  }
  const body = (await res.json()) as { items: RegistrySuggestion[] };
  return body.items ?? [];
}

export { API_URL };
