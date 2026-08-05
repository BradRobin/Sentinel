"""HQ county + coordinates for non-county MCDAs (map markers / drill-down).

Counties stay polygon-only. Ministries and agencies default to Nairobi CBD with
a deterministic jitter so markers are distinguishable. Explicit overrides pin
orgs that are clearly headquartered elsewhere.
"""

from __future__ import annotations

import hashlib
import math
from typing import TypedDict

from app.data.mcda_registry import MCDA_REGISTRY, RegistryEntry


class McdaGeo(TypedDict):
    hq_county: str
    latitude: float
    longitude: float


# Approximate HQ centroids (WGS84)
_NAIROBI = (-1.286389, 36.817223)
_MOMBASA = (-4.043477, 39.668206)
_MACHAKOS = (-1.5177, 37.2634)

# url → (hq_county, lat, lng) for orgs not defaulting to Nairobi CBD
_OVERRIDES: dict[str, McdaGeo] = {
    "https://www.kpa.go.ke": {
        "hq_county": "Mombasa",
        "latitude": _MOMBASA[0],
        "longitude": _MOMBASA[1],
    },
    "https://www.konza.go.ke": {
        "hq_county": "Machakos",
        "latitude": _MACHAKOS[0],
        "longitude": _MACHAKOS[1],
    },
    "https://www.kaa.go.ke": {
        "hq_county": "Nairobi",
        "latitude": -1.319167,
        "longitude": 36.9275,
    },
}


def _jitter_around(lat: float, lng: float, key: str, radius_deg: float = 0.045) -> tuple[float, float]:
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
    angle = (int(digest[:8], 16) % 360) * math.pi / 180.0
    dist = (int(digest[8:16], 16) % 1000) / 1000.0 * radius_deg
    return lat + dist * math.cos(angle), lng + dist * math.sin(angle)


def geo_for_registry_entry(entry: RegistryEntry) -> McdaGeo | None:
    """Return HQ geo for ministries/agencies; counties have no point geometry."""
    if entry["org_type"] == "county":
        return None

    override = _OVERRIDES.get(entry["url"])
    if override and entry["org_type"] != "county":
        # Still jitter slightly when multiple share an exact override point
        lat, lng = _jitter_around(
            override["latitude"],
            override["longitude"],
            entry["url"],
            radius_deg=0.012,
        )
        return {
            "hq_county": override["hq_county"],
            "latitude": round(lat, 6),
            "longitude": round(lng, 6),
        }

    lat, lng = _jitter_around(_NAIROBI[0], _NAIROBI[1], entry["url"])
    return {
        "hq_county": "Nairobi",
        "latitude": round(lat, 6),
        "longitude": round(lng, 6),
    }


def geo_by_url() -> dict[str, McdaGeo]:
    out: dict[str, McdaGeo] = {}
    for entry in MCDA_REGISTRY:
        geo = geo_for_registry_entry(entry)
        if geo:
            out[entry["url"]] = geo
    return out
