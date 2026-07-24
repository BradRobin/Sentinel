"""SEO check performance / timeout behaviour."""

from unittest.mock import MagicMock, patch

import httpx

from app.checks.fetcher import AUX_TIMEOUT, AuxFetchOutcome, FetchResult, fetch_path_aux
from app.checks.page import PageSnapshot
from app.checks.seo import _parse_head, run_seo_checks
from app.schemas.findings import FindingStatus


def test_parse_title_and_description():
    html = """
    <html><head>
    <title>ICT Authority</title>
    <meta name="description" content="Official ICTA website">
    </head></html>
    """
    title, desc, robots = _parse_head(html)
    assert title == "ICT Authority"
    assert desc == "Official ICTA website"
    assert robots is None


def test_missing_meta_fails_parse():
    html = "<html><head><title>Only Title</title></head></html>"
    title, desc, robots = _parse_head(html)
    assert title == "Only Title"
    assert desc is None
    assert robots is None


def _snap(html: str = "<html><head><title>T</title><meta name='description' content='D'></head></html>") -> PageSnapshot:
    return PageSnapshot(
        request_url="https://www.ict.go.ke/",
        fetch=FetchResult(
            url="https://www.ict.go.ke/",
            final_url="https://www.ict.go.ke/",
            status_code=200,
            headers={},
            text=html,
            elapsed_ms=10,
        ),
    )


def test_robots_timeout_marks_indexability_manual_review():
    timed_out = AuxFetchOutcome(timed_out=True, error="timeout")
    ok_sitemap = AuxFetchOutcome(
        result=FetchResult(
            url="https://www.ict.go.ke/sitemap.xml",
            final_url="https://www.ict.go.ke/sitemap.xml",
            status_code=200,
            headers={},
            text="<urlset></urlset>",
            elapsed_ms=5,
        )
    )
    with patch(
        "app.checks.seo._probe_seo_paths",
        return_value=(timed_out, ok_sitemap),
    ):
        findings = run_seo_checks(_snap())

    by_name = {f.check_name: f for f in findings}
    assert by_name["robots_sitemap"].status == FindingStatus.fail
    assert by_name["search_engine_indexed"].status == FindingStatus.manual_review
    assert by_name["search_engine_indexed"].detail["reason"] == "robots_txt_timeout"


def test_fetch_path_aux_retries_once_on_timeout():
    calls = {"n": 0}

    def boom(*_a, **_k):
        calls["n"] += 1
        raise httpx.TimeoutException("slow")

    with patch("app.checks.fetcher.fetch_url", side_effect=boom):
        out = fetch_path_aux(
            "https://www.ict.go.ke/",
            "/robots.txt",
            allow_tld_bypass=True,
            timeout=0.1,
            retries=1,
        )
    assert out.timed_out is True
    assert calls["n"] == 2  # initial + one retry
    assert AUX_TIMEOUT == 4.0


def test_seo_probes_run_in_parallel():
    """Both paths requested; wall time should not be sum of sequential waits."""
    seen: list[str] = []

    def fake_aux(base, path, **_kwargs):
        seen.append(path)
        return AuxFetchOutcome(
            result=FetchResult(
                url=f"https://www.ict.go.ke{path}",
                final_url=f"https://www.ict.go.ke{path}",
                status_code=404,
                headers={},
                text="",
                elapsed_ms=1,
            )
        )

    with patch("app.checks.seo.fetch_path_aux", side_effect=fake_aux):
        findings = run_seo_checks(_snap(), allow_tld_bypass=True)

    assert "/robots.txt" in seen
    assert "/sitemap.xml" in seen
    assert any(f.check_name == "robots_sitemap" for f in findings)
