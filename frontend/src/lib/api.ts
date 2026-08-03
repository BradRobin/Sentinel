const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

/** Fallback timeout for every request; overridable per call via `timeoutMs`. */
const DEFAULT_TIMEOUT_MS = 15_000;

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

/**
 * Unified API error. `errorCategory` is a closed classification set
 * (see `classifyScanError` in lib/findings.ts) so callers can map a failure
 * to UI copy without parsing raw messages. `status` and `url` carry request
 * context for diagnostics; raw exceptions/tracebacks never reach callers.
 */
export class ScanApiError extends Error {
  errorCategory: string | null;
  status: number | null;
  url?: string;

  constructor(
    message: string,
    errorCategory: string | null = null,
    details: { status?: number; url?: string } = {},
  ) {
    super(message);
    this.name = "ScanApiError";
    this.errorCategory = errorCategory;
    this.status = details.status ?? null;
    this.url = details.url;
  }
}

type ApiRequestInit = RequestInit & { timeoutMs?: number };

/**
 * Single fetch wrapper for the Sentinel API.
 * - Aborts after `timeoutMs` (default 15s) and maps it to ScanApiError("timeout").
 * - Maps network failures to ScanApiError("unreachable").
 * - Parses FastAPI error bodies into ScanApiError with a closed error set.
 * - Defaults to `cache: "no-store"` (freshness matters for a live dashboard).
 */
