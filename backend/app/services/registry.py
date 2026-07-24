"""MCDA registry reads/writes: domains, orgs, scheduled score updates."""

from __future__ import annotations

import json
import logging
from typing import Any, Literal

from app.core.database import get_connection
from app.services.historical import HISTORICAL_CATEGORY_KEYS
from app.services.scan_repository import normalize_domain_url
from app.services.scoring import ScoreResult

logger = logging.getLogger(__name__)

Trend = Literal["up", "down", "flat", "unknown"]


def record_domain_score_update(
    domain_id: str,
    score_result: ScoreResult,
    *,
    scan_id: str | None = None,
    source: str = "manual",
) -> str | None:
    """
    Persist a registry score snapshot for a verified domain.

    Returns the update id, or None if the domain is not in the verified registry
    (ad-hoc scan URLs should not pollute the dashboard).
    """
    breakdown = {
        key: 0.0 for key in HISTORICAL_CATEGORY_KEYS
    }
    by_cat = {c.category: round(c.score, 2) for c in score_result.categories}
    for key in HISTORICAL_CATEGORY_KEYS:
        breakdown[key] = float(by_cat.get(key, 0.0))
    overall = round(score_result.overall_score, 2)

    with get_connection() as conn:
        domain = conn.execute(
            """
            SELECT id, is_verified FROM domains WHERE id = %s
            """,
            (domain_id,),
        ).fetchone()
        if not domain or not domain["is_verified"]:
            return None

        row = conn.execute(
            """
            INSERT INTO domain_score_updates (
                domain_id, scan_id, overall_score, category_breakdown, source
            ) VALUES (
                %s, %s, %s, %s::jsonb, %s
            )
            RETURNING id
            """,
            (
                domain_id,
                scan_id,
                overall,
                json.dumps(breakdown),
                source if source in ("scheduled", "manual") else "manual",
            ),
        ).fetchone()
        conn.commit()

    update_id = str(row["id"])
    logger.info(
        "Recorded domain_score_updates id=%s domain=%s overall=%.2f source=%s",
        update_id,
        domain_id,
        overall,
        source,
    )
    return update_id


def record_score_update_for_scan(
    scan_id: str,
    score_result: ScoreResult,
) -> str | None:
    """Resolve domain + triggered_type from the scan, then record if verified."""
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT domain_id, triggered_type
            FROM scans
            WHERE id = %s
            """,
            (scan_id,),
        ).fetchone()
    if not row or row["domain_id"] is None:
        return None
    source = "scheduled" if row["triggered_type"] == "scheduled" else "manual"
    return record_domain_score_update(
        str(row["domain_id"]),
        score_result,
        scan_id=scan_id,
        source=source,
    )


def _trend(current: float | None, previous: float | None) -> Trend:
    if current is None or previous is None:
        return "unknown"
    delta = round(current - previous, 2)
    if abs(delta) < 0.5:
        return "flat"
    return "up" if delta > 0 else "down"


def list_registry_entries(
    *,
    org_type: str | None = None,
    q: str | None = None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    """
    Verified MCDAs with latest score, prior score (for trend), and last checked.
    """
    limit = max(1, min(int(limit), 500))
    clauses = ["d.is_verified = true"]
    params: list[Any] = []

    if org_type in ("ministry", "county", "agency"):
        clauses.append("o.type = %s::organization_type")
        params.append(org_type)

    if q and q.strip():
        needle = f"%{q.strip().lower()}%"
        clauses.append(
            """
            (
                lower(o.name) LIKE %s
                OR lower(COALESCE(d.registered_name, '')) LIKE %s
                OR lower(d.url) LIKE %s
                OR EXISTS (
                    SELECT 1 FROM unnest(d.search_aliases) a
                    WHERE lower(a) LIKE %s
                )
            )
            """
        )
        params.extend([needle, needle, needle, needle])

    where = " AND ".join(clauses)
    params.append(limit)

    sql = f"""
        WITH ranked AS (
            SELECT
                u.domain_id,
                u.overall_score,
                u.checked_at,
                u.source,
                ROW_NUMBER() OVER (
                    PARTITION BY u.domain_id ORDER BY u.checked_at DESC
                ) AS rn
            FROM domain_score_updates u
        )
        SELECT
            d.id AS domain_id,
            d.url,
            d.registered_name,
            d.search_aliases,
            d.added_at,
            o.id AS org_id,
            o.name AS org_name,
            o.type AS org_type,
            o.sector,
            latest.overall_score AS latest_score,
            latest.checked_at AS last_checked_at,
            latest.source AS last_source,
            prior.overall_score AS previous_score
        FROM domains d
        JOIN organizations o ON o.id = d.org_id
        LEFT JOIN ranked latest
            ON latest.domain_id = d.id AND latest.rn = 1
        LEFT JOIN ranked prior
            ON prior.domain_id = d.id AND prior.rn = 2
        WHERE {where}
        ORDER BY
            latest.overall_score DESC NULLS LAST,
            o.name ASC
        LIMIT %s
    """

    with get_connection() as conn:
        rows = conn.execute(sql, params).fetchall()

    out: list[dict[str, Any]] = []
    for r in rows:
        latest = (
            float(r["latest_score"]) if r["latest_score"] is not None else None
        )
        previous = (
            float(r["previous_score"]) if r["previous_score"] is not None else None
        )
        aliases = r["search_aliases"] or []
        if isinstance(aliases, str):
            aliases = [aliases]
        out.append(
            {
                "domain_id": str(r["domain_id"]),
                "org_id": str(r["org_id"]),
                "org_name": r["org_name"],
                "org_type": r["org_type"],
                "sector": r["sector"],
                "url": r["url"],
                "registered_name": r["registered_name"],
                "aliases": list(aliases),
                "latest_score": latest,
                "previous_score": previous,
                "last_checked_at": (
                    r["last_checked_at"].isoformat()
                    if r["last_checked_at"] is not None
                    else None
                ),
                "last_source": r["last_source"],
                "trend": _trend(latest, previous),
                "score_delta": (
                    round(latest - previous, 2)
                    if latest is not None and previous is not None
                    else None
                ),
            }
        )
    return out


def list_verified_domains_for_scan() -> list[dict[str, str]]:
    """All verified registry domains (id + url) for the weekly job."""
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, url FROM domains
            WHERE is_verified = true
            ORDER BY url
            """
        ).fetchall()
    return [{"domain_id": str(r["id"]), "url": r["url"]} for r in rows]


