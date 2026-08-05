"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import L from "leaflet";

import { A11Y_TEXT_EVENT } from "@/lib/a11y";
import {
  kenyaWaterStyle,
  normalizeCountyKey,
  type McdaMapMarker,
} from "@/lib/kenya-map";

export function splitWaterFeatures(water: GeoJSON.GeoJsonObject): {
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

export function orderWaterLayers(
  oceanLayer: L.GeoJSON | null,
  lakeLayer: L.GeoJSON | null,
) {
  oceanLayer?.bringToBack();
  lakeLayer?.bringToFront();
}

/** Fixed panes so county hover (bringToFront) cannot cover lakes / markers. */
export function ensureKenyaMapPanes(map: L.Map) {
  const panes: Array<[string, string]> = [
    ["kenya-ocean", "350"],
    ["kenya-counties", "400"],
    ["kenya-lakes", "450"],
    ["kenya-markers", "500"],
  ];
  for (const [name, zIndex] of panes) {
    if (!map.getPane(name)) map.createPane(name);
    const pane = map.getPane(name);
    if (pane) pane.style.zIndex = zIndex;
  }
}

interface UseKenyaMapLayersOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  enriched: GeoJSON.GeoJsonObject | null;
  waterGeojson: GeoJSON.GeoJsonObject | null;
  countyStyle: (feature?: GeoJSON.Feature) => L.PathOptions;
  onEachCountyFeature: (
    feature: GeoJSON.Feature,
    layer: L.Layer,
    layerGroup: L.GeoJSON,
  ) => void;
  markers?: McdaMapMarker[];
  showMarkers?: boolean;
  /** When false, county polygons are outlines only (no hover/click). */
  countiesInteractive?: boolean;
  focusCountyKey?: string | null;
  onMarkerSelect?: (marker: McdaMapMarker) => void;
}

