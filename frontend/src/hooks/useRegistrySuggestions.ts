/**
 * Live registry-aware suggestions for the scan URL field.
 * Merges the static KNOWN_DOMAINS fallback with backend /registry/suggestions
 * results, keeping instant, offline-friendly matches on top.
 */

import { useEffect, useState } from "react";
import { getRegistrySuggestions, type RegistrySuggestion } from "@/lib/api";
import {
  isKnownDomainUrl,
  matchKnownDomains,
} from "@/lib/known-domains";

export interface ScanUrlSuggestion {
  name: string;
  url: string;
  source: "known" | "registry";
}

const MIN_QUERY_LEN = 2;
const DEBOUNCE_MS = 180;
const MAX_ITEMS = 6;

interface SuggestionsState {
  forQuery: string;
  items: ScanUrlSuggestion[];
}

function toSuggestion(
  name: string,
  url: string,
  source: ScanUrlSuggestion["source"],
): ScanUrlSuggestion {
  return { name, url, source };
}

export function useRegistrySuggestions(
  query: string,
  enabled: boolean,
): ScanUrlSuggestion[] {
  const [state, setState] = useState<SuggestionsState>({
    forQuery: "",
    items: [],
  });

  const q = query.trim();

  useEffect(() => {
    if (!enabled || q.length < MIN_QUERY_LEN || isKnownDomainUrl(q)) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const known = matchKnownDomains(q, 5).map((d) =>
        toSuggestion(d.name, d.url, "known"),
      );

      let live: RegistrySuggestion[] = [];
      try {
        live = await getRegistrySuggestions(q, 5);
      } catch {
        live = [];
      }

      if (cancelled) return;

      if (live.length === 0) {
        setState({ forQuery: q, items: known.slice(0, MAX_ITEMS) });
        return;
      }

      const seen = new Set(known.map((k) => k.url));
      const merged = [
        ...known,
        ...live
          .filter((r) => !seen.has(r.url))
          .map((r) => toSuggestion(r.name || r.org_name, r.url, "registry")),
      ].slice(0, MAX_ITEMS);

      setState({ forQuery: q, items: merged });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q, enabled]);

  if (!enabled || q.length < MIN_QUERY_LEN || isKnownDomainUrl(q)) return [];
  return state.forQuery === q ? state.items : [];
}
