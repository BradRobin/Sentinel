"""Canonical registry for officer-resolved manual / partial ICTA checks."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ManualCheckType = Literal["site_inspection", "institutional_attestation"]


@dataclass(frozen=True)
class ManualCheckDef:
    check_name: str
    clause_reference: str
    category: str
    check_type: ManualCheckType
    automatability_type: Literal["A", "P", "M"]
    severity: Literal["high", "medium", "low"]


MANUAL_CHECK_DEFS: tuple[ManualCheckDef, ...] = (
    ManualCheckDef(
        check_name="domain_not_personal_name",
        clause_reference="6.5.8",
        category="domain_identity",
        check_type="site_inspection",
        automatability_type="P",
        severity="low",
    ),
    ManualCheckDef(
        check_name="image_link_alt",
        clause_reference="6.5.12",
        category="accessibility",
        check_type="site_inspection",
        automatability_type="P",
        severity="medium",
    ),
    ManualCheckDef(
        check_name="media_captions",
        clause_reference="6.5.12",
        category="accessibility",
        check_type="site_inspection",
        automatability_type="P",
        severity="medium",
    ),
    ManualCheckDef(
        check_name="embedded_video_alt",
        clause_reference="6.5.12",
        category="accessibility",
        check_type="site_inspection",
        automatability_type="P",
        severity="medium",
    ),
    ManualCheckDef(
        check_name="no_flashing",
        clause_reference="6.5.12",
        category="accessibility",
        check_type="site_inspection",
        automatability_type="P",
        severity="high",
    ),
    ManualCheckDef(
        check_name="responsive_mobile",
        clause_reference="6.5.23",
        category="accessibility",
        check_type="site_inspection",
        automatability_type="P",
        severity="medium",
    ),
    ManualCheckDef(
        check_name="coat_of_arms",
        clause_reference="6.5.15",
        category="design_branding",
        check_type="site_inspection",
        automatability_type="P",
        severity="medium",
    ),
    ManualCheckDef(
        check_name="g4c_index_structure",
        clause_reference="6.5.16",
        category="design_branding",
        check_type="site_inspection",
        automatability_type="M",
        severity="medium",
    ),
    ManualCheckDef(
        check_name="images_not_distorted",
        clause_reference="6.5.19",
        category="multimedia_performance",
        check_type="site_inspection",
        automatability_type="M",
        severity="low",
    ),
    ManualCheckDef(
        check_name="copyright_attribution",
        clause_reference="6.5.22",
        category="legal_content",
        check_type="site_inspection",
        automatability_type="M",
        severity="low",
    ),
    ManualCheckDef(
        check_name="content_freshness",
        clause_reference="6.5.22",
        category="legal_content",
        check_type="site_inspection",
        automatability_type="P",
        severity="low",
    ),
    ManualCheckDef(
        check_name="db_isolation",
        clause_reference="6.5.25",
        category="security",
        check_type="institutional_attestation",
        automatability_type="M",
        severity="high",
    ),
    ManualCheckDef(
        check_name="no_malicious_code",
        clause_reference="6.5.25",
        category="security",
        check_type="institutional_attestation",
        automatability_type="P",
        severity="high",
    ),
    ManualCheckDef(
        check_name="cms_patched",
        clause_reference="6.5.25",
        category="security",
        check_type="institutional_attestation",
        automatability_type="P",
        severity="medium",
    ),
    ManualCheckDef(
        check_name="vuln_scanning_process",
        clause_reference="6.5.25",
        category="security",
        check_type="institutional_attestation",
        automatability_type="M",
        severity="medium",
    ),
    ManualCheckDef(
        check_name="server_side_scripting",
        clause_reference="6.5.14",
        category="design_branding",
        check_type="institutional_attestation",
        automatability_type="P",
        severity="low",
    ),
)

MANUAL_CHECK_NAMES: frozenset[str] = frozenset(d.check_name for d in MANUAL_CHECK_DEFS)
