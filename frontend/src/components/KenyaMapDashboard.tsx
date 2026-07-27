"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { getRegistry, type RegistryEntry } from "@/lib/api";
import {
  KENYA_COUNTIES_GEOJSON_PATH,
  KENYA_WATER_GEOJSON_PATH,
  SCORE_BAND_LEGEND,
  enrichCountiesGeoJSON,
  kenyaWaterStyle,
  scoreBand,
  topIssueFromBreakdown,
  type CountyMapFeatureProps,
  type KenyaCountiesGeoJSON,
} from "@/lib/kenya-map";
import { copyScanUrl } from "@/lib/scan-url-clipboard";
import { btnSecondarySm, linkQuiet } from "@/lib/ui";

interface TooltipState {
  x: number;
  y: number;
  props: CountyMapFeatureProps;
}

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
    fillColor: String(props.fillColor ?? "#e5e7eb"),
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
    fillColor: String(feature?.properties?.fillColor ?? "#e5e7eb"),
    fillOpacity: 0.92,
    color: "#111111",
    weight: 0.8,
    opacity: 0.55,
  };
}

function splitWaterFeatures(water: GeoJSON.GeoJsonObject): {
  lakes: GeoJSON.Feature[];
  ocean: GeoJSON.Feature[];
} {
  const features =
    water.type === "FeatureCollection"
      ? (water as GeoJSON.FeatureCollection).features
      : [];
  const lakes: GeoJSON.Feature[] = [];
  const ocean: GeoJSON.Feature[] = [];
  for (const feature of features) {
    const kind = (feature.properties as { kind?: string } | null)?.kind;
    if (kind === "ocean") ocean.push(feature);
    else lakes.push(feature);
  }
  return { lakes, ocean };
}

function orderWaterLayers(
  oceanLayer: L.GeoJSON | null,
  lakeLayer: L.GeoJSON | null,
) {
  oceanLayer?.bringToBack();
  lakeLayer?.bringToFront();
}

/** Fixed panes so county hover (bringToFront) cannot cover lakes. */
function ensureKenyaMapPanes(map: L.Map) {
  const panes: Array<[string, string]> = [
    ["kenya-ocean", "350"],
    ["kenya-counties", "400"],
    ["kenya-lakes", "450"],
  ];
  for (const [name, zIndex] of panes) {
    if (!map.getPane(name)) map.createPane(name);
    const pane = map.getPane(name);
    if (pane) pane.style.zIndex = zIndex;
  }
}

