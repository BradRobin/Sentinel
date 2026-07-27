"""Legal and interoperability heuristic tests."""

from app.data.manual_check_registry import MANUAL_CHECK_DEFS, MANUAL_CHECK_NAMES
from app.checks.fetcher import FetchResult
from app.checks.interoperability import run_interoperability_checks
from app.checks.legal import run_legal_checks
from app.checks.page import PageSnapshot
from app.schemas.findings import FindingStatus


def _snap(html: str, headers: dict | None = None) -> PageSnapshot:
    return PageSnapshot(
        request_url="https://www.example.go.ke/",
        fetch=FetchResult(
            url="https://www.example.go.ke/",
            final_url="https://www.example.go.ke/",
            status_code=200,
            headers=headers
            or {"content-type": "text/html; charset=utf-8"},
            text=html,
            elapsed_ms=120,
        ),
    )


def test_privacy_and_disclaimer_detected():
    html = """
    <html><head><meta charset="utf-8"><title>Gov</title></head>
    <body><a href="/privacy-policy">Privacy Policy</a>
    <a href="/disclaimer">Disclaimer</a></body></html>
    """
    findings = {f.check_name: f for f in run_legal_checks(_snap(html))}
    assert findings["privacy_policy"].status == FindingStatus.pass_
    assert findings["disclaimer"].status == FindingStatus.pass_


def test_utf8_and_html_structure():
    html = """<!DOCTYPE html><html><head><meta charset="utf-8"><title>X</title></head>
    <body><p>Hi</p></body></html>"""
    findings = {f.check_name: f for f in run_interoperability_checks(_snap(html))}
    assert findings["utf8_encoding"].status == FindingStatus.pass_
    assert findings["html_validation"].status == FindingStatus.pass_


def test_manual_check_registry_lists_pm_items():
    assert len(MANUAL_CHECK_DEFS) == 16
    names = MANUAL_CHECK_NAMES
    assert "domain_semantic_relevance" not in names
    assert "db_isolation" in names
    assert "coat_of_arms" in names
