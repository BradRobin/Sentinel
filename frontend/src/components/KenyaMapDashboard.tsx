"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { useKenyaMapLayers } from "@/hooks/useKenyaMapLayers";
import { getRegistry, type RegistryEntry } from "@/lib/api";
import {
  COUNTY_NO_SCORE_FILL,
  COUNTY_STROKE,
  COUNTY_STROKE_HOVER,
  KENYA_COUNTIES_GEOJSON_PATH,
  KENYA_WATER_GEOJSON_PATH,
  MAP_ASIDE_TABS,
  SCORE_BAND_LEGEND,
  buildMcdaMarkers,
  enrichCountiesGeoJSON,
  filterRegistryByTab,
  orgTypeShortLabel,
  orgsHeadquarteredInCounty,
  parseMapAsideTab,
  rankedRegistryEntries,
  scoreBand,
  topIssueFromBreakdown,
  type CountyMapFeatureProps,
  type KenyaCountiesGeoJSON,
  type MapAsideTab,
  type McdaMapMarker,
} from "@/lib/kenya-map";
import { copyScanUrl } from "@/lib/scan-url-clipboard";
import { btnFilterActive, btnFilterIdle, btnSecondarySm, linkQuiet } from "@/lib/ui";

interface TooltipState {
  x: number;
  y: number;
  props: CountyMapFeatureProps;
}

type SelectedEntity =
  | { kind: "county"; props: CountyMapFeatureProps }
  | { kind: "org"; entry: RegistryEntry };

function featureProps(
  feature: GeoJSON.Feature,
): CountyMapFeatureProps | null {
  const props = feature.properties as Record<string, unknown> | null;
  if (!props) return null;
  const scoreRaw = props.score;
  const score =
    typeof scoreRaw === "number"
      ? scoreRaw
      : typeof scoreRaw === "string" && scoreRaw !== ""
        ? Number(scoreRaw)
        : null;
  return {
    shapeName: String(props.shapeName ?? "Unknown"),
    fillColor: String(props.fillColor ?? COUNTY_NO_SCORE_FILL),
    scoreBand: (props.scoreBand as CountyMapFeatureProps["scoreBand"]) ?? "none",
    score: score != null && Number.isFinite(score) ? score : null,
    orgName: props.orgName ? String(props.orgName) : null,
    url: props.url ? String(props.url) : null,
    topIssue: props.topIssue ? String(props.topIssue) : null,
    trend: props.trend ? String(props.trend) : null,
    matched: props.matched === true || props.matched === "true",
  };
}

function countyStyle(feature?: GeoJSON.Feature): L.PathOptions {
  return {
    fillColor: String(feature?.properties?.fillColor ?? COUNTY_NO_SCORE_FILL),
    fillOpacity: 0.92,
    color: COUNTY_STROKE,
    weight: 0.8,
    opacity: 0.55,
  };
}

function trendMark(trend: string | null): string {
  switch (trend) {
    case "up":
      return "↑ improving";
    case "down":
      return "↓ declining";
    case "flat":
      return "→ stable";
    default:
      return "";
  }
}

function trendClass(trend: string | null): string {
  switch (trend) {
    case "up":
      return "text-icta-green";
    case "down":
      return "text-icta-red";
    default:
      return "text-icta-gray-600";
  }
}

function entryFromMarker(
  marker: McdaMapMarker,
  registry: RegistryEntry[],
): RegistryEntry | null {
  return registry.find((e) => e.domain_id === marker.domainId) ?? null;
}

