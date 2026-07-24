"""SSRF protection — mandatory before any outbound fetch to user-supplied URLs."""

from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urlparse


class SSRFError(Exception):
    """Raised when a URL fails SSRF validation."""


@dataclass(frozen=True)
class ValidatedURL:
    original: str
    hostname: str
    scheme: str
    port: int | None


_BLOCKED_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.0.0.0/24"),
    ipaddress.ip_network("192.0.2.0/24"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("198.18.0.0/15"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]

# Cloud metadata endpoint — explicitly blocked per SRS §3.3
_METADATA_IPS = {ipaddress.ip_address("169.254.169.254")}


def _is_blocked_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if ip in _METADATA_IPS:
        return True
    return any(ip in network for network in _BLOCKED_NETWORKS)


def _hostname_allowed(hostname: str, allowed_tlds: list[str], allow_bypass: bool) -> None:
    host = hostname.lower().rstrip(".")
    if allow_bypass:
        return
    if not any(host.endswith(tld) for tld in allowed_tlds):
        raise SSRFError(
            f"Domain '{hostname}' is not allowed. Scans are restricted to: {', '.join(allowed_tlds)}"
        )


def _resolve_and_validate_ips(hostname: str) -> None:
    try:
        addr_infos = socket.getaddrinfo(hostname, None, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise SSRFError(f"Unable to resolve hostname '{hostname}': {exc}") from exc

    if not addr_infos:
        raise SSRFError(f"No DNS records found for '{hostname}'")

    for info in addr_infos:
        ip_str = info[4][0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError as exc:
            raise SSRFError(f"Invalid resolved IP address: {ip_str}") from exc
        if _is_blocked_ip(ip):
            raise SSRFError(f"Resolved IP {ip} for '{hostname}' is in a blocked range")


def validate_scan_url(
    url: str,
    *,
    allowed_tlds: list[str] | None = None,
    allow_tld_bypass: bool = False,
    resolve_dns: bool = True,
) -> ValidatedURL:
    """
    Validate a user-submitted URL before any fetch.

    Steps: parse → TLD allowlist → (optional) DNS resolve → private/metadata IP rejection.

    ``resolve_dns=False`` is for same-origin auxiliary probes after the landing page
    was already fully validated — skips a second getaddrinfo round-trip.
    """
    if not url or not url.strip():
        raise SSRFError("URL is required")

    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https"):
        raise SSRFError("Only http and https URLs are allowed")
    if parsed.username or parsed.password:
        raise SSRFError("URLs with embedded credentials are not allowed")
    if not parsed.hostname:
        raise SSRFError("URL must include a valid hostname")

    hostname = parsed.hostname.lower()
    if hostname == "localhost" or hostname.endswith(".local"):
        raise SSRFError(f"Hostname '{hostname}' is not allowed")

    tlds = allowed_tlds or [".go.ke", ".gov.ke"]
    _hostname_allowed(hostname, tlds, allow_tld_bypass)
    if resolve_dns:
        _resolve_and_validate_ips(hostname)

    return ValidatedURL(
        original=url.strip(),
        hostname=hostname,
        scheme=parsed.scheme,
        port=parsed.port,
    )


def normalize_url_for_lock(url: str) -> str:
    """Normalize URL for idempotency lock keys."""
    validated = validate_scan_url(url)
    port_suffix = f":{validated.port}" if validated.port else ""
    default_port = 443 if validated.scheme == "https" else 80
    if validated.port in (None, default_port):
        port_suffix = ""
    return f"{validated.scheme}://{validated.hostname}{port_suffix}"
