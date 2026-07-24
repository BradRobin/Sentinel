# Emit manual_review findings for every P/M checklist item not covered by automatable modules.
# SRS: never silently omit a check the system can't verify.
# domain_semantic_relevance is handled by checks.domain_semantic (Phase 5 LLM).

from __future__ import annotations

from app.schemas.findings import Finding, FindingStatus

# (check_name, clause, category, automatability, severity, reason)
_MANUAL_OR_PARTIAL: list[tuple[str, str, str, str, str, str]] = [
    (
        "domain_not_personal_name",
        "6.4.4",
        "domain_identity",
        "P",
        "low",
        "Partial — name-likeness heuristics deferred to Phase 5 LLM assist",
    ),
    (
        "db_isolation",
        "6.4.22",
        "security",
        "M",
        "high",
        "Requires attestation of backend architecture — not observable from public HTML",
    ),
    (
        "no_malicious_code",
        "6.4.22",
        "security",
        "P",
        "high",
        "Partial — malware/compromise scan not in v1; flag for manual review",
    ),
    (
        "cms_patched",
        "6.4.22",
        "security",
        "P",
        "medium",
        "Partial — CMS fingerprinting/patch level needs enrichment",
    ),
    (
        "vuln_scanning_process",
        "6.4.22",
        "security",
        "M",
        "medium",
        "Organizational process attestation — not detectable remotely",
    ),
    (
        "image_link_alt",
        "6.4.9",
        "accessibility",
        "P",
        "medium",
        "Partial — destination-quality of image-link alt needs judgment",
    ),
    (
        "media_captions",
        "6.4.9",
        "accessibility",
        "P",
        "medium",
        "Partial — caption/transcript quality needs manual or deeper media analysis",
    ),
    (
        "embedded_video_alt",
        "6.4.9",
        "accessibility",
        "P",
        "medium",
        "Partial — linked alternative for embedded video needs manual confirmation",
    ),
    (
        "no_flashing",
        "6.4.9",
        "accessibility",
        "P",
        "high",
        "Partial — strobe/flash detection needs rendered timeline (Playwright)",
    ),
    (
        "responsive_mobile",
        "6.4.20",
        "accessibility",
        "P",
        "medium",
        "Partial — viewport checks need multi-width rendering",
    ),
    (
        "server_side_scripting",
        "6.4.11",
        "design_branding",
        "P",
        "low",
        "Partial — preference for server-side scripting is architectural",
    ),
    (
        "coat_of_arms",
        "6.4.12",
        "design_branding",
        "P",
        "medium",
        "Partial — official banner/coat-of-arms image matching deferred (v2)",
    ),
    (
        "g4c_index_structure",
        "6.4.13",
        "design_branding",
        "M",
        "medium",
        "Manual — G4C/G4B/G2G landing structure requires human review",
    ),
    (
        "images_not_distorted",
        "6.4.16",
        "multimedia_performance",
        "M",
        "low",
        "Manual — visual distortion requires human or vision model review",
    ),
    (
        "copyright_attribution",
        "6.4.19",
        "legal_content",
        "M",
        "low",
        "Manual — non-GoK content attribution needs content review",
    ),
    (
        "content_freshness",
        "6.4.19",
        "legal_content",
        "P",
        "low",
        "Partial — Last-Modified/recency heuristics deferred",
    ),
]


def emit_manual_review_findings() -> list[Finding]:
    return [
        Finding(
            category=category,
            check_name=check_name,
            clause_reference=clause,
            status=FindingStatus.manual_review,
            severity=severity,  # type: ignore[arg-type]
            automatability_type=auto,  # type: ignore[arg-type]
            detail={"reason": reason, "requires_manual_review": True},
        )
        for check_name, clause, category, auto, severity, reason in _MANUAL_OR_PARTIAL
    ]
