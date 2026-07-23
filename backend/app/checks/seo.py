# Clause 6.4.17 — Meta title/description, robots.txt, sitemap.xml

from __future__ import annotations

import re
from html.parser import HTMLParser
from urllib.parse import urlparse

from app.checks.fetcher import fetch_path, fetch_url
from app.schemas.findings import Finding, FindingStatus


class _HeadParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title: str | None = None
        self.description: str | None = None
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = {k.lower(): (v or "") for k, v in attrs}
        if tag.lower() == "title":
            self._in_title = True
        if tag.lower() == "meta":
            name = attr.get("name", "").lower()
            if name == "description" and attr.get("content", "").strip():
                self.description = attr["content"].strip()

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            chunk = data.strip()
            if chunk:
                self.title = (self.title or "") + chunk


def _parse_head(html: str) -> tuple[str | None, str | None]:
    parser = _HeadParser()
    try:
        parser.feed(html[:500_000])
    except Exception:
        pass
    # Fallback regex if parser missed title
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
    return title, description


def run_seo_checks(
    url: str,
    *,
    allowed_tlds: list[str] | None = None,
    allow_tld_bypass: bool = False,
) -> list[Finding]:
    findings: list[Finding] = []
    parsed = urlparse(url)
    fetch_target = url if parsed.scheme == "https" else f"https://{parsed.netloc}/"

    try:
        page = fetch_url(
            fetch_target,
            allowed_tlds=allowed_tlds,
            allow_tld_bypass=allow_tld_bypass,
        )
    except Exception as exc:
        findings.append(
            Finding(
                category="seo",
                check_name="meta_tags",
                clause_reference="6.4.17",
                status=FindingStatus.fail,
                severity="low",
                automatability_type="A",
                detail={"error": str(exc)},
            )
        )
        findings.append(
            Finding(
                category="seo",
                check_name="robots_sitemap",
                clause_reference="6.4.17",
                status=FindingStatus.fail,
                severity="low",
                automatability_type="A",
                detail={"error": str(exc)},
            )
        )
        return findings

    title, description = _parse_head(page.text)
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

    robots = fetch_path(
        fetch_target,
        "/robots.txt",
        allowed_tlds=allowed_tlds,
        allow_tld_bypass=allow_tld_bypass,
    )
    sitemap = fetch_path(
        fetch_target,
        "/sitemap.xml",
        allowed_tlds=allowed_tlds,
        allow_tld_bypass=allow_tld_bypass,
    )
    robots_ok = robots is not None and robots.status_code == 200
    sitemap_ok = sitemap is not None and sitemap.status_code == 200

    findings.append(
        Finding(
            category="seo",
            check_name="robots_sitemap",
            clause_reference="6.4.17",
            status=FindingStatus.pass_
            if robots_ok and sitemap_ok
            else FindingStatus.fail,
            severity="low",
            automatability_type="A",
            detail={
                "robots_txt": {
                    "found": robots_ok,
                    "status_code": robots.status_code if robots else None,
                },
                "sitemap_xml": {
                    "found": sitemap_ok,
                    "status_code": sitemap.status_code if sitemap else None,
                },
            },
        )
    )

    return findings
