"""Unit tests for historical snapshots and period comparison math."""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from app.services.historical import (
    available_periods_for_domain,
    calendar_quarter,
    category_breakdown_from_scores,
    get_comparison_for_domain,
    normalize_period,
)
from app.services.scoring import CategoryScore, ScoreResult
import pytest


def _score_result(overall: float, cats: dict[str, float]) -> ScoreResult:
    return ScoreResult(
        overall_score=overall,
        categories=[
            CategoryScore(
                category=k,
                weight=1.0,
                score=v,
                pass_count=1,
                fail_count=0,
                manual_review_count=0,
                scorable_count=1,
            )
            for k, v in cats.items()
        ],
        weights_source="defaults",
    )


def _row(
    *,
    when: datetime,
    overall: float,
    security: float,
    quarter: str | None = None,
) -> dict:
    return {
        "snapshot_at": when,
        "quarter": quarter or calendar_quarter(when),
        "overall_score": overall,
        "category_breakdown": {
            "security": security,
            "accessibility": 80.0,
        },
        "scan_id": None,
    }


def test_calendar_quarter_labels():
    assert calendar_quarter(datetime(2026, 1, 15, tzinfo=timezone.utc)) == "2026-Q1"
    assert calendar_quarter(datetime(2026, 4, 1, tzinfo=timezone.utc)) == "2026-Q2"
    assert calendar_quarter(datetime(2026, 7, 24, tzinfo=timezone.utc)) == "2026-Q3"
    assert calendar_quarter(datetime(2026, 12, 31, tzinfo=timezone.utc)) == "2026-Q4"


def test_normalize_period_rejects_unknown():
    with pytest.raises(ValueError):
        normalize_period("fortnight")


def test_category_breakdown_includes_all_scored_keys():
    result = _score_result(70.0, {"security": 80.0, "seo": 50.0})
    bd = category_breakdown_from_scores(result)
    assert bd["security"] == 80.0
    assert bd["seo"] == 50.0
    assert "domain_identity" in bd
    assert "monitoring" not in bd
    assert len(bd) == 8


def test_comparison_has_history_false_with_one_row():
    mock_conn = MagicMock()
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)
    mock_conn.execute.return_value.fetchall.return_value = [
        _row(
            when=datetime(2026, 7, 24, tzinfo=timezone.utc),
            overall=73.0,
            security=70.0,
        )
    ]
    with patch("app.services.historical.get_connection", return_value=mock_conn):
        data = get_comparison_for_domain("dom-1", period="month")
    assert data["has_history"] is False
    assert data["requested_period"] == "month"
    assert data["available_periods"] == []


def test_comparison_picks_closest_snapshot_at_or_before_target():
    """
    Current: 2026-07-24. Period month → target ~2026-06-24.
    Snapshots: Jul 24, Jun 18, May 1 → should pick Jun 18.
    """
    rows = [
        _row(
            when=datetime(2026, 7, 24, tzinfo=timezone.utc),
            overall=73.0,
            security=60.0,
        ),
        _row(
            when=datetime(2026, 6, 18, tzinfo=timezone.utc),
            overall=81.0,
            security=80.0,
        ),
        _row(
            when=datetime(2026, 5, 1, tzinfo=timezone.utc),
            overall=70.0,
            security=75.0,
        ),
    ]
    mock_conn = MagicMock()
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)
    mock_conn.execute.return_value.fetchall.return_value = rows

    with patch("app.services.historical.get_connection", return_value=mock_conn):
        data = get_comparison_for_domain("dom-1", period="month")

    assert data["has_history"] is True
    assert data["requested_period"] == "month"
    assert data["current"]["date"] == "2026-07-24"
    assert data["compared_to"]["date"] == "2026-06-18"
    assert data["delta"]["overall"] == -8.0
    assert data["delta"]["category_breakdown"]["security"] == -20.0
    assert "month" in data["available_periods"]


def test_available_periods_require_prior_snapshot():
    rows = [
        _row(
            when=datetime(2026, 7, 24, tzinfo=timezone.utc),
            overall=73.0,
            security=60.0,
        ),
        _row(
            when=datetime(2026, 7, 10, tzinfo=timezone.utc),
            overall=71.0,
            security=58.0,
        ),
    ]
    mock_conn = MagicMock()
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)
    mock_conn.execute.return_value.fetchall.return_value = rows

    with patch("app.services.historical.get_connection", return_value=mock_conn):
        avail = available_periods_for_domain("dom-1")

    assert "week" in avail["available_periods"]
    assert "biweek" in avail["available_periods"]
    # 14 days back from Jul 24 is Jul 10 exactly — at_or_before includes it
    assert "month" not in avail["available_periods"]
    assert "year" not in avail["available_periods"]
