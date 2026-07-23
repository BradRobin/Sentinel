"""Scan cache key and hit/miss helpers."""

from unittest.mock import MagicMock, patch

from app.services.scan_cache import cache_key_for_url, get_cached_scan, set_cached_scan


def test_cache_key_normalizes_host_and_scheme():
    assert cache_key_for_url("https://WWW.ICT.GO.KE/path?q=1") == (
        "scan:cache:https://www.ict.go.ke"
    )
    assert cache_key_for_url("https://www.ict.go.ke:443/") == (
        "scan:cache:https://www.ict.go.ke"
    )


def test_set_and_get_cached_scan():
    store: dict[str, str] = {}

    mock_redis = MagicMock()
    mock_redis.setex.side_effect = lambda k, _ttl, v: store.__setitem__(k, v)
    mock_redis.get.side_effect = lambda k: store.get(k)

    with patch("app.services.scan_cache.get_redis", return_value=mock_redis), patch(
        "app.services.scan_cache.get_fresh_scan_from_db", return_value=None
    ):
        set_cached_scan(
            "https://www.ict.go.ke",
            {
                "job_id": "abc",
                "url": "https://www.ict.go.ke",
                "result": {"findings": [], "finding_count": 0},
            },
        )
        hit = get_cached_scan("https://www.ict.go.ke/about")
        assert hit is not None
        assert hit["job_id"] == "abc"
        assert hit["cache_hit"] is True
        assert hit["status"] == "complete"
