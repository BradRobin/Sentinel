const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

export async function createScan(url: string): Promise<ScanJobResponse> {
  const res = await fetch(`${API_URL}/api/v1/scans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Scan request failed: ${res.status}`);
  }
  return res.json();
}

export async function getScan(jobId: string): Promise<ScanStatusResponse> {
  const res = await fetch(`${API_URL}/api/v1/scans/${jobId}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Scan status failed: ${res.status}`);
  }
  return res.json();
}

export { API_URL };
