"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import L from "leaflet";

import { kenyaWaterStyle } from "@/lib/kenya-map";

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

/** Fixed panes so county hover (bringToFront) cannot cover lakes. */
export function ensureKenyaMapPanes(map: L.Map) {
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
}

export function useKenyaMapLayers({
  containerRef,
  enriched,
  waterGeojson,
  countyStyle,
  onEachCountyFeature,
}: UseKenyaMapLayersOptions) {
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);
  const oceanLayerRef = useRef<L.GeoJSON | null>(null);
  const lakeLayerRef = useRef<L.GeoJSON | null>(null);
  const [mapReady, setMapReady] = useState(false);

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
      const oceanData: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: ocean,
      };
      const oceanLayer = L.geoJSON(oceanData, {
        style,
        interactive: false,
        pane: "kenya-ocean",
      });
      oceanLayer.addTo(map);
      oceanLayerRef.current = oceanLayer;
    }

    if (lakes.length > 0) {
      const lakeData: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: lakes,
      };
      const lakeLayer = L.geoJSON(lakeData, {
        style,
        interactive: false,
        pane: "kenya-lakes",
      });
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
    });

    for (const lyr of layer.getLayers()) {
      const geoLayer = lyr as L.GeoJSON;
      const feature = geoLayer.feature as unknown as GeoJSON.Feature | undefined;
      if (feature) onEachCountyFeature(feature, lyr, layer);
    }

    layer.addTo(map);
    layerRef.current = layer;
    orderWaterLayers(oceanLayerRef.current, lakeLayerRef.current);

    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 7 });
    }
    map.invalidateSize();
  }, [enriched, mapReady, countyStyle, onEachCountyFeature]);

  return { mapRef, mapReady, layerRef };
}