export function KenyaMapDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [registry, setRegistry] = useState<RegistryEntry[]>([]);
  const [geojson, setGeojson] = useState<KenyaCountiesGeoJSON | null>(null);
  const [waterGeojson, setWaterGeojson] = useState<GeoJSON.GeoJsonObject | null>(
    null,
  );
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [selected, setSelected] = useState<SelectedEntity | null>(null);
  const [focusCountyKey, setFocusCountyKey] = useState<string | null>(null);
  const [showMarkers, setShowMarkers] = useState(true);

  const tab = parseMapAsideTab(searchParams.get("tab"));

  const setTab = useCallback(
    (next: MapAsideTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "counties") params.delete("tab");
      else params.set("tab", next);
      const qs = params.toString();
      router.replace(qs ? `/map?${qs}` : "/map", { scroll: false });
    },
    [router, searchParams],
  );

  const counties = useMemo(
    () => registry.filter((e) => e.org_type === "county"),
    [registry],
  );

  const enriched = useMemo(() => {
    if (!geojson) return null;
    return enrichCountiesGeoJSON(geojson, counties);
  }, [geojson, counties]);

  const markers = useMemo(() => buildMcdaMarkers(registry), [registry]);

  const scoredCounties = useMemo(
    () => counties.filter((c) => c.latest_score != null).length,
    [counties],
  );

  const tabRows = useMemo(() => {
    const filtered = filterRegistryByTab(registry, tab);
    return rankedRegistryEntries(filtered);
  }, [registry, tab]);

  const relatedNational = useMemo(() => {
    if (!selected || selected.kind !== "county") return [];
    const label = selected.props.orgName || selected.props.shapeName;
    return rankedRegistryEntries(
      orgsHeadquarteredInCounty(registry, label),
    );
  }, [selected, registry]);

  useEffect(() => {
    startTransition(async () => {
      try {
        setError(null);
        const [reg, geoRes, waterRes] = await Promise.all([
          getRegistry({ limit: 300 }),
          fetch(KENYA_COUNTIES_GEOJSON_PATH, { cache: "force-cache" }),
          fetch(KENYA_WATER_GEOJSON_PATH, { cache: "no-store" }),
        ]);
        if (!geoRes.ok) {
          throw new Error(`County boundaries failed to load (${geoRes.status})`);
        }
        if (!waterRes.ok) {
          throw new Error(`Water bodies failed to load (${waterRes.status})`);
        }
        const geo = (await geoRes.json()) as KenyaCountiesGeoJSON & {
          crs?: unknown;
        };
        const water = (await waterRes.json()) as GeoJSON.GeoJsonObject & {
          crs?: unknown;
        };
        delete geo.crs;
        delete water.crs;
        setRegistry(reg.items);
        setGeojson(geo);
        setWaterGeojson(water);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load map data");
      }
    });
  }, []);

  const onEachCountyFeature = useCallback(
    (
      feature: GeoJSON.Feature,
      lyr: L.Layer,
      layerGroup: L.GeoJSON,
    ) => {
      lyr.on({
        mouseover: (e) => {
          const path = e.target as L.Path;
          path.setStyle({ weight: 2.2, color: COUNTY_STROKE_HOVER, opacity: 1 });
          if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            path.bringToFront();
          }
          const props = featureProps(feature);
          if (!props || !containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const oe = e.originalEvent as MouseEvent;
          setTooltip({
            x: oe.clientX - rect.left,
            y: oe.clientY - rect.top,
            props,
          });
        },
        mouseout: (e) => {
          layerGroup.resetStyle(e.target);
          setTooltip(null);
        },
        mousemove: (e) => {
          const props = featureProps(feature);
          if (!props || !containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const oe = e.originalEvent as MouseEvent;
          setTooltip({
            x: oe.clientX - rect.left,
            y: oe.clientY - rect.top,
            props,
          });
        },
        click: () => {
          const props = featureProps(feature);
          if (props) {
            setSelected({ kind: "county", props });
            setFocusCountyKey(props.shapeName);
          }
        },
      });
    },
    [],
  );

  useKenyaMapLayers({
    containerRef,
    enriched: enriched as GeoJSON.GeoJsonObject | null,
    waterGeojson,
    countyStyle,
    onEachCountyFeature,
    markers,
    showMarkers,
    focusCountyKey,
    onMarkerSelect: (marker) => {
      const entry = entryFromMarker(marker, registry);
      if (entry) setSelected({ kind: "org", entry });
    },
  });

  function selectCountyRow(row: RegistryEntry) {
    const band = scoreBand(row.latest_score);
    const issue = topIssueFromBreakdown(row.category_breakdown);
    const shapeName = row.registered_name || row.org_name;
    setSelected({
      kind: "county",
      props: {
        shapeName,
        fillColor: band.fill,
        scoreBand: band.band,
        score: row.latest_score,
        orgName: shapeName,
        url: row.url,
        topIssue: issue,
        trend: row.trend,
        matched: true,
      },
    });
    setFocusCountyKey(shapeName);
  }

  function selectOrgRow(row: RegistryEntry) {
    setSelected({ kind: "org", entry: row });
    if (row.hq_county) setFocusCountyKey(row.hq_county);
  }

  const nationalCount = useMemo(
    () =>
      registry.filter(
        (e) => e.org_type === "ministry" || e.org_type === "agency",
      ).length,
    [registry],
  );

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-12 sm:py-16">
        <Link href="/" className={`mb-8 inline-block ${linkQuiet}`}>
          ← Back
        </Link>

        <header className="mb-6">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-icta-gray-600">
            Showcase
          </p>
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-icta-black sm:text-3xl">
            Kenya compliance map
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-icta-gray-600">
            County websites are coloured on the map by ICTA score. Ministries
            and agencies appear as HQ markers and in the side panel — see the{" "}
            <Link
              href={
                tab === "ministries"
                  ? "/registry?org_type=ministry"
                  : tab === "agencies"
                    ? "/registry?org_type=agency"
                    : tab === "counties"
                      ? "/registry?org_type=county"
                      : "/registry"
              }
              className="text-icta-link hover:underline"
            >
              MCDA registry
            </Link>{" "}
            for the full table.
          </p>
        </header>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs tabular-nums text-icta-gray-600">
            {pending && !geojson
              ? "Loading MCDAs…"
              : `${counties.length} counties (${scoredCounties} scored) · ${nationalCount} national MCDAs`}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-icta-gray-600">
              <input
                type="checkbox"
                className="accent-icta-green"
                checked={showMarkers}
                onChange={(e) => setShowMarkers(e.target.checked)}
              />
              Show HQ markers
            </label>
            <ul className="flex flex-wrap gap-3" aria-label="Score legend">
              {SCORE_BAND_LEGEND.map((band) => (
                <li
                  key={band.band}
                  className="flex items-center gap-1.5 text-xs text-icta-gray-600"
                >
                  <span
                    className="inline-block size-3 rounded-sm border border-icta-gray-200"
                    style={{ backgroundColor: band.fill }}
                    aria-hidden
                  />
                  {band.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {error && (
          <div
            className="mb-4 rounded-md border border-icta-red/20 bg-icta-red/5 px-4 py-3 text-sm text-icta-red"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="relative overflow-hidden rounded-md border border-icta-gray-200">
            <div
              ref={containerRef}
              className="kenya-leaflet-map h-[28rem] w-full lg:h-[36rem]"
            />

            {tooltip && (
              <div
                className="kenya-map-glass-card pointer-events-none absolute z-[1000] max-w-[16rem] rounded-xl border border-white/20 px-3.5 py-2.5 text-xs"
                style={{
                  left: Math.min(
                    tooltip.x + 14,
                    (containerRef.current?.clientWidth ?? 320) - 180,
                  ),
                  top: Math.max(8, tooltip.y - 12),
                }}
                role="tooltip"
              >
                <p className="font-semibold text-icta-black">
                  {tooltip.props.orgName || tooltip.props.shapeName}
                </p>
                <p className="mt-1 tabular-nums text-icta-gray-600">
                  {tooltip.props.score != null
                    ? `Score ${tooltip.props.score.toFixed(1)}`
                    : "No score yet"}
                </p>
                <p className="mt-0.5 text-icta-gray-600">
                  {tooltip.props.topIssue
                    ? `Top gap: ${tooltip.props.topIssue}`
                    : "Top gap: —"}
                </p>
                {trendMark(tooltip.props.trend) && (
                  <p className={`mt-0.5 ${trendClass(tooltip.props.trend)}`}>
                    {trendMark(tooltip.props.trend)}
                  </p>
                )}
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-4">
            <section className="rounded-md border border-icta-gray-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-icta-black">
                {selected
                  ? selected.kind === "county"
                    ? "Selected county"
                    : "Selected organisation"
                  : "Select a county or organisation"}
              </h2>
              {selected?.kind === "county" ? (
                <div className="mt-2 space-y-2 text-sm">
                  <p className="font-medium text-icta-black">
                    {selected.props.orgName || selected.props.shapeName}
                  </p>
                  <p className="tabular-nums text-icta-gray-600">
                    {selected.props.score != null
                      ? `Score ${selected.props.score.toFixed(1)} · ${scoreBand(selected.props.score).label}`
                      : "Not scanned yet"}
                  </p>
                  <p className="text-xs text-icta-gray-600">
                    {selected.props.topIssue
                      ? `Weakest category: ${selected.props.topIssue}`
                      : "Weakest category: no breakdown yet"}
                  </p>
                  {trendMark(selected.props.trend) && (
                    <p
                      className={`text-xs font-medium ${trendClass(selected.props.trend)}`}
                    >
                      {trendMark(selected.props.trend)}
                    </p>
                  )}
                  {selected.props.url && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <a
                        href={selected.props.url}
                        target="_blank"
                        rel="noreferrer"
                        className={btnSecondarySm}
                      >
                        Open site
                      </a>
                      <Link
                        href="/scan"
                        className={btnSecondarySm}
                        onClick={() => {
                          if (selected.props.url) {
                            void copyScanUrl(selected.props.url);
                          }
                        }}
                      >
                        Scan
                      </Link>
                    </div>
                  )}
                  {relatedNational.length > 0 && (
                    <div className="border-t border-icta-gray-100 pt-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-icta-gray-600">
                        HQ&apos;d here ({relatedNational.length})
                      </p>
                      <ul className="mt-1 max-h-28 space-y-1 overflow-y-auto">
                        {relatedNational.slice(0, 8).map((row) => (
                          <li key={row.domain_id}>
                            <button
                              type="button"
                              className="w-full rounded px-1 py-0.5 text-left text-xs hover:bg-icta-gray-50"
                              onClick={() => selectOrgRow(row)}
                            >
                              <span className="font-medium text-icta-black">
                                {row.registered_name || row.org_name}
                              </span>
                              <span className="ml-1 text-icta-gray-600">
                                · {orgTypeShortLabel(row.org_type)}
                                {row.latest_score != null
                                  ? ` · ${row.latest_score.toFixed(0)}`
                                  : ""}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : selected?.kind === "org" ? (
                <div className="mt-2 space-y-2 text-sm">
                  <p className="font-medium text-icta-black">
                    {selected.entry.registered_name || selected.entry.org_name}
                  </p>
                  <p className="text-xs text-icta-gray-600">
                    {orgTypeShortLabel(selected.entry.org_type)}
                    {selected.entry.hq_county
                      ? ` · HQ ${selected.entry.hq_county}`
                      : ""}
                  </p>
                  <p className="tabular-nums text-icta-gray-600">
                    {selected.entry.latest_score != null
                      ? `Score ${selected.entry.latest_score.toFixed(1)} · ${scoreBand(selected.entry.latest_score).label}`
                      : "Not scanned yet"}
                  </p>
                  <p className="text-xs text-icta-gray-600">
                    {topIssueFromBreakdown(selected.entry.category_breakdown)
                      ? `Weakest category: ${topIssueFromBreakdown(selected.entry.category_breakdown)}`
                      : "Weakest category: no breakdown yet"}
                  </p>
                  {selected.entry.hq_county === "Nairobi" && (
                    <p className="text-[11px] leading-snug text-icta-gray-600">
                      Marker is an illustrative HQ pin near Nairobi CBD — not a
                      service-area boundary.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <a
                      href={selected.entry.url}
                      target="_blank"
                      rel="noreferrer"
                      className={btnSecondarySm}
                    >
                      Open site
                    </a>
                    <Link
                      href="/scan"
                      className={btnSecondarySm}
                      onClick={() => void copyScanUrl(selected.entry.url)}
                    >
                      Scan
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-icta-gray-600">
                  Hover or click a county polygon, an HQ marker, or a row in the
                  list below.
                </p>
              )}
            </section>

            <section className="min-h-0 flex-1 rounded-md border border-icta-gray-200 px-4 py-3">
              <div
                className="mb-2 flex flex-wrap gap-1.5"
                role="tablist"
                aria-label="MCDA list filter"
              >
                {MAP_ASIDE_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    className={tab === t.id ? btnFilterActive : btnFilterIdle}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <h2 className="mb-2 text-sm font-semibold text-icta-black">
                {tab === "counties"
                  ? "Scored counties"
                  : tab === "national"
                    ? "National MCDAs"
                    : `Scored ${tab}`}
              </h2>

              {tabRows.length === 0 ? (
                <p className="text-xs text-icta-gray-600">
                  No scores in this view yet. Run{" "}
                  <Link
                    href="/registry"
                    className="text-icta-link hover:underline"
                  >
                    Scan all MCDAs
                  </Link>{" "}
                  from the registry.
                </p>
              ) : (
                <ul className="max-h-[22rem] space-y-2 overflow-y-auto text-sm">
                  {tabRows.map((row) => {
                    const issue = topIssueFromBreakdown(row.category_breakdown);
                    return (
                      <li key={row.domain_id}>
                        <button
                          type="button"
                          className="w-full rounded-md px-2 py-1.5 text-left hover:bg-icta-gray-50"
                          onClick={() =>
                            row.org_type === "county"
                              ? selectCountyRow(row)
                              : selectOrgRow(row)
                          }
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-medium text-icta-black">
                              {row.registered_name || row.org_name}
                            </span>
                            <span className="tabular-nums text-icta-gray-600">
                              {row.latest_score?.toFixed(1)}
                            </span>
                          </span>
                          <span className="mt-0.5 block text-xs text-icta-gray-600">
                            {orgTypeShortLabel(row.org_type)}
                            {row.hq_county ? ` · HQ ${row.hq_county}` : ""}
                            {issue ? ` · ${issue}` : ""}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <p className="text-[10px] leading-relaxed text-icta-gray-600">
              Boundaries: geoBoundaries Kenya ADM1. Water: Natural Earth.
              National HQ pins are curated approximations (Nairobi CBD with
              jitter unless overridden). Scores: Sentinel MCDA registry.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}
