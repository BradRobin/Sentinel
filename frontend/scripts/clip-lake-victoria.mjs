import fs from "fs";
import path from "path";
import * as turf from "@turf/turf";

const root = path.resolve(import.meta.dirname, "..");
const countiesPath = path.join(root, "public/geo/kenya-counties.geojson");
const waterPath = path.join(root, "public/geo/kenya-water.geojson");
const fullPath = path.join(root, "public/geo/kenya-water-full.json");

const counties = JSON.parse(fs.readFileSync(countiesPath, "utf8"));
let water = JSON.parse(fs.readFileSync(waterPath, "utf8"));

// Full Natural Earth lake polygon (committed baseline)
let fullLake;
if (fs.existsSync(fullPath)) {
  const raw = fs.readFileSync(fullPath, "utf8").replace(/^\uFEFF/, "");
  fullLake = JSON.parse(raw).features.find((f) => f.properties?.name === "Lake Victoria");
} else {
  fullLake = water.features.find((f) => f.properties?.name === "Lake Victoria");
}

let kenya = counties.features[0];
for (let i = 1; i < counties.features.length; i++) {
  const merged = turf.union(turf.featureCollection([kenya, counties.features[i]]));
  if (merged) kenya = merged;
}

// Include Kenya's open-water wedge: buffer land border into the lake, then cut to lake polygon.
const buffered = turf.buffer(kenya, 22, { units: "kilometers" });
let clipped = turf.intersect(turf.featureCollection([fullLake, buffered]));
if (!clipped) {
  throw new Error("Lake Victoria clip failed");
}

// Trim any buffer bleed west of Kenya's westernmost county edge.
const kenyaBbox = turf.bbox(kenya);
const trimBox = turf.bboxPolygon([
  kenyaBbox[0],
  kenyaBbox[1] - 0.05,
  kenyaBbox[2] + 0.05,
  kenyaBbox[3] + 0.05,
]);
clipped = turf.intersect(turf.featureCollection([clipped, trimBox]));
if (!clipped) {
  throw new Error("Lake Victoria trim failed");
}

clipped.properties = { name: "Lake Victoria", kind: "lake" };

const victoriaIdx = water.features.findIndex((f) => f.properties?.name === "Lake Victoria");
water.features[victoriaIdx] = clipped;

fs.writeFileSync(waterPath, JSON.stringify(water));
const bbox = turf.bbox(clipped);
console.log("Clipped Lake Victoria bbox:", bbox.map((v) => v.toFixed(3)).join(", "));
console.log("Written:", waterPath);
