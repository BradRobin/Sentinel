"""Scoring engine unit tests."""

from app.schemas.findings import Finding, FindingStatus
from app.services.scoring import DEFAULT_WEIGHTS, compute_scores


def _f(category: str, status: FindingStatus, name: str = "check") -> Finding:
    return Finding(
        category=category,
        check_name=name,
        clause_reference="6.4.0",
        status=status,
        severity="medium",
        automatability_type="A",
        detail={},
    )


def test_category_and_overall_weighted_score():
    findings = [
        _f("security", FindingStatus.pass_, "a"),
        _f("security", FindingStatus.pass_, "b"),
        _f("security", FindingStatus.fail, "c"),
        _f("seo", FindingStatus.pass_, "m"),
        _f("seo", FindingStatus.fail, "n"),
        # manual review must not dilute category %
        _f("security", FindingStatus.manual_review, "m1"),
    ]
    weights = {"security": 30.0, "seo": 5.0}
    result = compute_scores(findings, weights=weights)

    by_cat = {c.category: c for c in result.categories}
    assert abs(by_cat["security"].score - (2 / 3) * 100) < 0.01
    assert abs(by_cat["seo"].score - 50.0) < 0.01
    # overall = (66.666*30 + 50*5) / 35
    expected = ((2 / 3) * 100 * 30 + 50 * 5) / 35
    assert abs(result.overall_score - expected) < 0.05


def test_monitoring_excluded_from_overall():
    findings = [
        _f("security", FindingStatus.pass_),
        _f("monitoring", FindingStatus.pass_),
        _f("monitoring", FindingStatus.fail),
    ]
    result = compute_scores(findings, weights={"security": 30.0})
    assert all(c.category != "monitoring" for c in result.categories)
    assert abs(result.overall_score - 100.0) < 0.01


def test_all_fail_is_zero():
    findings = [
        _f("legal_content", FindingStatus.fail, "a"),
        _f("legal_content", FindingStatus.fail, "b"),
    ]
    result = compute_scores(findings, weights={"legal_content": 12.0})
    assert result.overall_score == 0.0


def test_default_weights_keys():
    assert "security" in DEFAULT_WEIGHTS
    assert "monitoring" not in DEFAULT_WEIGHTS
    assert abs(sum(DEFAULT_WEIGHTS.values()) - 110.0) < 0.01  # 15+30+10+20+10+8+12+5
