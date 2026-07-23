const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

function formatApiDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
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

export interface ScanStatusResponse {
  job_id: string;
  status: string;
  url: string | null;
  result: { findings?: Finding[]; finding_count?: number } | null;
  error: string | null;
  cache_hit?: boolean;
  progress?: string | null;
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
    throw new Error(
      `Failed to reach Sentinel API at ${API_URL}. Check docker compose is up and CORS allows this page origin (localhost and 127.0.0.1).`,
    );
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = formatApiDetail((body as { detail?: unknown }).detail);
    throw new Error(
      `${detail} (POST ${API_URL}/api/v1/scans — is the Sentinel API running on port 8001?)`,
    );
  }
  return res.json();
}

export async function getScan(jobId: string): Promise<ScanStatusResponse> {
  const res = await fetch(`${API_URL}/api/v1/scans/${jobId}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = formatApiDetail((body as { detail?: unknown }).detail);
    throw new Error(`${detail} (GET ${API_URL}/api/v1/scans/${jobId})`);
  }
  return res.json();
}

export { API_URL };
