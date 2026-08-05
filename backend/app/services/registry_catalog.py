"""Curated MCDA catalog helpers for DB-free / fallback registry reads."""

from __future__ import annotations

import uuid
from typing import Any

from app.data.mcda_geo import geo_for_registry_entry
from app.data.mcda_registry import MCDA_REGISTRY

# Stable IDs so catalog rows stay consistent across process restarts.
_CATALOG_NS = uuid.UUID("6c1a4f2e-9b3d-4e8a-a1f0-7d2c5b8e4a91")


def catalog_registry_entries(
    *,
    org_type: str | None = None,
    q: str | None = None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    """Build registry list rows from the in-repo curated seed list."""
    limit = max(1, min(int(limit), 500))
    needle = q.strip().lower() if q and q.strip() else None
    out: list[dict[str, Any]] = []

    for entry in MCDA_REGISTRY:
        if org_type in ("ministry", "county", "agency") and entry["org_type"] != org_type:
            continue
        aliases = [a.lower() for a in entry["aliases"]]
        if needle:
            hay = " ".join(
                [
                    entry["org_name"].lower(),
                    entry["registered_name"].lower(),
                    entry["url"].lower(),
                    " ".join(aliases),
                ]
            )
            if needle not in hay:
                continue
        geo = geo_for_registry_entry(entry)
        out.append(
            {
                "domain_id": str(uuid.uuid5(_CATALOG_NS, entry["url"])),
                "org_id": str(uuid.uuid5(_CATALOG_NS, entry["org_name"])),
                "org_name": entry["org_name"],
                "org_type": entry["org_type"],
                "sector": entry["sector"],
                "url": entry["url"],
                "registered_name": entry["registered_name"],
                "aliases": list(entry["aliases"]),
                "hq_county": geo["hq_county"] if geo else None,
                "latitude": geo["latitude"] if geo else None,
                "longitude": geo["longitude"] if geo else None,
                "latest_score": None,
                "previous_score": None,
                "category_breakdown": {},
                "last_checked_at": None,
                "last_source": None,
                "trend": "unknown",
                "score_delta": None,
            }
        )
        if len(out) >= limit:
            break
    return out


def catalog_registry_suggestions(
    query: str, *, limit: int = 5
) -> list[dict[str, Any]]:
    q = query.strip().lower()
    if len(q) < 2:
        return []
    limit = max(1, min(int(limit), 20))
    scored: list[tuple[int, dict[str, Any]]] = []
    for entry in MCDA_REGISTRY:
        aliases = [a.lower() for a in entry["aliases"]]
        name = entry["registered_name"].lower()
        org = entry["org_name"].lower()
        url = entry["url"].lower()
        if q in aliases:
            rank = 0
        elif any(a.startswith(q) for a in aliases):
            rank = 1
        elif q in name or q in org or q in url or any(q in a for a in aliases):
            rank = 2
        else:
            continue
        scored.append(
            (
                rank,
                {
                    "name": entry["registered_name"] or entry["org_name"],
                    "org_name": entry["org_name"],
                    "url": entry["url"],
                    "aliases": list(entry["aliases"]),
                },
            )
        )
    scored.sort(key=lambda item: (item[0], item[1]["org_name"]))
    return [row for _, row in scored[:limit]]
