"""Unit tests for quarterly historical scores and comparison math."""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from app.services.historical import (
    calendar_quarter,
    category_breakdown_from_scores,
    get_comparison_for_domain,
)
from app.services.scoring import CategoryScore, ScoreResult


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


def test_calendar_quarter_labels():
    assert calendar_quarter(datetime(2026, 1, 15, tzinfo=timezone.utc)) == "2026-Q1"
    assert calendar_quarter(datetime(2026, 4, 1, tzinfo=timezone.utc)) == "2026-Q2"
    assert calendar_quarter(datetime(2026, 7, 24, tzinfo=timezone.utc)) == "2026-Q3"
    assert calendar_quarter(datetime(2026, 12, 31, tzinfo=timezone.utc)) == "2026-Q4"


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
        {
            "quarter": "2026-Q3",
            "overall_score": 73.0,
            "category_breakdown": {"security": 70.0},
        }
    ]
    with patch("app.services.historical.get_connection", return_value=mock_conn):
        assert get_comparison_for_domain("dom-1") == {"has_history": False}


def test_comparison_delta_math():
    mock_conn = MagicMock()
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)
    mock_conn.execute.return_value.fetchall.return_value = [
        {
            "quarter": "2026-Q3",
            "overall_score": 73.0,
            "category_breakdown": {
                "security": 60.0,
                "accessibility": 90.0,
            },
        },
        {
            "quarter": "2026-Q1",  # skipped Q2 — still compare to last recorded
            "overall_score": 81.0,
            "category_breakdown": {
                "security": 80.0,
                "accessibility": 70.0,
            },
        },
    ]
    with patch("app.services.historical.get_connection", return_value=mock_conn):
        data = get_comparison_for_domain("dom-1")

    assert data["has_history"] is True
    assert data["current"]["quarter"] == "2026-Q3"
    assert data["previous"]["quarter"] == "2026-Q1"
    assert data["delta"]["overall"] == -8.0
    assert data["delta"]["category_breakdown"]["security"] == -20.0
    assert data["delta"]["category_breakdown"]["accessibility"] == 20.0
