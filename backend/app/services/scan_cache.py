"""Scan result cache — Redis primary, Postgres fresh-scan fallback."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlparse

from app.core.config import settings
from app.core.database import get_connection
from app.core.redis_client import get_redis

logger = logging.getLogger(__name__)

CACHE_KEY_PREFIX = "scan:cache:"


def cache_key_for_url(url: str) -> str:
    """Normalize URL for cache keys (scheme + host, no path/query)."""
    parsed = urlparse(url.strip())
    scheme = (parsed.scheme or "https").lower()
    host = (parsed.hostname or "").lower().rstrip(".")
    port = parsed.port
    default_port = 443 if scheme == "https" else 80
    port_suffix = "" if port in (None, default_port) else f":{port}"
    return f"{CACHE_KEY_PREFIX}{scheme}://{host}{port_suffix}"


def get_cached_scan(url: str) -> dict[str, Any] | None:
    """Return cached complete scan payload if within TTL."""
    key = cache_key_for_url(url)
    try:
        raw = get_redis().get(key)
        if raw:
            payload = json.loads(raw)
            payload["cache_hit"] = True
            payload["progress"] = None
            payload["current_category"] = None
            payload.setdefault("categories_completed", [])
            payload.setdefault("total_categories", 8)
            payload["error_category"] = None
            return payload
    except Exception as exc:
        logger.warning("Redis cache read failed: %s", exc)

    # DB fallback: most recent complete scan for this domain within TTL
    return get_fresh_scan_from_db(url)


def set_cached_scan(url: str, payload: dict[str, Any]) -> None:
    key = cache_key_for_url(url)
    to_store = {
        "job_id": payload.get("job_id"),
        "status": "complete",
        "url": payload.get("url", url),
        "result": payload.get("result"),
        "error": None,
        "cached_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        get_redis().setex(
            key,
            settings.scan_cache_ttl_seconds,
            json.dumps(to_store, default=str),
        )
    except Exception as exc:
        logger.warning("Redis cache write failed: %s", exc)


def invalidate_cached_scan(url: str) -> None:
    try:
        get_redis().delete(cache_key_for_url(url))
    except Exception as exc:
        logger.warning("Redis cache invalidate failed: %s", exc)


def get_fresh_scan_from_db(url: str) -> dict[str, Any] | None:
    """Find a complete scan for this host completed within SCAN_CACHE_TTL_SECONDS."""
    from app.services.scan_repository import normalize_domain_url

    domain_url = normalize_domain_url(url)
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=settings.scan_cache_ttl_seconds)
    try:
        with get_connection() as conn:
            row = conn.execute(
                """
                SELECT s.id
                FROM scans s
                JOIN domains d ON d.id = s.domain_id
                WHERE s.status = 'complete'
                  AND s.completed_at IS NOT NULL
                  AND s.completed_at >= %s
                  AND (
                    lower(d.url) = lower(%s)
                    OR lower(d.url) = lower(%s)
                  )
                ORDER BY s.completed_at DESC
                LIMIT 1
                """,
                (cutoff, domain_url, domain_url + "/"),
            ).fetchone()
            if not row:
                # Also match by hostname contained in url
                host = urlparse(domain_url).netloc.lower()
                row = conn.execute(
                    """
                    SELECT s.id
                    FROM scans s
                    JOIN domains d ON d.id = s.domain_id
                    WHERE s.status = 'complete'
                      AND s.completed_at IS NOT NULL
                      AND s.completed_at >= %s
                      AND lower(d.url) LIKE %s
                    ORDER BY s.completed_at DESC
                    LIMIT 1
                    """,
                    (cutoff, f"%{host}%"),
                ).fetchone()
            if not row:
                return None

            scan_id = str(row["id"])
            findings = conn.execute(
                """
                SELECT category, check_name, clause_reference, status,
                       severity, automatability_type, detail
                FROM findings
                WHERE scan_id = %s
                ORDER BY category, check_name
                """,
                (scan_id,),
            ).fetchall()
            score_rows = conn.execute(
                """
                SELECT category, weighted_score, overall_score
                FROM scores WHERE scan_id = %s
                """,
                (scan_id,),
            ).fetchall()

        findings_payload = [
            {
                "category": r["category"],
                "check_name": r["check_name"],
                "clause_reference": r["clause_reference"],
                "status": r["status"],
                "severity": r["severity"],
                "automatability_type": r["automatability_type"],
                "detail": r["detail"],
            }
            for r in findings
        ]
        scores_payload = None
        overall_score = None
        if score_rows:
            cats = []
            for r in score_rows:
                if r["category"] == "overall":
                    overall_score = (
                        float(r["overall_score"]) if r["overall_score"] is not None else None
                    )
                else:
                    cats.append(
                        {
                            "category": r["category"],
                            "score": float(r["weighted_score"])
                            if r["weighted_score"] is not None
                            else 0.0,
                        }
                    )
                    if overall_score is None and r["overall_score"] is not None:
                        overall_score = float(r["overall_score"])
            scores_payload = {
                "overall_score": overall_score,
                "categories": cats,
            }

        result: dict[str, Any] = {
            "findings": findings_payload,
            "finding_count": len(findings_payload),
        }
        if scores_payload:
            result["scores"] = scores_payload
            result["overall_score"] = overall_score

        payload = {
            "job_id": scan_id,
            "status": "complete",
            "url": domain_url,
            "result": result,
            "error": None,
            "cache_hit": True,
            "progress": None,
        }
        # Warm Redis for next hit
        set_cached_scan(url, payload)
        return payload
    except Exception as exc:
        logger.warning("DB cache lookup failed: %s", exc)
        return None
