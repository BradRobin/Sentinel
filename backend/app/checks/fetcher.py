"""Safe HTTP fetch utilities — SSRF-validated, no automatic redirects."""

from __future__ import annotations

import ssl
import socket
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

import httpx

from app.core.ssrf import SSRFError, validate_scan_url

# Primary landing-page fetch (slow gov hosts need headroom)
DEFAULT_TIMEOUT = 15.0
# Auxiliary same-origin probes (robots.txt, sitemap, exposed paths)
AUX_TIMEOUT = 4.0
AUX_RETRIES = 1
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


@dataclass
class AuxFetchOutcome:
    """Result of a short same-origin probe with explicit timeout accounting."""

    result: FetchResult | None = None
    timed_out: bool = False
    error: str | None = None


def _header_map(headers: httpx.Headers) -> dict[str, str]:
    return {k.lower(): v for k, v in headers.items()}


def fetch_url(
    url: str,
    *,
    allowed_tlds: list[str] | None = None,
    allow_tld_bypass: bool = False,
    verify: bool = True,
    timeout: float = DEFAULT_TIMEOUT,
    resolve_dns: bool = True,
) -> FetchResult:
    """Fetch a URL after SSRF validation. Redirects are not followed."""
    validated = validate_scan_url(
        url,
        allowed_tlds=allowed_tlds,
        allow_tld_bypass=allow_tld_bypass,
        resolve_dns=resolve_dns,
    )
    start = datetime.now(timezone.utc)
    with httpx.Client(
        timeout=timeout,
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
    timeout: float = AUX_TIMEOUT,
    retries: int = AUX_RETRIES,
) -> FetchResult | None:
    """Fetch a path relative to the origin of base_url (legacy None-on-failure API)."""
    outcome = fetch_path_aux(
        base_url,
        path,
        allowed_tlds=allowed_tlds,
        allow_tld_bypass=allow_tld_bypass,
        timeout=timeout,
        retries=retries,
    )
    return outcome.result


def fetch_path_aux(
    base_url: str,
    path: str,
    *,
    allowed_tlds: list[str] | None = None,
    allow_tld_bypass: bool = False,
    timeout: float = AUX_TIMEOUT,
    retries: int = AUX_RETRIES,
) -> AuxFetchOutcome:
    """
    Same-origin path probe with a short timeout and a single retry.

    Skips a second DNS resolution (base URL was already SSRF-validated) but still
    enforces TLD / scheme rules and that the target host matches the base host.
    """
    parsed = urlparse(base_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    target = urljoin(origin + "/", path.lstrip("/"))
    target_host = (urlparse(target).hostname or "").lower()
    base_host = (parsed.hostname or "").lower()
    if not target_host or target_host != base_host:
        return AuxFetchOutcome(error="host_mismatch")

    attempts = max(0, retries) + 1
    last_timeout = False
    for attempt in range(attempts):
        try:
            result = fetch_url(
                target,
                allowed_tlds=allowed_tlds,
                allow_tld_bypass=allow_tld_bypass,
                timeout=timeout,
                resolve_dns=False,
            )
            return AuxFetchOutcome(result=result)
        except httpx.TimeoutException:
            last_timeout = True
            if attempt + 1 >= attempts:
                return AuxFetchOutcome(timed_out=True, error="timeout")
            continue
        except (SSRFError, httpx.HTTPError) as exc:
            return AuxFetchOutcome(error=type(exc).__name__)
    if last_timeout:
        return AuxFetchOutcome(timed_out=True, error="timeout")
    return AuxFetchOutcome(error="unknown")


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
