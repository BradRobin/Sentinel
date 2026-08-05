"""Page snapshot soft-continue behaviour — scans must still produce findings."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.checks.fetcher import FetchResult
from app.checks.page import load_page_snapshot
from app.core.ssrf import SSRFError
from app.services.scan_errors import ScanAbortError


def _fetch(
    *,
    status: int = 200,
    text: str = "<html></html>",
    headers: dict | None = None,
    url: str = "https://www.example.go.ke/",
) -> FetchResult:
    return FetchResult(
        url=url,
        final_url=url,
        status_code=status,
        headers={k.lower(): v for k, v in (headers or {}).items()},
        text=text,
        elapsed_ms=12.0,
    )


@patch("app.checks.page.check_tls_certificate")
@patch("app.checks.page.fetch_url")
def test_soft_continue_on_connect_error(mock_fetch, mock_cert):
    mock_cert.return_value = MagicMock(valid=False, expires_at=None, error="n/a")
    mock_fetch.side_effect = httpx.ConnectError("Connection refused")

    snap = load_page_snapshot("https://www.mod.go.ke")

    assert snap.ok is False
    assert snap.error == "unreachable"
    assert snap.fetch is None


@patch("app.checks.page.check_tls_certificate")
@patch("app.checks.page.fetch_url")
def test_soft_continue_on_cloudflare_403(mock_fetch, mock_cert):
    mock_cert.return_value = MagicMock(valid=True, expires_at=None, error=None)
    mock_fetch.side_effect = [
        _fetch(
            status=301,
            text="",
            headers={"location": "https://accounts.ecitizen.go.ke/"},
            url="https://www.ecitizen.go.ke/",
        ),
        _fetch(
            status=403,
            text="<html>cloudflare</html>",
            headers={"server": "cloudflare"},
            url="https://accounts.ecitizen.go.ke/",
        ),
    ]

    snap = load_page_snapshot("https://www.ecitizen.go.ke")

    assert snap.ok is False
    assert snap.error == "blocked_by_target"
    assert snap.status_code == 403
    assert snap.fetch is not None


@patch("app.checks.page.check_tls_certificate")
@patch("app.checks.page.fetch_url")
def test_follows_www_redirect_to_success(mock_fetch, mock_cert):
    mock_cert.return_value = MagicMock(valid=True, expires_at=None, error=None)
    mock_fetch.side_effect = [
        _fetch(
            status=301,
            text="",
            headers={"location": "https://www.mod.go.ke/"},
            url="https://mod.go.ke/",
        ),
        _fetch(
            status=200,
            text="<html><title>MOD</title></html>",
            url="https://www.mod.go.ke/",
        ),
    ]

    snap = load_page_snapshot("https://mod.go.ke")

    assert snap.ok is True
    assert snap.error is None
    assert snap.status_code == 200
    assert "MOD" in snap.html


@patch("app.checks.page.check_tls_certificate")
@patch("app.checks.page.fetch_url")
def test_dns_failure_soft_continues(mock_fetch, mock_cert):
    mock_cert.return_value = MagicMock(valid=False, expires_at=None, error="n/a")
    mock_fetch.side_effect = SSRFError("Unable to resolve hostname 'missing.go.ke'")

    snap = load_page_snapshot("https://missing.go.ke")

    assert snap.ok is False
    assert snap.error == "unreachable"


@patch("app.checks.page.check_tls_certificate")
@patch("app.checks.page.fetch_url")
def test_soft_continue_never_raises_scan_abort(mock_fetch, mock_cert):
    mock_cert.return_value = MagicMock(valid=False, expires_at=None, error="n/a")
    mock_fetch.side_effect = httpx.ConnectTimeout("timed out")

    # Must not raise — callers expect a snapshot so checks can emit findings
    try:
        snap = load_page_snapshot("https://www.example.go.ke")
    except ScanAbortError:
        pytest.fail("load_page_snapshot must soft-continue, not abort")

    assert snap.error == "timeout"
