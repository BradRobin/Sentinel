import type { RegistryEntry } from "@/lib/api";
import { labelCategory } from "@/lib/findings";

/** Public path to geoBoundaries Kenya ADM1 (simplified). */
export const KENYA_COUNTIES_GEOJSON_PATH = "/geo/kenya-counties.geojson";

/** Lakes and ocean polygons for the Kenya map basemap. */
export const KENYA_WATER_GEOJSON_PATH = "/geo/kenya-water.geojson";

/** Leaflet style for water bodies (lakes + ocean). */
export const KENYA_WATER_FILL = "#2b7bc9";
export const KENYA_WATER_STROKE = "#1a5f96";

/** County fills/strokes — keep in sync with the ICTA theme tokens. */
export const COUNTY_NO_SCORE_FILL = "#e5e7eb"; // --icta-gray-200
export const COUNTY_STROKE = "#111111";
export const COUNTY_STROKE_HOVER = "#000000"; // --icta-black

export function kenyaWaterStyle(): {
  fillColor: string;
  fillOpacity: number;
  color: string;
  weight: number;
  opacity: number;
} {
  return {
    fillColor: KENYA_WATER_FILL,
    fillOpacity: 0.88,
    color: KENYA_WATER_STROKE,
    weight: 0.6,
    opacity: 0.7,
  };
}

export type ScoreBand = "strong" | "moderate" | "weak" | "none";

export interface ScoreBandMeta {
  band: ScoreBand;
  label: string;
  /** Hex fill for MapLibre (flag-aligned + amber for mid band). */
  fill: string;
}

const BANDS: Record<ScoreBand, Omit<ScoreBandMeta, "band">> = {
  strong: { label: "75–100", fill: "#006600" },
  moderate: { label: "50–74", fill: "#b45309" },
  weak: { label: "Below 50", fill: "#bb0000" },
  none: { label: "No scan yet", fill: "#e5e7eb" },
};

export function scoreBand(score: number | null | undefined): ScoreBandMeta {
  if (score == null || !Number.isFinite(score)) {
    return { band: "none", ...BANDS.none };
  }
  if (score >= 75) return { band: "strong", ...BANDS.strong };
  if (score >= 50) return { band: "moderate", ...BANDS.moderate };
  return { band: "weak", ...BANDS.weak };
}

/** Left-border classes mirroring findings severity treatment (no row fill). */
export function scoreBandRowBorderClass(
  score: number | null | undefined,
): string {
  switch (scoreBand(score).band) {
    case "strong":
      return "border-l-4 border-l-icta-green";
    case "moderate":
      return "border-l-[3px] border-l-icta-amber";
    case "weak":
      return "border-l-4 border-l-icta-red";
    default:
      return "border-l-2 border-l-transparent";
  }
}

export const SCORE_BAND_LEGEND: ScoreBandMeta[] = [
  { band: "strong", ...BANDS.strong },
  { band: "moderate", ...BANDS.moderate },
  { band: "weak", ...BANDS.weak },
  { band: "none", ...BANDS.none },
];

