"""Phase 5 AI layer — narrative and domain semantic judgment (mocked Anthropic)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from app.checks.domain_semantic import run_domain_semantic_check
from app.checks.fetcher import FetchResult
from app.checks.page import PageSnapshot
from app.schemas.findings import Finding, FindingStatus
from app.services.ai.client import parse_json_object
from app.services.ai.domain_semantic import judge_domain_semantic_relevance
from app.services.ai.narrative import generate_scan_narrative
from app.services.scoring import CategoryScore, ScoreResult


def test_parse_json_object_raw_and_fenced():
    assert parse_json_object('{"status":"pass","justification":"ok"}') == {
        "status": "pass",
        "justification": "ok",
    }
    assert parse_json_object('Here:\n```json\n{"status":"fail","justification":"no"}\n```') == {
        "status": "fail",
        "justification": "no",
    }


def test_judge_domain_semantic_pass_fail_flag():
    with patch(
        "app.services.ai.domain_semantic.complete_text",
        return_value='{"status":"pass","justification":"ict.go.ke matches ICT Authority"}',
    ):
        j = judge_domain_semantic_relevance(
            url="https://www.ict.go.ke",
            stated_purpose="ICT Authority · agency",
            page_title="ICT Authority",
        )
    assert j.status == "pass"
    assert j.model_used is True
    assert "ICT" in j.justification

    with patch(
        "app.services.ai.domain_semantic.complete_text",
        return_value='{"status":"fail","justification":"Domain does not relate to purpose"}',
    ):
        j = judge_domain_semantic_relevance(url="https://random.go.ke", stated_purpose="Health")
    assert j.status == "fail"

    with patch("app.services.ai.domain_semantic.complete_text", return_value=None):
        j = judge_domain_semantic_relevance(url="https://www.ict.go.ke")
    assert j.status == "flag"
    assert j.model_used is False


def test_run_domain_semantic_check_maps_statuses():
    snap = PageSnapshot(
        request_url="https://www.ict.go.ke/",
        fetch=FetchResult(
            url="https://www.ict.go.ke/",
            final_url="https://www.ict.go.ke/",
            status_code=200,
            headers={"content-type": "text/html"},
            text="<html><head><title>ICT Authority</title>"
            "<meta name='description' content='Kenya ICT'></head></html>",
            elapsed_ms=10,
        ),
    )

    with (
        patch(
            "app.checks.domain_semantic._lookup_org_context",
            return_value={
                "org_name": "ICT Authority",
                "org_type": "agency",
                "org_sector": "ICT",
                "registered_name": None,
                "stated_purpose": "ICT Authority · agency · ICT",
            },
        ),
        patch(
            "app.checks.domain_semantic.judge_domain_semantic_relevance",
            return_value=MagicMock(
                status="pass",
                justification="Domain matches org purpose",
                model_used=True,
            ),
        ),
    ):
        findings = run_domain_semantic_check("https://www.ict.go.ke", snap)

    assert len(findings) == 1
    f = findings[0]
    assert f.check_name == "domain_semantic_relevance"
    assert f.status == FindingStatus.pass_
    assert f.detail["reason"] == "Domain matches org purpose"
    assert f.detail["ai_model_used"] is True

    with (
        patch(
            "app.checks.domain_semantic._lookup_org_context",
            return_value={
                "org_name": None,
                "org_type": None,
                "org_sector": None,
                "registered_name": None,
                "stated_purpose": None,
            },
        ),
        patch(
            "app.checks.domain_semantic.judge_domain_semantic_relevance",
            return_value=MagicMock(
                status="flag",
                justification="Unknown purpose",
                model_used=False,
            ),
        ),
    ):
        findings = run_domain_semantic_check("https://www.ict.go.ke", snap)
    assert findings[0].status == FindingStatus.manual_review
    assert findings[0].detail["requires_manual_review"] is True


def test_generate_scan_narrative_uses_structured_findings():
    findings = [
        Finding(
            category="security",
            check_name="https_enforced",
            clause_reference="6.4.22",
            status=FindingStatus.fail,
            severity="high",
            automatability_type="A",
            detail={"reason": "HTTP still reachable"},
        ),
        Finding(
            category="accessibility",
            check_name="img_alt",
            clause_reference="6.4.9",
            status=FindingStatus.fail,
            severity="medium",
            automatability_type="A",
            detail={"reason": "3 images missing alt"},
        ),
    ]
    scores = ScoreResult(
        overall_score=62.5,
        categories=[
            CategoryScore(
                category="security",
                weight=30,
                score=40,
                pass_count=2,
                fail_count=1,
                manual_review_count=0,
                scorable_count=3,
            )
        ],
        weights_source="defaults",
    )

    with patch(
        "app.services.ai.narrative.complete_text",
        return_value=(
            "The site scores 62.5% overall, with a critical HTTPS gap. "
            "Several images also lack alt text, which hurts accessibility."
        ),
    ) as mock_complete:
        text = generate_scan_narrative("https://www.ict.go.ke", findings, scores)

    assert text is not None
    assert "HTTPS" in text or "62.5" in text or "accessibility" in text.lower()
    assert mock_complete.called
    user_prompt = mock_complete.call_args.kwargs["user"]
    assert "https_enforced" in user_prompt
    assert "img_alt" in user_prompt


def test_generate_scan_narrative_none_when_ai_unavailable():
    with patch("app.services.ai.narrative.complete_text", return_value=None):
        assert generate_scan_narrative("https://www.ict.go.ke", []) is None
