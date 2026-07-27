import fs from "fs";
import path from "path";
import * as turf from "@turf/turf";

const root = path.resolve(import.meta.dirname, "..");
const countiesPath = path.join(root, "public/geo/kenya-counties.geojson");
const waterPath = path.join(root, "public/geo/kenya-water.geojson");
const fullLakePath = path.join(root, "public/geo/kenya-water-full.json");

const counties = JSON.parse(fs.readFileSync(countiesPath, "utf8"));
let water = JSON.parse(fs.readFileSync(waterPath, "utf8"));

function unionCounties(features) {
  let merged = features[0];
  for (let i = 1; i < features.length; i++) {
    const next = turf.union(turf.featureCollection([merged, features[i]]));
    if (next) merged = next;
  }
  return merged;
}

const kenya = unionCounties(counties.features);

// --- Lake Victoria (Kenya wedge only) ---
let fullLake;
if (fs.existsSync(fullLakePath)) {
  const raw = fs.readFileSync(fullLakePath, "utf8").replace(/^\uFEFF/, "");
  fullLake = JSON.parse(raw).features.find((f) => f.properties?.name === "Lake Victoria");
} else {
  fullLake = water.features.find((f) => f.properties?.name === "Lake Victoria");
}

const lakeBuffered = turf.buffer(kenya, 22, { units: "kilometers" });
let victoria = turf.intersect(turf.featureCollection([fullLake, lakeBuffered]));
if (!victoria) throw new Error("Lake Victoria clip failed");

const kenyaBbox = turf.bbox(kenya);
const lakeTrim = turf.bboxPolygon([
  kenyaBbox[0],
  kenyaBbox[1] - 0.05,
  kenyaBbox[2] + 0.05,
  kenyaBbox[3] + 0.05,
]);
victoria = turf.intersect(turf.featureCollection([victoria, lakeTrim]));
if (!victoria) throw new Error("Lake Victoria trim failed");
victoria.properties = { name: "Lake Victoria", kind: "lake" };

// --- Indian Ocean (coastal corridor only; ends north at Lamu) ---
const COASTAL_NAMES = ["Lamu", "Kwale", "Kilifi", "Tana River", "Mombasa"];
const coastalFeatures = counties.features.filter((f) =>
  COASTAL_NAMES.includes(String(f.properties?.shapeName ?? "")),
);
if (coastalFeatures.length !== COASTAL_NAMES.length) {
  throw new Error("Missing coastal county features for ocean clip");
}

const lamu = coastalFeatures.find((f) => f.properties.shapeName === "Lamu");
const lamuBbox = turf.bbox(lamu);
const kenyaSouth = kenyaBbox[1];

// Ocean only along the Indian Ocean coast (Lamu southward), not along the Somalia land border.
const oceanLatCap = lamuBbox[3] + 0.08;
const oceanBox = turf.bboxPolygon([38.8, kenyaSouth - 0.15, 42.5, oceanLatCap]);

const coastalUnion = unionCounties(coastalFeatures);
const coastalSea = turf.buffer(coastalUnion, 140, { units: "kilometers" });

let ocean = turf.intersect(turf.featureCollection([oceanBox, coastalSea]));
if (!ocean) throw new Error("Indian Ocean corridor clip failed");

const landMask = turf.buffer(kenya, 1.2, { units: "kilometers" });
ocean = turf.difference(turf.featureCollection([ocean, landMask]));
if (!ocean) throw new Error("Indian Ocean land mask failed");

ocean.properties = { name: "Indian Ocean", kind: "ocean" };

const victoriaIdx = water.features.findIndex((f) => f.properties?.name === "Lake Victoria");
const oceanIdx = water.features.findIndex((f) => f.properties?.name === "Indian Ocean");
water.features[victoriaIdx] = victoria;
water.features[oceanIdx] = ocean;

fs.writeFileSync(waterPath, JSON.stringify(water));

console.log("Lake Victoria bbox:", turf.bbox(victoria).map((v) => v.toFixed(3)).join(", "));
console.log("Indian Ocean bbox:", turf.bbox(ocean).map((v) => v.toFixed(3)).join(", "));
console.log("Written:", waterPath);
