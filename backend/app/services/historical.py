"""Historical score snapshots and flexible period comparison.

Each completed scan writes one ``historical_scores`` row keyed by ``scan_id``
(when present). Calendar quarter is a derived display label only.

Comparison picks the closest snapshot at or before ``as_of − period``.
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Literal

from app.core.database import get_connection
from app.services.scan_runner import SCORED_PROGRESS_CATEGORIES
from app.services.scoring import ScoreResult

logger = logging.getLogger(__name__)

HISTORICAL_CATEGORY_KEYS: tuple[str, ...] = SCORED_PROGRESS_CATEGORIES

ComparisonPeriod = Literal["week", "biweek", "month", "quarter", "year"]

COMPARISON_PERIODS: tuple[ComparisonPeriod, ...] = (
    "week",
    "biweek",
    "month",
    "quarter",
    "year",
)

PERIOD_DELTAS: dict[ComparisonPeriod, timedelta] = {
    "week": timedelta(days=7),
    "biweek": timedelta(days=14),
    "month": timedelta(days=30),
    "quarter": timedelta(days=91),
    "year": timedelta(days=365),
}

PERIOD_LABELS: dict[ComparisonPeriod, str] = {
    "week": "1 week ago",
    "biweek": "2 weeks ago",
    "month": "1 month ago",
    "quarter": "1 quarter ago",
    "year": "1 year ago",
}


def calendar_quarter(when: datetime | None = None) -> str:
    """Return calendar quarter label, e.g. ``2026-Q3`` (Jan–Mar = Q1)."""
    dt = when or datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    q = (dt.month - 1) // 3 + 1
    return f"{dt.year}-Q{q}"


def normalize_period(period: str | None) -> ComparisonPeriod:
    raw = (period or "quarter").strip().lower()
    if raw not in PERIOD_DELTAS:
        raise ValueError(
            f"Invalid period {period!r}; allowed: {', '.join(COMPARISON_PERIODS)}"
        )
    return raw  # type: ignore[return-value]


def category_breakdown_from_scores(score_result: ScoreResult) -> dict[str, float]:
    """Build jsonb-ready map of scored category → percent score."""
    by_cat = {c.category: round(c.score, 2) for c in score_result.categories}
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


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _date_label(dt: datetime | date) -> str:
    if isinstance(dt, datetime):
        return _as_utc(dt).date().isoformat()
    return dt.isoformat()


def record_historical_snapshot(
    domain_id: str,
    score_result: ScoreResult,
    *,
    scan_id: str | None = None,
    when: datetime | None = None,
    quarter: str | None = None,
) -> str:
    """
    Persist a score snapshot for the domain.

    When ``scan_id`` is set, re-running the same scan updates that row.
    Returns the calendar-quarter display label written.
    """
    snapshot_at = _as_utc(when or datetime.now(timezone.utc))
    q = quarter or calendar_quarter(snapshot_at)
    overall = round(score_result.overall_score, 2)
    breakdown = category_breakdown_from_scores(score_result)
    breakdown_json = json.dumps(breakdown)

    with get_connection() as conn:
        if scan_id:
            existing = conn.execute(
                """
                SELECT id FROM historical_scores
                WHERE scan_id = %s
                LIMIT 1
                """,
                (scan_id,),
            ).fetchone()
            if existing:
                conn.execute(
                    """
                    UPDATE historical_scores
                    SET domain_id = %s,
                        quarter = %s,
                        overall_score = %s,
                        category_breakdown = %s::jsonb,
                        snapshot_at = %s,
                        created_at = now()
                    WHERE id = %s
                    """,
                    (
                        domain_id,
                        q,
                        overall,
                        breakdown_json,
                        snapshot_at,
                        str(existing["id"]),
                    ),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO historical_scores (
                        domain_id, quarter, overall_score, category_breakdown,
                        snapshot_at, scan_id
                    ) VALUES (
                        %s, %s, %s, %s::jsonb, %s, %s
                    )
                    """,
                    (
                        domain_id,
                        q,
                        overall,
                        breakdown_json,
                        snapshot_at,
                        scan_id,
                    ),
                )
        else:
            conn.execute(
                """
                INSERT INTO historical_scores (
                    domain_id, quarter, overall_score, category_breakdown,
                    snapshot_at
                ) VALUES (
                    %s, %s, %s, %s::jsonb, %s
                )
                """,
                (domain_id, q, overall, breakdown_json, snapshot_at),
            )
        conn.commit()

    logger.info(
        "Recorded historical_scores domain=%s snapshot=%s quarter=%s overall=%.2f scan=%s",
        domain_id,
        snapshot_at.isoformat(),
        q,
        overall,
        scan_id,
    )
    return q


