"""Weighted compliance scoring from configurable scoring_weights (SRS §5.2 / §6)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from app.core.database import get_connection
from app.schemas.findings import Finding, FindingStatus

logger = logging.getLogger(__name__)

# Fallback if DB unavailable — same as migration seed (monitoring excluded)
DEFAULT_WEIGHTS: dict[str, float] = {
    "domain_identity": 15.0,
    "security": 30.0,
    "interoperability": 10.0,
    "accessibility": 20.0,
    "design_branding": 10.0,
    "multimedia_performance": 8.0,
    "legal_content": 12.0,
    "seo": 5.0,
}


@dataclass
class CategoryScore:
    category: str
    weight: float
    score: float  # 0–100
    pass_count: int
    fail_count: int
    manual_review_count: int
    scorable_count: int


@dataclass
class ScoreResult:
    overall_score: float
    categories: list[CategoryScore]
    weights_source: str  # "database" | "defaults"

    def to_dict(self) -> dict[str, Any]:
        return {
            "overall_score": round(self.overall_score, 2),
            "weights_source": self.weights_source,
            "categories": [
                {
                    "category": c.category,
                    "weight": c.weight,
                    "score": round(c.score, 2),
                    "pass_count": c.pass_count,
                    "fail_count": c.fail_count,
                    "manual_review_count": c.manual_review_count,
                    "scorable_count": c.scorable_count,
                }
                for c in self.categories
            ],
        }


def load_scoring_weights() -> tuple[dict[str, float], str]:
    """Load category weights from scoring_weights table."""
    try:
        with get_connection() as conn:
            rows = conn.execute(
                "SELECT category, weight FROM scoring_weights ORDER BY category"
            ).fetchall()
        if rows:
            return {r["category"]: float(r["weight"]) for r in rows}, "database"
    except Exception as exc:
        logger.warning("Could not load scoring_weights from DB: %s", exc)
    return dict(DEFAULT_WEIGHTS), "defaults"


def _status_value(status: FindingStatus | str) -> str:
    if isinstance(status, FindingStatus):
        return status.value
    return str(status)


def compute_scores(
    findings: list[Finding],
    weights: dict[str, float] | None = None,
) -> ScoreResult:
    """
    Score automatable pass/fail findings per category; manual_review excluded from %.

    Category score = passes / (passes + fails) * 100
    Overall = weighted average of category scores using configured weights
    (only categories with at least one scorable A finding contribute).
    """
    if weights is None:
        weights, source = load_scoring_weights()
    else:
        source = "provided"

    by_cat: dict[str, list[Finding]] = {}
    for f in findings:
        by_cat.setdefault(f.category, []).append(f)

    categories: list[CategoryScore] = []
    weighted_sum = 0.0
    weight_total = 0.0

    # Score categories that appear in weights first, then any other with scorable findings
    ordered = list(weights.keys())
    for cat in by_cat:
        if cat not in ordered and cat != "monitoring":
            ordered.append(cat)

    for category in ordered:
        items = by_cat.get(category, [])
        if category == "monitoring":
            continue  # feeds trend dashboard, not per-scan score (SRS §6.9)

        passes = fails = manuals = 0
        for f in items:
            st = _status_value(f.status)
            if st == "pass":
                passes += 1
            elif st == "fail":
                fails += 1
            elif st == "manual_review":
                manuals += 1

        scorable = passes + fails
        if scorable == 0:
            # No automatable pass/fail — skip from overall (all manual or empty)
            if manuals > 0 or items:
                categories.append(
                    CategoryScore(
                        category=category,
                        weight=float(weights.get(category, 0.0)),
                        score=0.0,
                        pass_count=passes,
                        fail_count=fails,
                        manual_review_count=manuals,
                        scorable_count=0,
                    )
                )
            continue

        score = (passes / scorable) * 100.0
        weight = float(weights.get(category, 0.0))
        categories.append(
            CategoryScore(
                category=category,
                weight=weight,
                score=score,
                pass_count=passes,
                fail_count=fails,
                manual_review_count=manuals,
                scorable_count=scorable,
            )
        )
        if weight > 0:
            weighted_sum += score * weight
            weight_total += weight

    overall = (weighted_sum / weight_total) if weight_total > 0 else 0.0
    return ScoreResult(
        overall_score=overall,
        categories=categories,
        weights_source=source,
    )
