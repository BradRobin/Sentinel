"""Tests for closed-set scan error classification."""

from concurrent.futures import TimeoutError as FuturesTimeout

import httpx

from app.services.scan_errors import (
    ScanAbortError,
    classify_fetch_failure,
    classify_ssrf_error,
    looks_blocked,
    safe_reason,
)
from app.workers.scan_tasks import classify_scan_failure


def test_classify_ssrf_domain_not_allowed():
    assert classify_ssrf_error("Domain 'x.com' is not allowed") == "domain_not_allowed"


def test_classify_ssrf_invalid_url():
    assert classify_ssrf_error("Only http and https URLs are allowed") == "invalid_url"


def test_classify_ssrf_unreachable_dns():
    assert (
        classify_ssrf_error("Unable to resolve hostname 'missing.go.ke'")
        == "unreachable"
    )


def test_safe_reason_never_leaks_raw():
    assert "Traceback" not in safe_reason("internal_error")
    assert safe_reason("timeout") == "This scan took too long and was stopped"


def test_classify_scan_failure_abort():
    cat, reason = classify_scan_failure(ScanAbortError("blocked_by_target"))
    assert cat == "blocked_by_target"
    assert reason == safe_reason("blocked_by_target")


def test_classify_scan_failure_timeout():
    cat, reason = classify_scan_failure(FuturesTimeout())
    assert cat == "timeout"
    assert "too long" in reason


def test_classify_scan_failure_hides_internal_message():
    cat, reason = classify_scan_failure(RuntimeError("secret stack path /var/app"))
    assert cat == "internal_error"
    assert "/var/app" not in reason


def test_looks_blocked():
    assert looks_blocked(403)
    assert looks_blocked(401)
    assert looks_blocked(429)
    assert not looks_blocked(200)
    assert looks_blocked(503, "<html>cloudflare captcha</html>")


def test_classify_fetch_connect():
    assert (
        classify_fetch_failure(httpx.ConnectError("Connection refused"))
        == "unreachable"
    )