async function request<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchInit } = init;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(fetchInit.headers);
  if (fetchInit.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...fetchInit,
      headers,
      signal: controller.signal,
      cache: fetchInit.cache ?? "no-store",
    });
  } catch {
    if (controller.signal.aborted) {
      throw new ScanApiError(
        `Request timed out after ${Math.round(timeoutMs / 1000)}s.`,
        "timeout",
        { url: `${API_URL}${path}` },
      );
    }
    throw new ScanApiError(
      "Failed to reach the Sentinel API. Check that Docker is running.",
      "unreachable",
      { url: `${API_URL}${path}` },
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const { message, category } = parseScanErrorBody(body);
    throw new ScanApiError(message, category, {
      status: res.status,
      url: `${API_URL}${path}`,
    });
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
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

export type ManualReviewCheckType = "site_inspection" | "institutional_attestation";
export type ManualReviewResolvedStatus = "pass" | "fail" | "flagged";

export interface ManualReviewQueueItem {
  id: string;
  domain_id: string;
  domain_url: string;
  check_name: string;
  category: string;
  check_type: ManualReviewCheckType;
  clause_reference: string;
  question_title: string;
  pending_since: string | null;
  source_scan_id: string | null;
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

export type ComparisonPeriod =
  | "week"
  | "biweek"
  | "month"
  | "quarter"
  | "year";

export const COMPARISON_PERIOD_OPTIONS: Array<{
  value: ComparisonPeriod;
  label: string;
}> = [
  { value: "week", label: "1 week ago" },
  { value: "biweek", label: "2 weeks ago" },
  { value: "month", label: "1 month ago" },
  { value: "quarter", label: "1 quarter ago" },
  { value: "year", label: "1 year ago" },
];

export interface ScoreSnapshot {
  date: string;
  overall_score: number;
  category_breakdown: Record<string, number>;
  quarter?: string | null;
}

/** @deprecated Prefer ScoreSnapshot */
export type QuarterScoreSnapshot = ScoreSnapshot;

export interface ComparisonResponse {
  has_history: boolean;
  requested_period?: string | null;
  period_label?: string | null;
  available_periods?: string[];
  current?: ScoreSnapshot | null;
  compared_to?: ScoreSnapshot | null;
  /** Alias of compared_to for older payloads */
  previous?: ScoreSnapshot | null;
  delta?: {
    overall: number;
    category_breakdown: Record<string, number>;
  } | null;
}

export interface ComparisonAvailability {
  available_periods: string[];
  current_date: string | null;
  period_labels: Record<string, string>;
}

export function fetchBackendHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

export function createScan(
  url: string,
  options?: { force?: boolean },
): Promise<ScanJobResponse> {
  return request<ScanJobResponse>("/api/v1/scans", {
    method: "POST",
    body: JSON.stringify({ url, force: options?.force ?? false }),
  });
}

export function getScan(jobId: string): Promise<ScanStatusResponse> {
  return request<ScanStatusResponse>(`/api/v1/scans/${jobId}`);
}

export function getScanComparison(
  jobId: string,
  period: ComparisonPeriod = "quarter",
): Promise<ComparisonResponse> {
  const params = new URLSearchParams({ period });
  return request<ComparisonResponse>(
    `/api/v1/scans/${jobId}/comparison?${params}`,
  );
}

export function getScanComparisonAvailability(
  jobId: string,
): Promise<ComparisonAvailability> {
  return request<ComparisonAvailability>(
    `/api/v1/scans/${jobId}/comparison/availability`,
  );
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
  category_breakdown?: Record<string, number>;
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

export interface RegistryScanEnqueueResponse {
  batch_id: string;
  domain_count: number;
  queued: number;
  attached_in_flight: number;
  skipped_lock: number;
  concurrency: number;
  triggered_type: "manual" | "scheduled";
  jobs: Array<{
    job_id: string;
    url: string;
    domain_id: string;
    action: "queued" | "attached";
  }>;
  resumed: boolean;
}

export interface RegistryScanBatchStatus {
  batch_id: string;
  triggered_type: "manual" | "scheduled" | null;
  domain_count: number;
  done: boolean;
  counts: {
    queued: number;
    running: number;
    complete: number;
    failed: number;
    unknown: number;
  };
  jobs: Array<{
    job_id: string;
    url: string | null;
    domain_id: string | null;
    action: string | null;
    status: "queued" | "running" | "complete" | "failed" | "unknown";
    progress: string | null;
    error: string | null;
  }>;
}

export function getRegistry(options?: {
  orgType?: string;
  q?: string;
  limit?: number;
}): Promise<RegistryListResponse> {
  const params = new URLSearchParams();
  if (options?.orgType) params.set("org_type", options.orgType);
  if (options?.q) params.set("q", options.q);
  if (options?.limit) params.set("limit", String(options.limit));
  const qs = params.toString();
  return request<RegistryListResponse>(
    `/api/v1/registry${qs ? `?${qs}` : ""}`,
  );
}

export function startRegistryScan(): Promise<RegistryScanEnqueueResponse> {
  return request<RegistryScanEnqueueResponse>("/api/v1/registry/scan", {
    method: "POST",
  });
}

export function getRegistryScanBatch(
  batchId: string,
): Promise<RegistryScanBatchStatus> {
  return request<RegistryScanBatchStatus>(`/api/v1/registry/scan/${batchId}`);
}

export async function getRegistrySuggestions(
  q: string,
  limit = 5,
): Promise<RegistrySuggestion[]> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  const body = await request<{ items: RegistrySuggestion[] }>(
    `/api/v1/registry/suggestions?${params}`,
  );
  return body.items ?? [];
}

export function getManualReviewQueueItems(args: {
  officerId: string;
  check_type?: ManualReviewCheckType | "";
  category?: string | "";
  domain_id?: string | "";
  domain_query?: string;
  limit?: number;
}): Promise<ManualReviewQueueItem[]> {
  const {
    officerId,
    limit = 200,
    check_type,
    category,
    domain_id,
    domain_query,
  } = args;
  const params = new URLSearchParams();
  if (check_type) params.set("check_type", String(check_type));
  if (category) params.set("category", String(category));
  if (domain_id) params.set("domain_id", String(domain_id));
  if (domain_query?.trim()) params.set("domain_query", domain_query.trim());
  params.set("limit", String(limit));

  return request<ManualReviewQueueItem[]>(
    `/api/v1/manual-review/items?${params}`,
    { headers: { "x-officer-id": officerId } },
  );
}

export function resolveManualReviewItem(args: {
  officerId: string;
  itemId: string;
  current_status: ManualReviewResolvedStatus;
  justification: string;
}): Promise<{ ok: boolean; item_id: string }> {
  return request<{ ok: boolean; item_id: string }>(
    `/api/v1/manual-review/items/${encodeURIComponent(args.itemId)}/resolve`,
    {
      method: "POST",
      headers: { "x-officer-id": args.officerId },
      body: JSON.stringify({
        current_status: args.current_status,
        justification: args.justification,
      }),
    },
  );
}

export { API_URL };
