# Clause 6.4.17 — Meta title/description, robots.txt, sitemap.xml, indexability

from __future__ import annotations

import re
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser

from app.checks.fetcher import AUX_TIMEOUT, AuxFetchOutcome, fetch_path_aux
from app.checks.page import PageSnapshot
from app.schemas.findings import Finding, FindingStatus


class _HeadParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title: str | None = None
        self.description: str | None = None
        self.robots_meta: str | None = None
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = {k.lower(): (v or "") for k, v in attrs}
        if tag.lower() == "title":
            self._in_title = True
        if tag.lower() == "meta":
            name = attr.get("name", "").lower()
            if name == "description" and attr.get("content", "").strip():
                self.description = attr["content"].strip()
            if name == "robots":
                self.robots_meta = attr.get("content", "").strip().lower()

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            chunk = data.strip()
            if chunk:
                self.title = (self.title or "") + chunk


def _parse_head(html: str) -> tuple[str | None, str | None, str | None]:
    parser = _HeadParser()
    try:
        parser.feed(html[:500_000])
    except Exception:
        pass
    title = parser.title
    if not title:
        m = re.search(r"<title[^>]*>([^<]+)</title>", html, re.I | re.S)
        title = m.group(1).strip() if m else None
    description = parser.description
    if not description:
        m = re.search(
            r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)',
            html,
            re.I,
        )
        description = m.group(1).strip() if m else None
    return title, description, parser.robots_meta


def _probe_seo_paths(
    base_url: str,
    *,
    allowed_tlds: list[str] | None,
    allow_tld_bypass: bool,
) -> tuple[AuxFetchOutcome, AuxFetchOutcome]:
    """Fetch robots.txt and sitemap.xml in parallel with short timeouts."""

    def _one(path: str) -> AuxFetchOutcome:
        return fetch_path_aux(
            base_url,
            path,
            allowed_tlds=allowed_tlds,
            allow_tld_bypass=allow_tld_bypass,
            timeout=AUX_TIMEOUT,
            retries=1,
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        robots_f = pool.submit(_one, "/robots.txt")
        sitemap_f = pool.submit(_one, "/sitemap.xml")
        # Bound wait: one attempt + one retry each, in parallel ≈ 2 * AUX_TIMEOUT
        robots = robots_f.result(timeout=AUX_TIMEOUT * 2 + 1)
        sitemap = sitemap_f.result(timeout=AUX_TIMEOUT * 2 + 1)
    return robots, sitemap


def run_seo_checks(
    snap: PageSnapshot,
    *,
    allowed_tlds: list[str] | None = None,
    allow_tld_bypass: bool = False,
) -> list[Finding]:
    findings: list[Finding] = []
    if not snap.ok:
        for name in ("meta_tags", "robots_sitemap", "search_engine_indexed"):
            findings.append(
                Finding(
                    category="seo",
                    check_name=name,
                    clause_reference="6.4.17",
                    status=FindingStatus.fail,
                    severity="low",
                    automatability_type="A",
                    detail={"error": snap.error or "Page fetch failed"},
                )
            )
        return findings

    title, description, robots_meta = _parse_head(snap.html)
    meta_ok = bool(title and description)
    findings.append(
        Finding(
            category="seo",
            check_name="meta_tags",
            clause_reference="6.4.17",
            status=FindingStatus.pass_ if meta_ok else FindingStatus.fail,
            severity="low",
            automatability_type="A",
            detail={
                "title": title,
                "description": description,
                "has_title": bool(title),
                "has_description": bool(description),
            },
        )
    )

    robots_out, sitemap_out = _probe_seo_paths(
        snap.request_url,
        allowed_tlds=allowed_tlds,
        allow_tld_bypass=allow_tld_bypass,
    )
    robots = robots_out.result
    sitemap = sitemap_out.result
    robots_ok = robots is not None and robots.status_code == 200
    sitemap_ok = sitemap is not None and sitemap.status_code == 200

    findings.append(
        Finding(
            category="seo",
            check_name="robots_sitemap",
            clause_reference="6.4.17",
            status=FindingStatus.pass_ if robots_ok and sitemap_ok else FindingStatus.fail,
            severity="low",
            automatability_type="A",
            detail={
                "robots_txt": {
                    "found": robots_ok,
                    "status_code": robots.status_code if robots else None,
                    "timed_out": robots_out.timed_out,
                },
                "sitemap_xml": {
                    "found": sitemap_ok,
                    "status_code": sitemap.status_code if sitemap else None,
                    "timed_out": sitemap_out.timed_out,
                },
            },
        )
    )

    # Indexability: local heuristics only (no live SERP). If robots.txt timed out,
    # don't block the category — mark this sub-check for manual review.
    x_robots = snap.headers.get("x-robots-tag", "").lower()
    noindex = (robots_meta and "noindex" in robots_meta) or ("noindex" in x_robots)

    if robots_out.timed_out and not robots_ok:
        findings.append(
            Finding(
                category="seo",
                check_name="search_engine_indexed",
                clause_reference="6.4.17",
                status=FindingStatus.manual_review,
                severity="low",
                automatability_type="P",
                detail={
                    "reason": "robots_txt_timeout",
                    "note": (
                        "robots.txt did not respond within the probe timeout; "
                        "confirm indexability manually"
                    ),
                    "robots_meta": robots_meta,
                    "x_robots_tag": x_robots or None,
                },
            )
        )
        return findings

    robots_disallow_all = False
    if robots_ok and robots:
        if re.search(
            r"(?m)^user-agent:\s*\*\s*$[\s\S]*?^disallow:\s*/\s*$",
            robots.text,
            re.I,
        ):
            robots_disallow_all = True

    indexable = not noindex and not robots_disallow_all
    findings.append(
        Finding(
            category="seo",
            check_name="search_engine_indexed",
            clause_reference="6.4.17",
            status=FindingStatus.pass_ if indexable else FindingStatus.fail,
            severity="low",
            automatability_type="A",
            detail={
                "indexable_signals": indexable,
                "robots_meta": robots_meta,
                "x_robots_tag": x_robots or None,
                "robots_disallow_all": robots_disallow_all,
                "note": "Heuristic indexability — not a live SERP confirmation",
            },
        )
    )

    return findings