def upsert_historical_score(
    domain_id: str,
    score_result: ScoreResult,
    *,
    quarter: str | None = None,
    when: datetime | None = None,
    scan_id: str | None = None,
) -> str:
    """Compatibility wrapper — prefer ``record_historical_snapshot``."""
    return record_historical_snapshot(
        domain_id,
        score_result,
        scan_id=scan_id,
        when=when,
        quarter=quarter,
    )


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
    return record_historical_snapshot(
        domain_id,
        score_result,
        scan_id=scan_id,
        when=when,
        quarter=quarter,
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


def _row_to_snapshot(row: dict[str, Any]) -> dict[str, Any]:
    snap = row["snapshot_at"]
    if isinstance(snap, datetime):
        snap_dt = _as_utc(snap)
    else:
        snap_dt = _as_utc(datetime.now(timezone.utc))
    return {
        "date": _date_label(snap_dt),
        "quarter": row.get("quarter") or calendar_quarter(snap_dt),
        "overall_score": round(float(row["overall_score"] or 0.0), 2),
        "category_breakdown": _normalize_breakdown(row.get("category_breakdown")),
    }


def list_snapshots_for_domain(domain_id: str) -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT snapshot_at, quarter, overall_score, category_breakdown, scan_id
            FROM historical_scores
            WHERE domain_id = %s
            ORDER BY snapshot_at DESC
            """,
            (domain_id,),
        ).fetchall()
    return list(rows)


def _closest_at_or_before(
    rows: list[dict[str, Any]],
    target: datetime,
) -> dict[str, Any] | None:
    """Pick the newest snapshot with snapshot_at <= target."""
    target = _as_utc(target)
    best: dict[str, Any] | None = None
    for row in rows:
        snap = row["snapshot_at"]
        if not isinstance(snap, datetime):
            continue
        snap = _as_utc(snap)
        if snap <= target and (best is None or snap > _as_utc(best["snapshot_at"])):
            best = row
    return best


def available_periods_for_domain(
    domain_id: str,
    *,
    as_of: datetime | None = None,
) -> dict[str, Any]:
    """
    Which comparison periods have a prior snapshot relative to the latest
    (or ``as_of``) snapshot.
    """
    rows = list_snapshots_for_domain(domain_id)
    if not rows:
        return {
            "available_periods": [],
            "current_date": None,
            "period_labels": dict(PERIOD_LABELS),
        }

    current = rows[0]
    current_at = _as_utc(current["snapshot_at"])
    reference = _as_utc(as_of) if as_of else current_at

    available: list[str] = []
    for period in COMPARISON_PERIODS:
        target = reference - PERIOD_DELTAS[period]
        prior = _closest_at_or_before(rows, target)
        # Must be a distinct earlier snapshot than the current one
        if prior is None:
            continue
        prior_at = _as_utc(prior["snapshot_at"])
        if prior_at < current_at:
            available.append(period)

    return {
        "available_periods": available,
        "current_date": _date_label(current_at),
        "period_labels": dict(PERIOD_LABELS),
    }


def get_comparison_for_domain(
    domain_id: str,
    *,
    period: str | None = "quarter",
    as_of: datetime | None = None,
) -> dict[str, Any]:
    """
    Compare the latest snapshot to the closest snapshot at or before
    ``reference − period``.
    """
    try:
        period_key = normalize_period(period)
    except ValueError:
        raise

    rows = list_snapshots_for_domain(domain_id)
    availability = available_periods_for_domain(domain_id, as_of=as_of)

    if not rows:
        return {
            "has_history": False,
            "requested_period": period_key,
            "available_periods": [],
            "period_label": PERIOD_LABELS[period_key],
        }

    current_row = rows[0]
    current_at = _as_utc(current_row["snapshot_at"])
    reference = _as_utc(as_of) if as_of else current_at
    target = reference - PERIOD_DELTAS[period_key]
    prior_row = _closest_at_or_before(rows, target)

    if prior_row is None or _as_utc(prior_row["snapshot_at"]) >= current_at:
        return {
            "has_history": False,
            "requested_period": period_key,
            "available_periods": availability["available_periods"],
            "period_label": PERIOD_LABELS[period_key],
            "current": _row_to_snapshot(current_row),
        }

    current = _row_to_snapshot(current_row)
    compared_to = _row_to_snapshot(prior_row)
    cat_delta = {
        key: round(
            current["category_breakdown"][key] - compared_to["category_breakdown"][key],
            2,
        )
        for key in HISTORICAL_CATEGORY_KEYS
    }

    return {
        "has_history": True,
        "requested_period": period_key,
        "period_label": PERIOD_LABELS[period_key],
        "available_periods": availability["available_periods"],
        "current": current,
        "compared_to": compared_to,
        # Back-compat alias used by older clients
        "previous": compared_to,
        "delta": {
            "overall": round(
                current["overall_score"] - compared_to["overall_score"], 2
            ),
            "category_breakdown": cat_delta,
        },
    }


def get_comparison_for_scan(
    scan_id: str,
    *,
    period: str | None = "quarter",
) -> dict[str, Any] | None:
    """Resolve domain from scan; None if scan missing."""
    domain_id = get_domain_id_for_scan(scan_id)
    if not domain_id:
        return None
    return get_comparison_for_domain(domain_id, period=period)


def get_availability_for_scan(scan_id: str) -> dict[str, Any] | None:
    domain_id = get_domain_id_for_scan(scan_id)
    if not domain_id:
        return None
    return available_periods_for_domain(domain_id)
