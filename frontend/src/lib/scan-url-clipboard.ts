/**
 * Cross-page handoff: copy a URL on the MCDA registry, paste it on /scan.
 * sessionStorage is the source of truth so Paste works after in-app navigation
 * even when the Clipboard API is blocked; we still write the system clipboard.
 */

const STORAGE_KEY = "sentinel:copied-scan-url";

export async function copyScanUrl(url: string): Promise<void> {
  const trimmed = url.trim();
  if (!trimmed) return;

  if (typeof window !== "undefined") {
    sessionStorage.setItem(STORAGE_KEY, trimmed);
    window.dispatchEvent(
      new CustomEvent("sentinel:scan-url-copied", { detail: trimmed }),
    );
  }

  try {
    await navigator.clipboard.writeText(trimmed);
  } catch {
    // sessionStorage still enables the in-app Paste button
  }
}

export function getCopiedScanUrl(): string | null {
  if (typeof window === "undefined") return null;
  const value = sessionStorage.getItem(STORAGE_KEY)?.trim();
  return value || null;
}
