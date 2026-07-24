"""Unit tests for MCDA registry helpers (no live DB)."""

from __future__ import annotations

from app.data.mcda_registry import MCDA_REGISTRY
from app.services.registry import _trend
from app.services.scan_repository import normalize_domain_url


def test_registry_seed_has_expected_size_and_types():
    assert len(MCDA_REGISTRY) >= 40
    types = {e["org_type"] for e in MCDA_REGISTRY}
    assert types == {"ministry", "agency", "county"}
    urls = [normalize_domain_url(e["url"]) for e in MCDA_REGISTRY]
    assert len(urls) == len(set(urls)), "duplicate normalized URLs in seed"


def test_registry_seed_urls_are_go_ke():
    for entry in MCDA_REGISTRY:
        host = normalize_domain_url(entry["url"]).split("://", 1)[-1]
        assert host.endswith(".go.ke") or host.endswith(".gov.ke"), entry["url"]
        assert entry["aliases"], entry["org_name"]


def test_trend_thresholds():
    assert _trend(80.0, 70.0) == "up"
    assert _trend(70.0, 80.0) == "down"
    assert _trend(80.0, 80.2) == "flat"
    assert _trend(None, 70.0) == "unknown"
    assert _trend(70.0, None) == "unknown"
