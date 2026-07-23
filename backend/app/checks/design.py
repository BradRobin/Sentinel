# Clauses 6.4.6, 6.4.7 — Design / fonts heuristics (A)

from __future__ import annotations

import re
from html.parser import HTMLParser

from app.checks.page import PageSnapshot
from app.schemas.findings import Finding, FindingStatus

_APPROVED_SANS = {
    "arial", "helvetica", "verdana", "tahoma", "trebuchet", "segoe ui",
    "system-ui", "sans-serif", "open sans", "roboto", "lato", "source sans",
    "noto sans", "ubuntu", "montserrat", "inter", "geist",
}


class _DesignParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.external_stylesheets = 0
        self.inline_style_attrs = 0
        self.style_blocks = 0
        self.font_families: set[str] = set()
        self._in_style = False
        self._style_buf = ""

    def handle_starttag(self, tag: str, attrs) -> None:
        attr = {k.lower(): (v or "") for k, v in attrs}
        t = tag.lower()
        if t == "link" and "stylesheet" in attr.get("rel", "").lower():
            self.external_stylesheets += 1
        if "style" in attr and attr["style"].strip():
            self.inline_style_attrs += 1
            self._extract_fonts(attr["style"])
        if t == "style":
            self._in_style = True
            self._style_buf = ""

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "style" and self._in_style:
            self.style_blocks += 1
            self._extract_fonts(self._style_buf)
            self._in_style = False

    def handle_data(self, data: str) -> None:
        if self._in_style:
            self._style_buf += data

    def _extract_fonts(self, css: str) -> None:
        for m in re.finditer(r"font-family\s*:\s*([^;}{]+)", css, re.I):
            raw = m.group(1)
            for part in raw.split(","):
                name = part.strip().strip("'\"").lower()
                if name and name not in ("inherit", "initial", "unset"):
                    self.font_families.add(name)


def run_design_checks(snap: PageSnapshot) -> list[Finding]:
    findings: list[Finding] = []
    if not snap.ok:
        for name, clause in (("external_css", "6.4.6"), ("font_limit", "6.4.7")):
            findings.append(
                Finding(
                    category="design_branding",
                    check_name=name,
                    clause_reference=clause,
                    status=FindingStatus.fail,
                    severity="low",
                    automatability_type="A",
                    detail={"error": snap.error or "Page fetch failed"},
                )
            )
        return findings

    parser = _DesignParser()
    try:
        parser.feed(snap.html[:500_000])
    except Exception as exc:
        findings.append(
            Finding(
                category="design_branding",
                check_name="external_css",
                clause_reference="6.4.6",
                status=FindingStatus.fail,
                severity="low",
                automatability_type="A",
                detail={"error": str(exc)},
            )
        )
        return findings

    # Excessive inline = many style= attrs relative to external sheets
    excessive_inline = parser.inline_style_attrs > 25 and parser.external_stylesheets == 0
    uses_external = parser.external_stylesheets > 0 or parser.style_blocks > 0
    css_ok = uses_external and not excessive_inline

    findings.append(
        Finding(
            category="design_branding",
            check_name="external_css",
            clause_reference="6.4.6",
            status=FindingStatus.pass_ if css_ok else FindingStatus.fail,
            severity="low",
            automatability_type="A",
            detail={
                "external_stylesheets": parser.external_stylesheets,
                "style_blocks": parser.style_blocks,
                "inline_style_attrs": parser.inline_style_attrs,
                "excessive_inline": excessive_inline,
            },
        )
    )

    # ≤3 fonts; prefer approved sans-serif list
    fonts = sorted(parser.font_families)
    # Collapse generic families
    concrete = [f for f in fonts if f not in ("serif", "monospace", "cursive", "fantasy")]
    count_ok = len(concrete) <= 3
    unapproved = [
        f for f in concrete
        if not any(a in f or f in a for a in _APPROVED_SANS)
    ]
    font_ok = count_ok and len(unapproved) == 0

    findings.append(
        Finding(
            category="design_branding",
            check_name="font_limit",
            clause_reference="6.4.7",
            status=FindingStatus.pass_ if font_ok else FindingStatus.fail,
            severity="low",
            automatability_type="A",
            detail={
                "fonts_detected": concrete,
                "count": len(concrete),
                "max_allowed": 3,
                "unapproved": unapproved,
            },
        )
    )

    return findings
