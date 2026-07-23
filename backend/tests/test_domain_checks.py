"""Domain format check tests — no network."""

from app.checks.domain import run_domain_checks
from app.schemas.findings import FindingStatus


def test_valid_go_ke_domain_passes_format_checks():
    findings = run_domain_checks("https://www.ict.go.ke")
    by_name = {f.check_name: f for f in findings}
    assert by_name["domain_tld"].status == FindingStatus.pass_
    assert by_name["domain_length"].status == FindingStatus.pass_
    assert by_name["domain_not_numeric"].status == FindingStatus.pass_
    assert by_name["domain_format"].status == FindingStatus.pass_


def test_overlong_domain_fails_length():
    host = "a" * 35 + ".go.ke"  # > 40 chars total
    findings = run_domain_checks(f"https://{host}")
    by_name = {f.check_name: f for f in findings}
    assert by_name["domain_length"].status == FindingStatus.fail


def test_numeric_domain_fails():
    findings = run_domain_checks("https://123456.go.ke")
    by_name = {f.check_name: f for f in findings}
    assert by_name["domain_not_numeric"].status == FindingStatus.fail


def test_leading_hyphen_fails_format():
    findings = run_domain_checks("https://-bad.go.ke")
    by_name = {f.check_name: f for f in findings}
    assert by_name["domain_format"].status == FindingStatus.fail


def test_clause_references_match_standards():
    findings = run_domain_checks("https://www.ict.go.ke")
    for f in findings:
        assert f.clause_reference in ("6.4.4", "6.4.5")