export function KenyaMapDashboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);
  const oceanLayerRef = useRef<L.GeoJSON | null>(null);
  const lakeLayerRef = useRef<L.GeoJSON | null>(null);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [counties, setCounties] = useState<RegistryEntry[]>([]);
  const [geojson, setGeojson] = useState<KenyaCountiesGeoJSON | null>(null);
  const [waterGeojson, setWaterGeojson] = useState<GeoJSON.GeoJsonObject | null>(
    null,
  );
  const [mapReady, setMapReady] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [selected, setSelected] = useState<CountyMapFeatureProps | null>(null);

  const enriched = useMemo(() => {
    if (!geojson) return null;
    return enrichCountiesGeoJSON(geojson, counties);
  }, [geojson, counties]);

  const scoredCount = useMemo(
    () => counties.filter((c) => c.latest_score != null).length,
    [counties],
  );

  const ranked = useMemo(() => {
    return [...counties]
      .filter((c) => c.latest_score != null)
      .sort((a, b) => (b.latest_score ?? 0) - (a.latest_score ?? 0));
  }, [counties]);

  useEffect(() => {
    startTransition(async () => {
      try {
        setError(null);
        const [registry, geoRes, waterRes] = await Promise.all([
          getRegistry({ orgType: "county", limit: 100 }),
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
        setCounties(registry.items);
        setGeojson(geo);
        setWaterGeojson(water);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load map data");
      }
    });
  }, []);

  // Create map once (re-created cleanly under React Strict Mode)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const map = L.map(el, {
      zoomControl: true,
      attributionControl: true,
      minZoom: 5,
      maxZoom: 10,
    });
    map.setView([0.35, 37.9], 6);
    map.attributionControl.setPrefix("");
    map.attributionControl.addAttribution(
      '<a href="https://www.geoboundaries.org/" target="_blank" rel="noreferrer">geoBoundaries</a>',
    );
    ensureKenyaMapPanes(map);
    mapRef.current = map;
    setMapReady(true);

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      ro.disconnect();
      setMapReady(false);
      layerRef.current = null;
      oceanLayerRef.current = null;
      lakeLayerRef.current = null;
      map.remove();
      if (mapRef.current === map) mapRef.current = null;
    };
  }, []);

  // Ocean beneath counties; lakes above (lakes overlap county polygons)
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !waterGeojson) return;

    if (oceanLayerRef.current) {
      map.removeLayer(oceanLayerRef.current);
      oceanLayerRef.current = null;
    }
    if (lakeLayerRef.current) {
      map.removeLayer(lakeLayerRef.current);
      lakeLayerRef.current = null;
    }

    const { lakes, ocean } = splitWaterFeatures(waterGeojson);
    const style = () => kenyaWaterStyle();

    if (ocean.length > 0) {
      const oceanLayer = L.geoJSON(
        { type: "FeatureCollection", features: ocean },
        { style, interactive: false, pane: "kenya-ocean" },
      );
      oceanLayer.addTo(map);
      oceanLayerRef.current = oceanLayer;
    }

    if (lakes.length > 0) {
      const lakeLayer = L.geoJSON(
        { type: "FeatureCollection", features: lakes },
        { style, interactive: false, pane: "kenya-lakes" },
      );
      lakeLayer.addTo(map);
      lakeLayerRef.current = lakeLayer;
    }

    orderWaterLayers(oceanLayerRef.current, lakeLayerRef.current);
  }, [waterGeojson, mapReady]);

  // Paint / update choropleth when map is ready and data is available
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !enriched) return;

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    const layer = L.geoJSON(enriched as GeoJSON.GeoJsonObject, {
      pane: "kenya-counties",
      style: countyStyle,
      onEachFeature: (feature, lyr) => {
        lyr.on({
          mouseover: (e) => {
            const path = e.target as L.Path;
            path.setStyle({ weight: 2.2, color: "#000000", opacity: 1 });
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
            layer.resetStyle(e.target);
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
            if (props) setSelected(props);
          },
        });
      },
    });

    layer.addTo(map);
    layerRef.current = layer;
    orderWaterLayers(oceanLayerRef.current, lakeLayerRef.current);

    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 7 });
    }
    map.invalidateSize();
  }, [enriched, mapReady]);

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
            County websites coloured by latest ICTA compliance score. Hover a
            county for its score and weakest category; click for details. This
            map is a separate showcase from the{" "}
            <Link href="/registry" className="text-icta-link hover:underline">
              MCDA registry
            </Link>
            .
          </p>
        </header>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs tabular-nums text-icta-gray-600">
            {pending && !geojson
              ? "Loading counties…"
              : `${counties.length} counties · ${scoredCount} with scores`}
          </p>
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

        {error && (
          <div
            className="mb-4 rounded-md border border-icta-red/20 bg-icta-red/5 px-4 py-3 text-sm text-icta-red"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
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
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-4">
            <section className="rounded-md border border-icta-gray-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-icta-black">
                {selected ? "Selected county" : "Hover or click a county"}
              </h2>
              {selected ? (
                <div className="mt-2 space-y-2 text-sm">
                  <p className="font-medium text-icta-black">
                    {selected.orgName || selected.shapeName}
                  </p>
                  <p className="tabular-nums text-icta-gray-600">
                    {selected.score != null
                      ? `Score ${selected.score.toFixed(1)} · ${scoreBand(selected.score).label}`
                      : "Not scanned yet"}
                  </p>
                  <p className="text-xs text-icta-gray-600">
                    {selected.topIssue
                      ? `Weakest category: ${selected.topIssue}`
                      : "Weakest category: no breakdown yet"}
                  </p>
                  {selected.url && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <a
                        href={selected.url}
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
                          if (selected.url) void copyScanUrl(selected.url);
                        }}
                      >
                        Scan
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-icta-gray-600">
                  Colours update from registry scores as county scans complete.
                </p>
              )}
            </section>

            <section className="min-h-0 flex-1 rounded-md border border-icta-gray-200 px-4 py-3">
              <h2 className="mb-2 text-sm font-semibold text-icta-black">
                Scored counties
              </h2>
              {ranked.length === 0 ? (
                <p className="text-xs text-icta-gray-600">
                  No county scores yet. Run{" "}
                  <Link
                    href="/registry"
                    className="text-icta-link hover:underline"
                  >
                    Scan all MCDAs
                  </Link>{" "}
                  from the registry, or scan individual county sites.
                </p>
              ) : (
                <ul className="max-h-[22rem] space-y-2 overflow-y-auto text-sm">
                  {ranked.map((row) => {
                    const band = scoreBand(row.latest_score);
                    const issue = topIssueFromBreakdown(row.category_breakdown);
                    return (
                      <li key={row.domain_id}>
                        <button
                          type="button"
                          className="w-full rounded-md px-2 py-1.5 text-left hover:bg-icta-gray-50"
                          onClick={() =>
                            setSelected({
                              shapeName: row.registered_name || row.org_name,
                              fillColor: band.fill,
                              scoreBand: band.band,
                              score: row.latest_score,
                              orgName: row.registered_name || row.org_name,
                              url: row.url,
                              topIssue: issue,
                              trend: row.trend,
                              matched: true,
                            })
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
                          {issue && (
                            <span className="mt-0.5 block text-xs text-icta-gray-600">
                              {issue}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <p className="text-[10px] leading-relaxed text-icta-gray-600">
              Boundaries: geoBoundaries Kenya ADM1 (CC / public domain via
              RCMRD). Water: Natural Earth lakes + regional ocean extent.
              Scores: Sentinel MCDA registry.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}
