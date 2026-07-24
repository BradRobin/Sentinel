"""Safe HTTP fetch utilities — SSRF-validated, no automatic redirects."""

from __future__ import annotations

import ssl
import socket
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

import httpx

from app.core.ssrf import SSRFError, validate_scan_url

DEFAULT_TIMEOUT = 15.0
USER_AGENT = "ICTA-Sentinel/0.1 (+https://ict.go.ke)"


@dataclass
class FetchResult:
    url: str
    final_url: str
    status_code: int
    headers: dict[str, str]
    text: str
    elapsed_ms: float


@dataclass
class CertInfo:
    valid: bool
    expires_at: str | None
    error: str | None


def _header_map(headers: httpx.Headers) -> dict[str, str]:
    return {k.lower(): v for k, v in headers.items()}


def fetch_url(
    url: str,
    *,
    allowed_tlds: list[str] | None = None,
    allow_tld_bypass: bool = False,
    verify: bool = True,
) -> FetchResult:
    """Fetch a URL after SSRF validation. Redirects are not followed."""
    validated = validate_scan_url(
        url, allowed_tlds=allowed_tlds, allow_tld_bypass=allow_tld_bypass
    )
    start = datetime.now(timezone.utc)
    with httpx.Client(
        timeout=DEFAULT_TIMEOUT,
        follow_redirects=False,
        verify=verify,
        headers={"User-Agent": USER_AGENT},
    ) as client:
        response = client.get(validated.original)
    elapsed = (datetime.now(timezone.utc) - start).total_seconds() * 1000
    return FetchResult(
        url=validated.original,
        final_url=str(response.url),
        status_code=response.status_code,
        headers=_header_map(response.headers),
        text=response.text,
        elapsed_ms=elapsed,
    )


def fetch_path(
    base_url: str,
    path: str,
    *,
    allowed_tlds: list[str] | None = None,
    allow_tld_bypass: bool = False,
) -> FetchResult | None:
    """Fetch a path relative to the origin of base_url."""
    parsed = urlparse(base_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    target = urljoin(origin + "/", path.lstrip("/"))
    try:
        return fetch_url(
            target, allowed_tlds=allowed_tlds, allow_tld_bypass=allow_tld_bypass
        )
    except (SSRFError, httpx.HTTPError):
        return None


def check_tls_certificate(hostname: str, port: int = 443) -> CertInfo:
    """Validate TLS certificate chain and expiry for hostname."""
    try:
        context = ssl.create_default_context()
        with socket.create_connection((hostname, port), timeout=DEFAULT_TIMEOUT) as sock:
            with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                cert = ssock.getpeercert()
        not_after = cert.get("notAfter")
        if not_after:
            expires = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z").replace(
                tzinfo=timezone.utc
            )
            if expires < datetime.now(timezone.utc):
                return CertInfo(
                    valid=False,
                    expires_at=expires.isoformat(),
                    error="Certificate expired",
                )
            return CertInfo(valid=True, expires_at=expires.isoformat(), error=None)
        return CertInfo(valid=True, expires_at=None, error=None)
    except Exception as exc:
        return CertInfo(valid=False, expires_at=None, error=str(exc))


def origin_https_url(url: str) -> str:
    parsed = urlparse(url)
    host = parsed.hostname or ""
    port = parsed.port
    default = port in (None, 443)
    suffix = "" if default else f":{port}"
    return f"https://{host}{suffix}/"
