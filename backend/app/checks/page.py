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


def load_page_snapshot(
    url: str,
    *,
    allowed_tlds: list[str] | None = None,
    allow_tld_bypass: bool = False,
    probe_paths: list[str] | None = None,
) -> PageSnapshot:
    """
    Fetch the landing page once (SSRF-validated). Optionally probe sensitive paths.

    Redirects are not auto-followed; a single Location hop is followed after re-validation.
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
        result = fetch_url(
            target, allowed_tlds=allowed_tlds, allow_tld_bypass=allow_tld_bypass
        )
        # Follow one redirect hop if Location is same-site and SSRF-safe
        if result.status_code in (301, 302, 303, 307, 308):
            location = result.headers.get("location")
            if location:
                next_url = urljoin(result.final_url, location)
                try:
                    result = fetch_url(
                        next_url,
                        allowed_tlds=allowed_tlds,
                        allow_tld_bypass=allow_tld_bypass,
                    )
                except (SSRFError, httpx.HTTPError):
                    pass
        snap.fetch = result
    except (SSRFError, httpx.HTTPError) as exc:
        snap.error = str(exc)
        return snap

    for path in probe_paths or []:
        snap.path_probes[path] = fetch_path(
            target,
            path,
            allowed_tlds=allowed_tlds,
            allow_tld_bypass=allow_tld_bypass,
        )

    return snap
