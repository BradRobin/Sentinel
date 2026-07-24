"""Closed-set scan error categories and safe user-facing reasons.

Never return stack traces or raw exception text to API clients.
"""

from __future__ import annotations

from typing import Literal

ErrorCategory = Literal[
    "invalid_url",
    "domain_not_allowed",
    "unreachable",
    "blocked_by_target",
    "timeout",
    "duplicate_in_progress",
    "internal_error",
]

ERROR_CATEGORIES: frozenset[str] = frozenset(
    {
        "invalid_url",
        "domain_not_allowed",
        "unreachable",
        "blocked_by_target",
        "timeout",
        "duplicate_in_progress",
        "internal_error",
    }
)

# Short, officer-safe strings — never include exception details
SAFE_REASONS: dict[str, str] = {
    "invalid_url": "Enter a valid http or https URL",
    "domain_not_allowed": "Only .go.ke and .gov.ke domains can be scanned",
    "unreachable": "This site could not be reached",
    "blocked_by_target": "This site blocked the scan request",
    "timeout": "This scan took too long and was stopped",
    "duplicate_in_progress": "A scan for this URL is already in progress",
    "internal_error": "Something went wrong on our end",
}


class ScanAbortError(Exception):
    """Abort the whole scan — total failure only (not partial check errors)."""

    def __init__(self, category: str, *, reason: str | None = None) -> None:
        if category not in ERROR_CATEGORIES:
            category = "internal_error"
        self.category: str = category
        self.reason: str = reason or SAFE_REASONS[category]
        super().__init__(self.reason)


def safe_reason(category: str) -> str:
    return SAFE_REASONS.get(category, SAFE_REASONS["internal_error"])


def classify_ssrf_error(message: str) -> str:
    """Map SSRFError text to a closed error_category (submission-time)."""
    m = message.lower()
    if (
        "not allowed" in m
        or "restricted to" in m
        or "blocked range" in m
        or "localhost" in m
        or ".local" in m
    ):
        return "domain_not_allowed"
    if (
        "unable to resolve" in m
        or "no dns" in m
        or "name or service" in m
    ):
        return "unreachable"
    if (
        "url is required" in m
        or "only http" in m
        or "hostname" in m
        or "credentials" in m
        or "malformed" in m
    ):
        return "invalid_url"
    return "invalid_url"


def is_tls_failure(exc: BaseException) -> bool:
    name = type(exc).__name__.lower()
    msg = str(exc).lower()
    return (
        "ssl" in name
        or "tls" in name
        or "certificate" in msg
        or "ssl" in msg
        or "certificate_verify_failed" in msg
        or "sslerror" in msg
    )


def classify_fetch_failure(exc: BaseException) -> str:
    """Classify outbound fetch failures into closed categories."""
    if isinstance(exc, ScanAbortError):
        return exc.category

    name = type(exc).__name__.lower()
    msg = str(exc).lower()
    module = type(exc).__module__.lower()

    if (
        isinstance(exc, TimeoutError)
        or "timeout" in name
        or "timed out" in msg
        or "timeout" in msg
    ):
        return "timeout"

    if is_tls_failure(exc):
        # TLS issues are findings, not total abort — caller should soft-continue
        return "unreachable"

    if (
        "connecterror" in name
        or "connect" in name
        or "connection refused" in msg
        or "name or service" in msg
        or "nodename nor servname" in msg
        or "getaddrinfo" in msg
        or "unreachable" in msg
        or "network is unreachable" in msg
        or "failed to resolve" in msg
    ):
        return "unreachable"

    if "httpx" in module and ("connect" in name or "network" in name):
        return "unreachable"

    return "internal_error"


def looks_blocked(status_code: int | None, body: str = "", headers: dict | None = None) -> bool:
    """Heuristic: target actively blocked automated access."""
    if status_code in (401, 403, 429):
        return True
    if status_code == 503:
        lower = (body or "")[:2000].lower()
        if any(
            token in lower
            for token in ("captcha", "cloudflare", "access denied", "bot", "challenge")
        ):
            return True
    headers = headers or {}
    server = (headers.get("server") or "").lower()
    if status_code in (403, 503) and "cloudflare" in server:
        return True
    return False
