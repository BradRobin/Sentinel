"""Quarterly historical score snapshots for domain trend comparison.

Overwrite policy: multiple scans in the same calendar quarter replace the
existing ``historical_scores`` row for ``(domain_id, quarter)``. The table
represents current state per quarter (ICTA audit cadence), not every scan.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from app.core.database import get_connection
from app.services.scan_runner import SCORED_PROGRESS_CATEGORIES
from app.services.scoring import ScoreResult

logger = logging.getLogger(__name__)

# Category keys match scoring / standards_reference (seo, not seo_visibility)
HISTORICAL_CATEGORY_KEYS: tuple[str, ...] = SCORED_PROGRESS_CATEGORIES


def calendar_quarter(when: datetime | None = None) -> str:
    """Return calendar quarter label, e.g. ``2026-Q3`` (Jan–Mar = Q1)."""
    dt = when or datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    q = (dt.month - 1) // 3 + 1
    return f"{dt.year}-Q{q}"


def category_breakdown_from_scores(score_result: ScoreResult) -> dict[str, float]:
    """Build jsonb-ready map of scored category → percent score."""
    by_cat = {c.category: round(c.score, 2) for c in score_result.categories}
    # Ensure all 8 scored keys are present for stable diffs
    return {
        key: float(by_cat.get(key, 0.0)) for key in HISTORICAL_CATEGORY_KEYS
    }


def get_domain_id_for_scan(scan_id: str) -> str | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT domain_id FROM scans WHERE id = %s",
            (scan_id,),
        ).fetchone()
    if not row or row["domain_id"] is None:
        return None
    return str(row["domain_id"])


def upsert_historical_score(
    domain_id: str,
    score_result: ScoreResult,
    *,
    quarter: str | None = None,
    when: datetime | None = None,
) -> str:
    """
    Upsert this quarter's historical row for the domain (overwrite-with-latest).

    Returns the quarter label written.
    """
    q = quarter or calendar_quarter(when)
    overall = round(score_result.overall_score, 2)
    breakdown = category_breakdown_from_scores(score_result)

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO historical_scores (
                domain_id, quarter, overall_score, category_breakdown
            ) VALUES (
                %s, %s, %s, %s::jsonb
            )
            ON CONFLICT (domain_id, quarter) DO UPDATE SET
                overall_score = EXCLUDED.overall_score,
                category_breakdown = EXCLUDED.category_breakdown,
                created_at = now()
            """,
            (domain_id, q, overall, json.dumps(breakdown)),
        )
        conn.commit()
    logger.info(
        "Upserted historical_scores domain=%s quarter=%s overall=%.2f",
        domain_id,
        q,
        overall,
    )
    return q


def upsert_historical_score_for_scan(
    scan_id: str,
    score_result: ScoreResult,
    *,
    quarter: str | None = None,
    when: datetime | None = None,
) -> str | None:
    domain_id = get_domain_id_for_scan(scan_id)
    if not domain_id:
        logger.warning("No domain_id for scan %s — skipping historical_scores", scan_id)
        return None
    return upsert_historical_score(
        domain_id, score_result, quarter=quarter, when=when
    )


def _normalize_breakdown(raw: Any) -> dict[str, float]:
    if not isinstance(raw, dict):
        return {key: 0.0 for key in HISTORICAL_CATEGORY_KEYS}
    out: dict[str, float] = {}
    for key in HISTORICAL_CATEGORY_KEYS:
        val = raw.get(key, 0.0)
        try:
            out[key] = round(float(val), 2)
        except (TypeError, ValueError):
            out[key] = 0.0
    return out


def get_comparison_for_domain(domain_id: str) -> dict[str, Any]:
    """
    Compare latest historical row to the most recent prior entry.

    Skipped quarters are fine — we compare against whatever was last recorded
    and label it with its real quarter string.
    """
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT quarter, overall_score, category_breakdown
            FROM historical_scores
            WHERE domain_id = %s
            ORDER BY quarter DESC
            LIMIT 2
            """,
            (domain_id,),
        ).fetchall()

    if len(rows) < 2:
        return {"has_history": False}

    current_row, previous_row = rows[0], rows[1]
    current_overall = float(current_row["overall_score"] or 0.0)
    previous_overall = float(previous_row["overall_score"] or 0.0)
    current_bd = _normalize_breakdown(current_row["category_breakdown"])
    previous_bd = _normalize_breakdown(previous_row["category_breakdown"])

    cat_delta = {
        key: round(current_bd[key] - previous_bd[key], 2)
        for key in HISTORICAL_CATEGORY_KEYS
    }

    return {
        "has_history": True,
        "current": {
            "quarter": current_row["quarter"],
            "overall_score": round(current_overall, 2),
            "category_breakdown": current_bd,
        },
        "previous": {
            "quarter": previous_row["quarter"],
            "overall_score": round(previous_overall, 2),
            "category_breakdown": previous_bd,
        },
        "delta": {
            "overall": round(current_overall - previous_overall, 2),
            "category_breakdown": cat_delta,
        },
    }


def get_comparison_for_scan(scan_id: str) -> dict[str, Any] | None:
    """Resolve domain from scan; None if scan missing."""
    domain_id = get_domain_id_for_scan(scan_id)
    if not domain_id:
        return None
    return get_comparison_for_domain(domain_id)
