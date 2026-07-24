"""Progress callback order for scored categories."""

from unittest.mock import MagicMock, patch

from app.schemas.findings import Finding, FindingStatus
from app.services.scan_runner import SCORED_PROGRESS_CATEGORIES, run_all_checks


def _finding(category: str, name: str) -> Finding:
    return Finding(
        category=category,
        check_name=name,
        clause_reference="6.4.0",
        status=FindingStatus.pass_,
        severity="low",
        automatability_type="A",
    )


def test_progress_reports_before_each_scored_category():
    events: list[tuple[str | None, list[str], list[Finding]]] = []

    def on_progress(
        current: str | None,
        completed: list[str],
        findings_so_far: list[Finding],
    ) -> None:
        events.append((current, list(completed), list(findings_so_far)))

    empty: list[Finding] = []
    with (
        patch("app.services.scan_runner.load_page_snapshot", return_value=MagicMock()),
        patch("app.services.scan_runner.run_domain_checks", return_value=empty),
        patch("app.services.scan_runner.run_domain_semantic_check", return_value=empty),
        patch("app.services.scan_runner.run_security_checks", return_value=empty),
        patch("app.services.scan_runner.run_interoperability_checks", return_value=empty),
        patch("app.services.scan_runner.run_accessibility_checks", return_value=empty),
        patch("app.services.scan_runner.run_design_checks", return_value=empty),
        patch("app.services.scan_runner.run_multimedia_checks", return_value=empty),
        patch("app.services.scan_runner.run_legal_checks", return_value=empty),
        patch("app.services.scan_runner.run_seo_checks", return_value=empty),
        patch("app.services.scan_runner.run_monitoring_checks", return_value=empty),
        patch("app.services.scan_runner.emit_manual_review_findings", return_value=empty),
    ):
        run_all_checks("https://www.ict.go.ke", on_progress=on_progress)

    # Two events per scored category: start (completed=prev) + finish (completed includes self)
    assert len(events) == len(SCORED_PROGRESS_CATEGORIES) * 2

    starts = events[0::2]
    finishes = events[1::2]

    for i, cat in enumerate(SCORED_PROGRESS_CATEGORIES):
        assert starts[i][0] == cat
        assert starts[i][1] == list(SCORED_PROGRESS_CATEGORIES[:i])
        assert finishes[i][0] == cat
        assert finishes[i][1] == list(SCORED_PROGRESS_CATEGORIES[: i + 1])

    # Monitoring never appears in progress keys
    assert all(e[0] != "monitoring" for e in events)
    assert all(e[0] != "manual_review" for e in events)


def test_progress_includes_findings_as_categories_complete():
    events: list[tuple[str | None, list[str], list[Finding]]] = []

    def on_progress(
        current: str | None,
        completed: list[str],
        findings_so_far: list[Finding],
    ) -> None:
        events.append((current, list(completed), list(findings_so_far)))

    domain = [_finding("domain_identity", "domain_tld")]
    security = [_finding("security", "https_valid_cert")]

    with (
        patch("app.services.scan_runner.load_page_snapshot", return_value=MagicMock()),
        patch("app.services.scan_runner.run_domain_checks", return_value=domain),
        patch("app.services.scan_runner.run_domain_semantic_check", return_value=[]),
        patch("app.services.scan_runner.run_security_checks", return_value=security),
        patch("app.services.scan_runner.run_interoperability_checks", return_value=[]),
        patch("app.services.scan_runner.run_accessibility_checks", return_value=[]),
        patch("app.services.scan_runner.run_design_checks", return_value=[]),
        patch("app.services.scan_runner.run_multimedia_checks", return_value=[]),
        patch("app.services.scan_runner.run_legal_checks", return_value=[]),
        patch("app.services.scan_runner.run_seo_checks", return_value=[]),
        patch("app.services.scan_runner.run_monitoring_checks", return_value=[]),
        patch("app.services.scan_runner.emit_manual_review_findings", return_value=[]),
    ):
        run_all_checks("https://www.ict.go.ke", on_progress=on_progress)

    # Before domain: no findings yet
    assert events[0][2] == []
    # After domain finish: domain findings present
    assert events[1][1] == ["domain_identity"]
    assert [f.check_name for f in events[1][2]] == ["domain_tld"]
    # After security finish: both categories
    assert events[3][1] == ["domain_identity", "security"]
    assert [f.check_name for f in events[3][2]] == ["domain_tld", "https_valid_cert"]
