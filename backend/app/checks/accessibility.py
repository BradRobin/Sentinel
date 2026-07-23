# Clauses 6.4.9 — Accessibility automatable checks from static HTML (no Playwright yet)

from __future__ import annotations

import re
from html.parser import HTMLParser

from app.checks.page import PageSnapshot
from app.schemas.findings import Finding, FindingStatus


class _A11yParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.images: list[dict] = []
        self.tables: list[dict] = []
        self.inputs: list[dict] = []
        self.labels_for: set[str] = set()
        self.label_wrapping = 0
        self.skip_nav = False
        self._in_label = False
        self._in_table = False
        self._table_has_th = False
        self._in_a = False
        self._a_href = ""

    def handle_starttag(self, tag: str, attrs) -> None:
        attr = {k.lower(): (v or "") for k, v in attrs}
        t = tag.lower()

        if t == "img":
            self.images.append(
                {
                    "src": attr.get("src", ""),
                    "alt": None if "alt" not in attr else attr.get("alt", ""),
                    "role": attr.get("role", ""),
                    "class": attr.get("class", ""),
                    "in_link": self._in_a,
                }
            )
        if t in ("video", "audio", "embed", "object"):
            # treat missing title/aria as alt-like gap for media
            if t in ("video", "audio") and not attr.get("aria-label") and not attr.get("title"):
                self.images.append(
                    {
                        "src": attr.get("src", t),
                        "alt": None,
                        "role": t,
                        "class": "",
                        "in_link": False,
                    }
                )

        if t == "a":
            self._in_a = True
            self._a_href = attr.get("href", "")
            text_hint = (attr.get("aria-label") or "") + self._a_href
            if re.search(r"skip|main.?content|#main|#content", text_hint, re.I):
                self.skip_nav = True

        if t == "table":
            self._in_table = True
            self._table_has_th = False
        if t == "th" and self._in_table:
            self._table_has_th = True

        if t == "label":
            self._in_label = True
            if attr.get("for"):
                self.labels_for.add(attr["for"])

        if t in ("input", "select", "textarea"):
            itype = attr.get("type", "text").lower()
            if itype not in ("hidden", "submit", "button", "image", "reset"):
                self.inputs.append(
                    {
                        "id": attr.get("id", ""),
                        "name": attr.get("name", ""),
                        "type": itype,
                        "aria_label": attr.get("aria-label", ""),
                        "title": attr.get("title", ""),
                    }
                )

    def handle_endtag(self, tag: str) -> None:
        t = tag.lower()
        if t == "a":
            self._in_a = False
        if t == "table":
            self.tables.append({"has_th": self._table_has_th})
            self._in_table = False
        if t == "label":
            if self._in_label:
                self.label_wrapping += 1
            self._in_label = False

    def handle_data(self, data: str) -> None:
        if self._in_a and re.search(r"skip\s*(to|nav|navigation|main|content)", data, re.I):
            self.skip_nav = True


def run_accessibility_checks(snap: PageSnapshot) -> list[Finding]:
    findings: list[Finding] = []
    a_checks = (
        "alt_tags_present",
        "decorative_empty_alt",
        "table_headers",
        "form_labels",
        "skip_nav",
    )
    if not snap.ok:
        for name in a_checks:
            findings.append(
                Finding(
                    category="accessibility",
                    check_name=name,
                    clause_reference="6.4.9",
                    status=FindingStatus.fail,
                    severity="medium",
                    automatability_type="A",
                    detail={"error": snap.error or "Page fetch failed"},
                )
            )
        return findings

    parser = _A11yParser()
    try:
        parser.feed(snap.html[:500_000])
    except Exception as exc:
        for name in a_checks:
            findings.append(
                Finding(
                    category="accessibility",
                    check_name=name,
                    clause_reference="6.4.9",
                    status=FindingStatus.fail,
                    severity="medium",
                    automatability_type="A",
                    detail={"error": str(exc)},
                )
            )
        return findings

    missing_alt = [i for i in parser.images if i["alt"] is None and i.get("role") != "presentation"]
    findings.append(
        Finding(
            category="accessibility",
            check_name="alt_tags_present",
            clause_reference="6.4.9",
            status=FindingStatus.pass_ if not missing_alt else FindingStatus.fail,
            severity="high",
            automatability_type="A",
            detail={
                "images_total": len(parser.images),
                "missing_alt_count": len(missing_alt),
                "samples": [{"src": i["src"][:120]} for i in missing_alt[:5]],
            },
        )
    )

    # Decorative: role=presentation/none or class contains decorative → should have alt=""
    decorative_bad: list[dict] = []
    for i in parser.images:
        classes = (i.get("class") or "").lower()
        role = (i.get("role") or "").lower()
        is_decorative = role in ("presentation", "none") or "decorative" in classes or "icon" in classes
        if is_decorative and i["alt"] not in ("",):
            # if alt is None, already caught; if non-empty text on decorative, flag
            if i["alt"]:
                decorative_bad.append({"src": i["src"][:120], "alt": i["alt"][:80]})
    findings.append(
        Finding(
            category="accessibility",
            check_name="decorative_empty_alt",
            clause_reference="6.4.9",
            status=FindingStatus.pass_ if not decorative_bad else FindingStatus.fail,
            severity="low",
            automatability_type="A",
            detail={"decorative_with_nonempty_alt": decorative_bad[:5]},
        )
    )

    tables_bad = [t for t in parser.tables if not t["has_th"]]
    findings.append(
        Finding(
            category="accessibility",
            check_name="table_headers",
            clause_reference="6.4.9",
            status=FindingStatus.pass_
            if not parser.tables or not tables_bad
            else FindingStatus.fail,
            severity="medium",
            automatability_type="A",
            detail={
                "tables_total": len(parser.tables),
                "tables_missing_th": len(tables_bad),
            },
        )
    )

    unlabeled = []
    for inp in parser.inputs:
        if inp["aria_label"] or inp["title"]:
            continue
        if inp["id"] and inp["id"] in parser.labels_for:
            continue
        unlabeled.append({"name": inp["name"], "type": inp["type"], "id": inp["id"]})
    # wrapping labels are a weak signal — if many inputs and no labels at all, fail
    form_ok = len(unlabeled) == 0 or (
        len(parser.inputs) > 0 and len(parser.labels_for) + parser.label_wrapping >= len(parser.inputs)
    )
    if unlabeled and not form_ok:
        form_ok = False
    else:
        form_ok = len(unlabeled) == 0

    findings.append(
        Finding(
            category="accessibility",
            check_name="form_labels",
            clause_reference="6.4.9",
            status=FindingStatus.pass_ if form_ok else FindingStatus.fail,
            severity="medium",
            automatability_type="A",
            detail={
                "inputs": len(parser.inputs),
                "unlabeled": unlabeled[:8],
            },
        )
    )

    # Also detect skip links in raw HTML
    skip = parser.skip_nav or bool(
        re.search(
            r'href=["\'][^"\']*(#main|#content|#main-content)["\']|skip\s+to\s+(main\s+)?content',
            snap.html,
            re.I,
        )
    )
    findings.append(
        Finding(
            category="accessibility",
            check_name="skip_nav",
            clause_reference="6.4.9",
            status=FindingStatus.pass_ if skip else FindingStatus.fail,
            severity="medium",
            automatability_type="A",
            detail={"skip_navigation_detected": skip},
        )
    )

    return findings
