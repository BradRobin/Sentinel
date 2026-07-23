# Clause 6.4.8 — Interoperability (HTML structure + UTF-8)

from __future__ import annotations

import re
from html.parser import HTMLParser

from app.checks.page import PageSnapshot
from app.schemas.findings import Finding, FindingStatus


class _StructureParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.has_html = False
        self.has_head = False
        self.has_body = False
        self.unclosed: list[str] = []
        self._stack: list[str] = []
        self.void = {
            "area", "base", "br", "col", "embed", "hr", "img", "input",
            "link", "meta", "param", "source", "track", "wbr",
        }

    def handle_starttag(self, tag: str, attrs) -> None:
        t = tag.lower()
        if t == "html":
            self.has_html = True
        elif t == "head":
            self.has_head = True
        elif t == "body":
            self.has_body = True
        if t not in self.void:
            self._stack.append(t)

    def handle_endtag(self, tag: str) -> None:
        t = tag.lower()
        if t in self.void:
            return
        if self._stack and self._stack[-1] == t:
            self._stack.pop()
        elif t in self._stack:
            while self._stack and self._stack[-1] != t:
                self.unclosed.append(self._stack.pop())
            if self._stack:
                self._stack.pop()


def run_interoperability_checks(snap: PageSnapshot) -> list[Finding]:
    findings: list[Finding] = []
    if not snap.ok:
        for name in ("html_validation", "utf8_encoding"):
            findings.append(
                Finding(
                    category="interoperability",
                    check_name=name,
                    clause_reference="6.4.8",
                    status=FindingStatus.fail,
                    severity="medium",
                    automatability_type="A",
                    detail={"error": snap.error or "Page fetch failed"},
                )
            )
        return findings

    html = snap.html
    parser = _StructureParser()
    try:
        parser.feed(html[:500_000])
    except Exception as exc:
        findings.append(
            Finding(
                category="interoperability",
                check_name="html_validation",
                clause_reference="6.4.8",
                status=FindingStatus.fail,
                severity="medium",
                automatability_type="A",
                detail={"error": str(exc)},
            )
        )
    else:
        issues: list[str] = []
        if not parser.has_html:
            issues.append("missing <html>")
        if not parser.has_head:
            issues.append("missing <head>")
        if not parser.has_body:
            issues.append("missing <body>")
        if parser._stack:
            issues.append(f"unclosed tags: {parser._stack[:10]}")
        # Doctype optional but preferred for HTML5
        has_doctype = bool(re.search(r"<!doctype\s+html", html, re.I))
        findings.append(
            Finding(
                category="interoperability",
                check_name="html_validation",
                clause_reference="6.4.8",
                status=FindingStatus.pass_ if not issues else FindingStatus.fail,
                severity="medium",
                automatability_type="A",
                detail={
                    "interpreted_as": "HTML5 structural heuristics",
                    "has_doctype": has_doctype,
                    "issues": issues,
                },
            )
        )

    # UTF-8 encoding
    charset = None
    m = re.search(
        r'<meta[^>]+charset=["\']?([\w-]+)',
        html,
        re.I,
    )
    if m:
        charset = m.group(1).lower()
    else:
        m = re.search(
            r'<meta[^>]+content=["\'][^"\']*charset=([\w-]+)',
            html,
            re.I,
        )
        if m:
            charset = m.group(1).lower()
    content_type = snap.headers.get("content-type", "")
    if not charset and "charset=" in content_type.lower():
        charset = content_type.lower().split("charset=")[-1].split(";")[0].strip()

    # Prefer explicit UTF-8 declaration (meta or Content-Type)
    explicit = charset in ("utf-8", "utf8") or "utf-8" in content_type.lower()
    findings.append(
        Finding(
            category="interoperability",
            check_name="utf8_encoding",
            clause_reference="6.4.8",
            status=FindingStatus.pass_ if explicit else FindingStatus.fail,
            severity="low",
            automatability_type="A",
            detail={
                "declared_charset": charset,
                "content_type": content_type,
                "utf8_declared": explicit,
            },
        )
    )

    return findings
