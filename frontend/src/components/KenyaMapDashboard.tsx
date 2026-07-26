"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { getRegistry, type RegistryEntry } from "@/lib/api";
import {
  KENYA_COUNTIES_GEOJSON_PATH,
  SCORE_BAND_LEGEND,
  enrichCountiesGeoJSON,
  scoreBand,
  topIssueFromBreakdown,
  type CountyMapFeatureProps,
  type KenyaCountiesGeoJSON,
} from "@/lib/kenya-map";
import { copyScanUrl } from "@/lib/scan-url-clipboard";
import { btnSecondarySm, linkQuiet } from "@/lib/ui";

const SOURCE_ID = "kenya-counties";
const FILL_LAYER = "kenya-counties-fill";
const LINE_LAYER = "kenya-counties-line";
const HOVER_LAYER = "kenya-counties-hover";

interface TooltipState {
  x: number;
  y: number;
  props: CountyMapFeatureProps;
}

function readFeatureProps(
  props: Record<string, unknown> | null | undefined,
): CountyMapFeatureProps | null {
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

function boundsFromGeoJSON(geojson: KenyaCountiesGeoJSON): maplibregl.LngLatBounds {
  const bounds = new maplibregl.LngLatBounds();
  const walk = (coords: unknown): void => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      bounds.extend(coords as [number, number]);
      return;
    }
    for (const c of coords) walk(c);
  };
  for (const feature of geojson.features) {
    const geom = feature.geometry as { coordinates?: unknown } | null;
    if (geom?.coordinates) walk(geom.coordinates);
  }
  return bounds;
}

function ensureCountyLayers(map: MapLibreMap, data: KenyaCountiesGeoJSON) {
  const payload = data as never;
  const existing = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  if (existing) {
    existing.setData(payload);
  } else {
    map.addSource(SOURCE_ID, { type: "geojson", data: payload });
    map.addLayer({
      id: FILL_LAYER,
      type: "fill",
      source: SOURCE_ID,
      paint: {
        "fill-color": ["coalesce", ["get", "fillColor"], "#e5e7eb"],
        "fill-opacity": 0.9,
      },
    });
    map.addLayer({
      id: LINE_LAYER,
      type: "line",
      source: SOURCE_ID,
      paint: {
        "line-color": "#111111",
        "line-width": 0.8,
        "line-opacity": 0.5,
      },
    });
    map.addLayer({
      id: HOVER_LAYER,
      type: "line",
      source: SOURCE_ID,
      paint: {
        "line-color": "#000000",
        "line-width": 2.4,
      },
      filter: ["==", ["get", "shapeName"], ""],
    });
  }

  const bounds = boundsFromGeoJSON(data);
  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, { padding: 40, duration: 0, maxZoom: 6.2 });
  }
  map.resize();
}

export function KenyaMapDashboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const enrichedRef = useRef<KenyaCountiesGeoJSON | null>(null);
  const handlersBoundRef = useRef(false);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [counties, setCounties] = useState<RegistryEntry[]>([]);
  const [geojson, setGeojson] = useState<KenyaCountiesGeoJSON | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [selected, setSelected] = useState<CountyMapFeatureProps | null>(null);

  const enriched = useMemo(() => {
    if (!geojson) return null;
    return enrichCountiesGeoJSON(geojson, counties);
  }, [geojson, counties]);

  enrichedRef.current = enriched;

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
        const [registry, geoRes] = await Promise.all([
          getRegistry({ orgType: "county", limit: 100 }),
          fetch(KENYA_COUNTIES_GEOJSON_PATH, { cache: "force-cache" }),
        ]);
        if (!geoRes.ok) {
          throw new Error(`County boundaries failed to load (${geoRes.status})`);
        }
        const geo = (await geoRes.json()) as KenyaCountiesGeoJSON & {
          crs?: unknown;
        };
        // MapLibre can choke on the legacy GeoJSON crs member
        delete geo.crs;
        setCounties(registry.items);
        setGeojson(geo);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load map data");
      }
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    handlersBoundRef.current = false;

    const map = new maplibregl.Map({
      container: el,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#f3f4f6" },
          },
        ],
      },
      center: [37.9, 0.35],
      zoom: 5.4,
      minZoom: 4.5,
      maxZoom: 9,
      attributionControl: { compact: true },
    });

    mapRef.current = map;
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );

    const bindHandlers = () => {
      if (handlersBoundRef.current) return;
      handlersBoundRef.current = true;

      map.on("mousemove", FILL_LAYER, (e: MapLayerMouseEvent) => {
        const props = readFeatureProps(
          e.features?.[0]?.properties as Record<string, unknown> | undefined,
        );
        if (!props) {
          setTooltip(null);
          return;
        }
        map.getCanvas().style.cursor = "pointer";
        map.setFilter(HOVER_LAYER, [
          "==",
          ["get", "shapeName"],
          props.shapeName,
        ]);
        setTooltip({ x: e.point.x, y: e.point.y, props });
      });

      map.on("mouseleave", FILL_LAYER, () => {
        map.getCanvas().style.cursor = "";
        map.setFilter(HOVER_LAYER, ["==", ["get", "shapeName"], ""]);
        setTooltip(null);
      });

      map.on("click", FILL_LAYER, (e: MapLayerMouseEvent) => {
        const props = readFeatureProps(
          e.features?.[0]?.properties as Record<string, unknown> | undefined,
        );
        if (props) setSelected(props);
      });
    };

    const applyData = () => {
      if (cancelled || mapRef.current !== map) return;
      const data = enrichedRef.current;
      if (!data) return;
      try {
        ensureCountyLayers(map, data);
        bindHandlers();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to render county map",
        );
      }
    };

    const onLoad = () => {
      if (cancelled || mapRef.current !== map) return;
      map.resize();
      applyData();
    };

    map.on("load", onLoad);
    map.on("error", (e) => {
      const msg = e.error?.message || "Map failed to render";
      setError(msg);
    });

    // If style is already loaded (fast path), apply immediately
    if (map.isStyleLoaded()) onLoad();

    const ro = new ResizeObserver(() => {
      if (!cancelled && mapRef.current === map) map.resize();
    });
    ro.observe(el);

    return () => {
      cancelled = true;
      ro.disconnect();
      map.off("load", onLoad);
      map.remove();
      if (mapRef.current === map) mapRef.current = null;
      handlersBoundRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const data = enriched;
    if (!map || !data) return;

    const apply = () => {
      if (mapRef.current !== map) return;
      try {
        ensureCountyLayers(map, data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to render county map",
        );
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [enriched]);

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
          <div className="relative overflow-hidden rounded-md border border-icta-gray-200 bg-icta-gray-100">
            <div
              ref={containerRef}
              className="h-[28rem] w-full lg:h-[36rem]"
            />

            {tooltip && (
              <div
                className="pointer-events-none absolute z-10 max-w-[16rem] rounded-md border border-icta-gray-200 bg-white px-3 py-2 text-xs shadow-md"
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
              RCMRD). Scores: Sentinel MCDA registry.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}