def match_registry_suggestions(query: str, *, limit: int = 5) -> list[dict[str, Any]]:
    """Lightweight alias/name/url substring match for autocomplete."""
    q = query.strip().lower()
    if len(q) < 2:
        return []
    limit = max(1, min(int(limit), 20))
    needle = f"%{q}%"
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                d.url,
                d.registered_name,
                d.search_aliases,
                o.name AS org_name
            FROM domains d
            JOIN organizations o ON o.id = d.org_id
            WHERE d.is_verified = true
              AND (
                lower(o.name) LIKE %s
                OR lower(COALESCE(d.registered_name, '')) LIKE %s
                OR lower(d.url) LIKE %s
                OR EXISTS (
                    SELECT 1 FROM unnest(d.search_aliases) a
                    WHERE lower(a) LIKE %s OR lower(a) = %s
                )
              )
            ORDER BY
                CASE
                    WHEN EXISTS (
                        SELECT 1 FROM unnest(d.search_aliases) a
                        WHERE lower(a) = %s
                    ) THEN 0
                    WHEN EXISTS (
                        SELECT 1 FROM unnest(d.search_aliases) a
                        WHERE lower(a) LIKE %s
                    ) THEN 1
                    ELSE 2
                END,
                o.name
            LIMIT %s
            """,
            (needle, needle, needle, needle, q, q, f"{q}%", limit),
        ).fetchall()

    return [
        {
            "name": r["registered_name"] or r["org_name"],
            "org_name": r["org_name"],
            "url": r["url"],
            "aliases": list(r["search_aliases"] or []),
        }
        for r in rows
    ]


def upsert_registry_entry(
    *,
    org_name: str,
    org_type: str,
    sector: str | None,
    url: str,
    registered_name: str,
    aliases: list[str],
) -> str:
    """Idempotent org + verified domain upsert. Returns domain id."""
    domain_url = normalize_domain_url(url)
    clean_aliases = sorted(
        {a.strip().lower() for a in aliases if a and a.strip()}
    )

    with get_connection() as conn:
        org = conn.execute(
            """
            SELECT id FROM organizations WHERE lower(name) = lower(%s)
            """,
            (org_name,),
        ).fetchone()
        if org:
            conn.execute(
                """
                UPDATE organizations
                SET type = %s::organization_type,
                    sector = COALESCE(%s, sector)
                WHERE id = %s
                """,
                (org_type, sector, str(org["id"])),
            )
            org_id = str(org["id"])
        else:
            created = conn.execute(
                """
                INSERT INTO organizations (name, type, sector)
                VALUES (%s, %s::organization_type, %s)
                RETURNING id
                """,
                (org_name, org_type, sector),
            ).fetchone()
            org_id = str(created["id"])

        domain = conn.execute(
            """
            INSERT INTO domains (
                org_id, url, registered_name, is_verified, search_aliases
            ) VALUES (
                %s, %s, %s, true, %s
            )
            ON CONFLICT (url) DO UPDATE SET
                org_id = EXCLUDED.org_id,
                registered_name = EXCLUDED.registered_name,
                is_verified = true,
                search_aliases = EXCLUDED.search_aliases
            RETURNING id
            """,
            (org_id, domain_url, registered_name, clean_aliases),
        ).fetchone()
        conn.commit()
        return str(domain["id"])
