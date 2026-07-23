"""Unit tests for accessibility HTML heuristics."""

from app.checks.accessibility import run_accessibility_checks
from app.checks.fetcher import FetchResult
from app.checks.page import PageSnapshot
from app.schemas.findings import FindingStatus


def _snap(html: str) -> PageSnapshot:
    return PageSnapshot(
        request_url="https://www.example.go.ke/",
        fetch=FetchResult(
            url="https://www.example.go.ke/",
            final_url="https://www.example.go.ke/",
            status_code=200,
            headers={"content-type": "text/html; charset=utf-8"},
            text=html,
            elapsed_ms=100,
        ),
    )


def test_alt_and_skip_nav_pass():
    html = """
    <html><head><title>T</title></head><body>
    <a href="#main">Skip to content</a>
    <img src="/a.png" alt="Coat of arms">
    <main id="main"><p>Hello</p></main>
    </body></html>
    """
    findings = {f.check_name: f for f in run_accessibility_checks(_snap(html))}
    assert findings["alt_tags_present"].status == FindingStatus.pass_
    assert findings["skip_nav"].status == FindingStatus.pass_


def test_missing_alt_fails():
    html = '<html><body><img src="/x.png"></body></html>'
    findings = {f.check_name: f for f in run_accessibility_checks(_snap(html))}
    assert findings["alt_tags_present"].status == FindingStatus.fail
