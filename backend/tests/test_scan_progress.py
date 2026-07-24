"""Progress callback order for scored categories."""

from unittest.mock import MagicMock, patch

from app.services.scan_runner import SCORED_PROGRESS_CATEGORIES, run_all_checks


def test_progress_reports_before_each_scored_category():
    events: list[tuple[str | None, list[str]]] = []

    def on_progress(current: str | None, completed: list[str]) -> None:
        events.append((current, list(completed)))

    empty = []
    with (
        patch("app.services.scan_runner.load_page_snapshot", return_value=MagicMock()),
        patch("app.services.scan_runner.run_domain_checks", return_value=empty),
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
