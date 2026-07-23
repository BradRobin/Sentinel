# Clause 6.4.16 — Multimedia & performance (A)

from __future__ import annotations

import re
from html.parser import HTMLParser
from urllib.parse import urljoin

import httpx

from app.checks.fetcher import DEFAULT_TIMEOUT, USER_AGENT
from app.checks.page import PageSnapshot
from app.core.ssrf import SSRFError, validate_scan_url
from app.schemas.findings import Finding, FindingStatus

# ICTA band: 3–18 seconds (interpreted as TTFB/document fetch for httpx-based check)
MIN_MS = 3000
MAX_MS = 18000
# Soft pass for very fast sites (<3s) with note — still within spirit of "acceptable load"
IMAGE_SIZE_WARN_BYTES = 500_000


class _MediaParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.images: list[dict] = []
        self.autoplay: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        attr = {k.lower(): (v or "") for k, v in attrs}
        t = tag.lower()
        if t == "img":
            self.images.append({"src": attr.get("src", ""), "alt": attr.get("alt")})
        if t in ("video", "audio"):
            if "autoplay" in attr:
                self.autoplay.append(t)
        if t == "source" and "autoplay" in attr:
            self.autoplay.append("source")


def run_multimedia_checks(
    snap: PageSnapshot,
    *,
    allowed_tlds: list[str] | None = None,
    allow_tld_bypass: bool = False,
) -> list[Finding]:
    findings: list[Finding] = []
    if not snap.ok or snap.fetch is None:
        for name in ("page_load_time", "image_optimization", "no_autoplay"):
            findings.append(
                Finding(
                    category="multimedia_performance",
                    check_name=name,
                    clause_reference="6.4.16",
                    status=FindingStatus.fail,
                    severity="medium",
                    automatability_type="A",
                    detail={"error": snap.error or "Page fetch failed"},
                )
            )
        return findings

    elapsed = snap.elapsed_ms or 0
    # Pass if under max; note if under min (fast is fine for modern sites)
    load_ok = elapsed <= MAX_MS
    findings.append(
        Finding(
            category="multimedia_performance",
            check_name="page_load_time",
            clause_reference="6.4.16",
            status=FindingStatus.pass_ if load_ok else FindingStatus.fail,
            severity="medium",
            automatability_type="A",
            detail={
                "elapsed_ms": round(elapsed, 1),
                "max_ms": MAX_MS,
                "standard_band_ms": [MIN_MS, MAX_MS],
                "note": "Measured as document fetch time (httpx), not full browser load",
            },
        )
    )

    parser = _MediaParser()
    try:
        parser.feed(snap.html[:500_000])
    except Exception:
        pass

    # Image optimization — HEAD/GET first few same-origin images for Content-Length
    oversized: list[dict] = []
    checked = 0
    base = snap.fetch.final_url
    for img in parser.images[:8]:
        src = img.get("src") or ""
        if not src or src.startswith("data:"):
            continue
        abs_url = urljoin(base, src)
        try:
            validate_scan_url(
                abs_url, allowed_tlds=allowed_tlds, allow_tld_bypass=allow_tld_bypass
            )
        except SSRFError:
            continue
        try:
            with httpx.Client(
                timeout=DEFAULT_TIMEOUT,
                follow_redirects=False,
                verify=True,
                headers={"User-Agent": USER_AGENT},
            ) as client:
                head = client.head(abs_url)
                size = head.headers.get("content-length")
                if size is None and head.status_code >= 400:
                    continue
                if size is None:
                    # lightweight GET range not always supported — skip
                    continue
                nbytes = int(size)
                checked += 1
                if nbytes > IMAGE_SIZE_WARN_BYTES:
                    oversized.append({"url": abs_url, "bytes": nbytes})
        except Exception:
            continue

    img_ok = len(oversized) == 0
    findings.append(
        Finding(
            category="multimedia_performance",
            check_name="image_optimization",
            clause_reference="6.4.16",
            status=FindingStatus.pass_ if img_ok else FindingStatus.fail,
            severity="low",
            automatability_type="A",
            detail={
                "images_found": len(parser.images),
                "images_checked": checked,
                "threshold_bytes": IMAGE_SIZE_WARN_BYTES,
                "oversized": oversized[:5],
            },
        )
    )

    autoplay_ok = len(parser.autoplay) == 0
    findings.append(
        Finding(
            category="multimedia_performance",
            check_name="no_autoplay",
            clause_reference="6.4.16",
            status=FindingStatus.pass_ if autoplay_ok else FindingStatus.fail,
            severity="medium",
            automatability_type="A",
            detail={"autoplay_elements": parser.autoplay},
        )
    )

    return findings
