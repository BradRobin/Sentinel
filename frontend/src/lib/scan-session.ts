/** Persist the active scan so navigating away (e.g. to Standards) can resume. */

const STORAGE_KEY = "sentinel.scan.activeJob";

export interface ActiveScanSession {
  jobId: string;
  url: string;
  savedAt: number;
}

export function saveActiveScan(jobId: string, url: string): void {
  if (typeof window === "undefined" || !jobId) return;
  const payload: ActiveScanSession = {
    jobId,
    url: url.trim(),
    savedAt: Date.now(),
  };
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

export function loadActiveScan(): ActiveScanSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveScanSession>;
    if (!parsed.jobId || typeof parsed.jobId !== "string") return null;
    return {
      jobId: parsed.jobId,
      url: typeof parsed.url === "string" ? parsed.url : "",
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0,
    };
  } catch {
    return null;
  }
}

export function clearActiveScan(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
