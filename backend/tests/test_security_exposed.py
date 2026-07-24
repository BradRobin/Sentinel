"""Security check unit tests — exposed-path classification."""

from __future__ import annotations

from app.checks.fetcher import FetchResult
from app.checks.page import PageSnapshot
from app.checks.security import (
    _classify_path_exposure,
    _exposed_files_summary,
    run_security_checks,
)
from app.schemas.findings import FindingStatus


def _fetch(path: str, *, status: int, text: str) -> FetchResult:
    url = f"https://www.example.go.ke{path}"
    return FetchResult(
        url=url,
        final_url=url,
        status_code=status,
        headers={},
        text=text,
        elapsed_ms=50.0,
    )


def _snap(path_probes: dict[str, FetchResult | None]) -> PageSnapshot:
    return PageSnapshot(
        request_url="https://www.example.go.ke/",
        fetch=FetchResult(
            url="https://www.example.go.ke/",
            final_url="https://www.example.go.ke/",
            status_code=200,
            headers={"strict-transport-security": "max-age=31536000"},
            text="<html></html>",
            elapsed_ms=100.0,
        ),
        cert_valid=True,
        path_probes=path_probes,
    )


def test_classify_admin_redirect_is_redirect_kind():
    assert _classify_path_exposure("/wp-admin/", 302, "Moved") == "redirect"


def test_classify_env_content_is_content_kind():
    assert _classify_path_exposure("/.env", 200, "SECRET_KEY=abc\n") == "content"


def test_classify_404_not_exposed():
    assert _classify_path_exposure("/admin/", 404, "Not Found") is None


def test_redirect_only_is_manual_review_not_fail():
    snap = _snap(
        {
            "/wp-admin/": _fetch("/wp-admin/", status=302, text="a" * 79),
            "/admin/": _fetch("/admin/", status=302, text="b" * 76),
        }
    )
    findings = {f.check_name: f for f in run_security_checks(snap)}
    exposed = findings["no_exposed_files"]
    assert exposed.status == FindingStatus.manual_review
    assert exposed.severity == "medium"
    assert "redirect" in exposed.detail["summary"].lower()
    assert exposed.detail["redirect_exposed_count"] == 2
    assert exposed.detail["content_exposed_count"] == 0
    assert all(
        item["exposure_kind"] == "redirect" for item in exposed.detail["exposed"]
    )


def test_content_exposure_remains_high_fail():
    snap = _snap(
        {
            "/.env": _fetch("/.env", status=200, text="API_KEY=secret\n"),
        }
    )
    findings = {f.check_name: f for f in run_security_checks(snap)}
    exposed = findings["no_exposed_files"]
    assert exposed.status == FindingStatus.fail
    assert exposed.severity == "high"
    assert "real content" in exposed.detail["summary"].lower()
    assert exposed.detail["content_exposed_count"] == 1


def test_summary_explains_redirect_only_case():
    text = _exposed_files_summary(
        content=[],
        redirects=[{"path": "/admin/"}, {"path": "/wp-admin/"}],
    )
    assert "HTTP redirects" in text
    assert "not a confirmed open panel" in text
    assert "/admin/" in text
