const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface HealthResponse {
  status: string;
  version: string;
  redis: string;
  db: string;
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

export { API_URL };
