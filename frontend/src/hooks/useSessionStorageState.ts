"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_SYNC_EVENT = "sentinel:session-storage-change";

function subscribe(callback: () => void) {
  window.addEventListener(STORAGE_SYNC_EVENT, callback);
  return () => window.removeEventListener(STORAGE_SYNC_EVENT, callback);
}

function readValue(key: string, fallback: string | null): string | null {
  try {
    return window.sessionStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * A sessionStorage-backed state pair.
 *
 * Reads are hydration-safe (server renders `fallback`), writes persist the
 * key and notify every subscriber. Pass `null` as the next value to remove
 * the key.
 */
export function useSessionStorageState(
  key: string,
  fallback: string,
): [string, (next: string | null) => void];
export function useSessionStorageState(
  key: string,
  fallback: string | null,
): [string | null, (next: string | null) => void];
export function useSessionStorageState(
  key: string,
  fallback: string | null,
): [string | null, (next: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => readValue(key, fallback),
    () => fallback,
  );

  const setValue = useCallback(
    (next: string | null) => {
      try {
        if (next === null) window.sessionStorage.removeItem(key);
        else window.sessionStorage.setItem(key, next);
      } catch {
        // ignore storage errors
      }
      window.dispatchEvent(new Event(STORAGE_SYNC_EVENT));
    },
    [key],
  );

  return [value, setValue];
}
