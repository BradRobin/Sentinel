"""Shared page snapshot for check modules — one SSRF-safe fetch, reused."""

from __future__ import annotations

from dataclasses import dataclass, field
from urllib.parse import urljoin, urlparse

import httpx

from app.checks.fetcher import (
    FetchResult,
    check_tls_certificate,
    fetch_path,
    fetch_url,
    origin_https_url,
)
from app.core.ssrf import SSRFError
from app.services.scan_errors import (
    ScanAbortError,
    classify_fetch_failure,
    classify_ssrf_error,
    is_tls_failure,
    looks_blocked,
)

# Same-site Location hops before giving up (gov portals often chain www → apex → login)
_MAX_REDIRECT_HOPS = 5
_REDIRECT_STATUSES = frozenset({301, 302, 303, 307, 308})


@dataclass
class PageSnapshot:
    request_url: str
    fetch: FetchResult | None = None
    error: str | None = None
    cert_valid: bool = False
    cert_expires_at: str | None = None
    cert_error: str | None = None
    path_probes: dict[str, FetchResult | None] = field(default_factory=dict)

    @property
    def html(self) -> str:
        return self.fetch.text if self.fetch else ""

    @property
    def headers(self) -> dict[str, str]:
        return self.fetch.headers if self.fetch else {}

    @property
    def status_code(self) -> int | None:
        return self.fetch.status_code if self.fetch else None

    @property
    def elapsed_ms(self) -> float | None:
        return self.fetch.elapsed_ms if self.fetch else None

    @property
    def ok(self) -> bool:
        return self.fetch is not None and self.error is None


def _normalize_scan_url(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme == "http":
        return origin_https_url(url)
    return url


def _fetch_with_optional_insecure(
    target: str,
    *,
    allowed_tlds: list[str] | None,
    allow_tld_bypass: bool,
    snap: PageSnapshot,
) -> FetchResult:
    """
    Fetch page content. TLS/cert failures degrade (retry insecure) so other
    categories can still run; DNS/connect failures raise ``ScanAbortError``
    for the caller to soft-continue.
    """
    try:
        return fetch_url(
            target,
            allowed_tlds=allowed_tlds,
            allow_tld_bypass=allow_tld_bypass,
            verify=True,
        )
    except httpx.HTTPError as exc:
        if is_tls_failure(exc):
            snap.cert_valid = False
            if not snap.cert_error:
                snap.cert_error = "TLS handshake or certificate verification failed"
            # Soft-continue: still collect HTML for non-TLS checks
            try:
                return fetch_url(
                    target,
                    allowed_tlds=allowed_tlds,
                    allow_tld_bypass=allow_tld_bypass,
                    verify=False,
                )
            except httpx.HTTPError as inner:
                category = classify_fetch_failure(inner)
                if category == "timeout":
                    raise ScanAbortError("timeout") from inner
                raise ScanAbortError("unreachable") from inner
        category = classify_fetch_failure(exc)
        if category == "timeout":
            raise ScanAbortError("timeout") from exc
        raise ScanAbortError("unreachable") from exc


def _soft_fail(snap: PageSnapshot, category: str, result: FetchResult | None = None) -> PageSnapshot:
    """Record a fetch-level problem and return so the check suite can still run."""
    if result is not None:
        snap.fetch = result
    snap.error = category
    return snap


def load_page_snapshot(
    url: str,
    *,
    allowed_tlds: list[str] | None = None,
    allow_tld_bypass: bool = False,
    probe_paths: list[str] | None = None,
) -> PageSnapshot:
    """
    Fetch the landing page once (SSRF-validated). Optionally probe sensitive paths.

    Redirects are followed hop-by-hop (each Location re-validated for SSRF).

    Fetch failures (unreachable, timeout, WAF blocks) soft-continue: the snapshot
    carries ``error`` and checks still run (domain/DNS/TLS findings, fail-closed
    HTML checks). Only policy violations that abort submission use ``ScanAbortError``
    at the API layer — page load itself always returns a snapshot.
    """
    target = _normalize_scan_url(url)
    parsed = urlparse(target)
    hostname = parsed.hostname or ""
    snap = PageSnapshot(request_url=target)

    cert = check_tls_certificate(hostname)
    snap.cert_valid = cert.valid
    snap.cert_expires_at = cert.expires_at
    snap.cert_error = cert.error

    try:
        result = _fetch_with_optional_insecure(
            target,
            allowed_tlds=allowed_tlds,
            allow_tld_bypass=allow_tld_bypass,
            snap=snap,
        )
    except ScanAbortError as exc:
        return _soft_fail(snap, exc.category)
    except SSRFError as exc:
        category = classify_ssrf_error(str(exc))
        if category == "domain_not_allowed":
            # Still soft-continue: domain checks / scoring should report, not blank UI
            return _soft_fail(snap, category)
        return _soft_fail(snap, "unreachable" if category == "unreachable" else category)

    # Follow redirect chain (gov sites: apex → www → login portals)
    hops = 0
    while result.status_code in _REDIRECT_STATUSES and hops < _MAX_REDIRECT_HOPS:
        location = result.headers.get("location")
        if not location:
            break
        next_url = urljoin(result.final_url, location)
        try:
            result = _fetch_with_optional_insecure(
                next_url,
                allowed_tlds=allowed_tlds,
                allow_tld_bypass=allow_tld_bypass,
                snap=snap,
            )
        except ScanAbortError as exc:
            return _soft_fail(snap, exc.category, result)
        except SSRFError:
            break
        except httpx.HTTPError:
            break
        hops += 1

    if looks_blocked(result.status_code, result.text, result.headers):
        # Keep response body/headers for evidence; checks fail-closed on snap.error
        return _soft_fail(snap, "blocked_by_target", result)

    snap.fetch = result

    paths = list(probe_paths or [])
    if paths and snap.ok:
        # Short-timeout probes in parallel — don't serialize 15s waits per path
        from concurrent.futures import ThreadPoolExecutor, as_completed

        def _probe(path: str) -> tuple[str, FetchResult | None]:
            return path, fetch_path(
                target,
                path,
                allowed_tlds=allowed_tlds,
                allow_tld_bypass=allow_tld_bypass,
            )

        with ThreadPoolExecutor(max_workers=min(6, len(paths))) as pool:
            futures = [pool.submit(_probe, p) for p in paths]
            for fut in as_completed(futures):
                path, probe = fut.result()
                snap.path_probes[path] = probe

    return snap