/** Normalize county names for GeoJSON ↔ registry matching. */
export function normalizeCountyKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`]/g, "")
    .replace(/city\s+county\b/g, "county")
    .replace(/\bcounty\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Explicit GeoJSON shapeName → registry aliases when spellings diverge. */
const SHAPE_ALIASES: Record<string, string[]> = {
  tharaka: ["tharaka", "tharaka nithi", "tharaka-nithi"],
  "taita taveta": ["taita taveta", "taita-taveta"],
  "elgeyo-marakwet": ["elgeyo marakwet", "elgeyo-marakwet"],
  muranga: ["muranga", "murang a"],
};

export function registryMatchKeys(entry: RegistryEntry): string[] {
  const keys = new Set<string>();
  const add = (raw: string | null | undefined) => {
    if (!raw) return;
    keys.add(normalizeCountyKey(raw));
  };
  add(entry.org_name);
  add(entry.registered_name);
  for (const alias of entry.aliases ?? []) add(alias);
  return [...keys].filter(Boolean);
}

export function indexCountiesByName(
  entries: RegistryEntry[],
): Map<string, RegistryEntry> {
  const map = new Map<string, RegistryEntry>();
  for (const entry of entries) {
    if (entry.org_type !== "county") continue;
    for (const key of registryMatchKeys(entry)) {
      if (!map.has(key)) map.set(key, entry);
    }
  }
  return map;
}

export function findCountyEntry(
  shapeName: string,
  byName: Map<string, RegistryEntry>,
): RegistryEntry | null {
  const key = normalizeCountyKey(shapeName);
  const direct = byName.get(key);
  if (direct) return direct;

  for (const alias of SHAPE_ALIASES[key] ?? []) {
    const hit = byName.get(normalizeCountyKey(alias));
    if (hit) return hit;
  }

  for (const [k, entry] of byName) {
    if (k === key) return entry;
    // Prefer prefix / containment only for reasonably specific names
    if (key.length >= 4 && k.length >= 4 && (k.startsWith(key) || key.startsWith(k))) {
      return entry;
    }
  }
  return null;
}

/** Weakest scored category — stand-in for “top issue” without per-check history. */
export function topIssueFromBreakdown(
  breakdown: Record<string, number> | null | undefined,
): string | null {
  if (!breakdown) return null;
  let worstKey: string | null = null;
  let worstScore = Number.POSITIVE_INFINITY;
  for (const [key, value] of Object.entries(breakdown)) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    if (value < worstScore) {
      worstScore = value;
      worstKey = key;
    }
  }
  if (!worstKey) return null;
  return `${labelCategory(worstKey)} (${worstScore.toFixed(0)}%)`;
}

export interface CountyMapFeatureProps {
  shapeName: string;
  fillColor: string;
  scoreBand: ScoreBand;
  score: number | null;
  orgName: string | null;
  url: string | null;
  topIssue: string | null;
  trend: string | null;
  matched: boolean;
}

export interface KenyaCountiesGeoJSON {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: unknown;
    properties: Record<string, unknown> | null;
  }>;
}

export function enrichCountiesGeoJSON(
  geojson: KenyaCountiesGeoJSON,
  counties: RegistryEntry[],
): KenyaCountiesGeoJSON {
  const byName = indexCountiesByName(counties);
  return {
    ...geojson,
    features: geojson.features.map((feature) => {
      const shapeName = String(feature.properties?.shapeName ?? "Unknown");
      const entry = findCountyEntry(shapeName, byName);
      const score = entry?.latest_score ?? null;
      const band = scoreBand(score);
      const props: CountyMapFeatureProps = {
        shapeName,
        fillColor: band.fill,
        scoreBand: band.band,
        score,
        orgName: entry?.registered_name || entry?.org_name || null,
        url: entry?.url ?? null,
        topIssue: topIssueFromBreakdown(entry?.category_breakdown),
        trend: entry?.trend ?? null,
        matched: Boolean(entry),
      };
      return {
        ...feature,
        properties: {
          ...feature.properties,
          ...props,
        },
      };
    }),
  };
}

export type MapAsideTab = "counties" | "ministries" | "agencies" | "national";

export const MAP_ASIDE_TABS: Array<{ id: MapAsideTab; label: string }> = [
  { id: "counties", label: "Counties" },
  { id: "ministries", label: "Ministries" },
  { id: "agencies", label: "Agencies" },
  { id: "national", label: "National" },
];

export function parseMapAsideTab(raw: string | null | undefined): MapAsideTab {
  if (raw === "ministries" || raw === "agencies" || raw === "national") {
    return raw;
  }
  return "counties";
}

export function rankedRegistryEntries(entries: RegistryEntry[]): RegistryEntry[] {
  return [...entries]
    .filter((e) => e.latest_score != null)
    .sort((a, b) => (b.latest_score ?? 0) - (a.latest_score ?? 0));
}

export function filterRegistryByTab(
  entries: RegistryEntry[],
  tab: MapAsideTab,
): RegistryEntry[] {
  switch (tab) {
    case "counties":
      return entries.filter((e) => e.org_type === "county");
    case "ministries":
      return entries.filter((e) => e.org_type === "ministry");
    case "agencies":
      return entries.filter((e) => e.org_type === "agency");
    case "national":
      return entries.filter(
        (e) => e.org_type === "ministry" || e.org_type === "agency",
      );
  }
}

/** National MCDAs whose hq_county matches an ADM1 / registry county name. */
export function orgsHeadquarteredInCounty(
  entries: RegistryEntry[],
  countyLabel: string,
): RegistryEntry[] {
  const key = normalizeCountyKey(countyLabel);
  if (!key) return [];
  return entries.filter((e) => {
    if (e.org_type === "county") return false;
    if (!e.hq_county) return false;
    return normalizeCountyKey(e.hq_county) === key;
  });
}

export interface McdaMapMarker {
  domainId: string;
  orgName: string;
  orgType: "ministry" | "agency";
  url: string;
  hqCounty: string | null;
  latitude: number;
  longitude: number;
  score: number | null;
  fill: string;
  topIssue: string | null;
  trend: string | null;
}

export function buildMcdaMarkers(entries: RegistryEntry[]): McdaMapMarker[] {
  const out: McdaMapMarker[] = [];
  for (const e of entries) {
    if (e.org_type !== "ministry" && e.org_type !== "agency") continue;
    if (e.latitude == null || e.longitude == null) continue;
    if (!Number.isFinite(e.latitude) || !Number.isFinite(e.longitude)) continue;
    const band = scoreBand(e.latest_score);
    out.push({
      domainId: e.domain_id,
      orgName: e.registered_name || e.org_name,
      orgType: e.org_type,
      url: e.url,
      hqCounty: e.hq_county ?? null,
      latitude: e.latitude,
      longitude: e.longitude,
      score: e.latest_score,
      fill: band.fill,
      topIssue: topIssueFromBreakdown(e.category_breakdown),
      trend: e.trend,
    });
  }
  return out;
}

export function orgTypeShortLabel(type: string): string {
  switch (type) {
    case "ministry":
      return "Ministry";
    case "agency":
      return "Agency";
    case "county":
      return "County";
    default:
      return type;
  }
}