export function useKenyaMapLayers({
  containerRef,
  enriched,
  waterGeojson,
  countyStyle,
  onEachCountyFeature,
  markers = [],
  showMarkers = true,
  countiesInteractive = true,
  focusCountyKey = null,
  onMarkerSelect,
}: UseKenyaMapLayersOptions) {
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);
  const oceanLayerRef = useRef<L.GeoJSON | null>(null);
  const lakeLayerRef = useRef<L.GeoJSON | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const onMarkerSelectRef = useRef(onMarkerSelect);
  onMarkerSelectRef.current = onMarkerSelect;
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // React Strict Mode remounts effects: clear any leftover Leaflet id on the
    // container before creating a new map instance.
    const existingId = (el as HTMLElement & { _leaflet_id?: number })._leaflet_id;
    if (existingId != null) {
      const prior = mapRef.current;
      if (prior) {
        prior.remove();
        mapRef.current = null;
      }
      delete (el as HTMLElement & { _leaflet_id?: number })._leaflet_id;
    }

    let disposed = false;
    const map = L.map(el, {
      zoomControl: true,
      attributionControl: true,
      minZoom: 5,
      maxZoom: 12,
    });
    map.setView([0.35, 37.9], 6);
    map.attributionControl.setPrefix("");
    map.attributionControl.addAttribution(
      '<a href="https://www.geoboundaries.org/" target="_blank" rel="noreferrer">geoBoundaries</a>',
    );
    ensureKenyaMapPanes(map);
    mapRef.current = map;
    setMapReady(true);

    /** Avoid invalidateSize after remove() — Strict Mode races rAF/ResizeObserver. */
    const safeInvalidate = () => {
      if (disposed || mapRef.current !== map) return;
      try {
        // Leaflet reads _leaflet_pos on the map pane; skip if tear-down started.
        const container = map.getContainer();
        if (!container.isConnected) return;
        map.invalidateSize({ pan: false });
      } catch {
        // Map already torn down mid-frame
      }
    };

    const ro = new ResizeObserver(() => safeInvalidate());
    ro.observe(el);
    const rafId = requestAnimationFrame(() => safeInvalidate());

    function onA11yTextStep() {
      requestAnimationFrame(() => safeInvalidate());
    }
    window.addEventListener(A11Y_TEXT_EVENT, onA11yTextStep);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener(A11Y_TEXT_EVENT, onA11yTextStep);
      ro.disconnect();
      setMapReady(false);
      layerRef.current = null;
      oceanLayerRef.current = null;
      lakeLayerRef.current = null;
      markersLayerRef.current = null;
      map.remove();
      if (mapRef.current === map) mapRef.current = null;
    };
  }, [containerRef]);

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
        { type: "FeatureCollection", features: ocean } as GeoJSON.FeatureCollection,
        { style, interactive: false, pane: "kenya-ocean" },
      );
      oceanLayer.addTo(map);
      oceanLayerRef.current = oceanLayer;
    }

    if (lakes.length > 0) {
      const lakeLayer = L.geoJSON(
        { type: "FeatureCollection", features: lakes } as GeoJSON.FeatureCollection,
        { style, interactive: false, pane: "kenya-lakes" },
      );
      lakeLayer.addTo(map);
      lakeLayerRef.current = lakeLayer;
    }

    orderWaterLayers(oceanLayerRef.current, lakeLayerRef.current);
  }, [waterGeojson, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !enriched) return;

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    const layer = L.geoJSON(enriched, {
      pane: "kenya-counties",
      style: countyStyle,
      interactive: countiesInteractive,
    });

    for (const lyr of layer.getLayers()) {
      const geoLayer = lyr as L.Layer & { feature?: GeoJSON.Feature };
      const feature = geoLayer.feature;
      if (feature && countiesInteractive) onEachCountyFeature(feature, lyr, layer);
    }

    layer.addTo(map);
    layerRef.current = layer;
    orderWaterLayers(oceanLayerRef.current, lakeLayerRef.current);

    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 7 });
    }
    try {
      if (map.getContainer().isConnected) {
        map.invalidateSize({ pan: false });
      }
    } catch {
      // ignore
    }
  }, [enriched, mapReady, countyStyle, onEachCountyFeature, countiesInteractive]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    if (markersLayerRef.current) {
      map.removeLayer(markersLayerRef.current);
      markersLayerRef.current = null;
    }

    if (!showMarkers || markers.length === 0) return;

    const group = L.layerGroup();
    for (const marker of markers) {
      const circle = L.circleMarker([marker.latitude, marker.longitude], {
        radius: marker.orgType === "ministry" ? 7 : 6,
        color: "#111111",
        weight: 1.2,
        fillColor: marker.fill,
        fillOpacity: 0.92,
        pane: "kenya-markers",
      });
      circle.bindTooltip(
        `${marker.orgName}<br/>${
          marker.score != null ? `Score ${marker.score.toFixed(1)}` : "No score yet"
        }`,
        { direction: "top", opacity: 0.95 },
      );
      circle.on("click", () => {
        onMarkerSelectRef.current?.(marker);
      });
      group.addLayer(circle);
    }
    group.addTo(map);
    markersLayerRef.current = group;
  }, [markers, showMarkers, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!mapReady || !map || !layer || !focusCountyKey) return;

    const target = normalizeCountyKey(focusCountyKey);
    for (const lyr of layer.getLayers()) {
      const geoLayer = lyr as L.Layer & { feature?: GeoJSON.Feature };
      const feature = geoLayer.feature;
      const shapeName = String(feature?.properties?.shapeName ?? "");
      if (normalizeCountyKey(shapeName) !== target) continue;
      const path = lyr as L.Polygon;
      const bounds = path.getBounds?.();
      if (bounds?.isValid()) {
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 8 });
      }
      break;
    }
  }, [focusCountyKey, mapReady, enriched]);

  return { mapRef, mapReady, layerRef };
}
