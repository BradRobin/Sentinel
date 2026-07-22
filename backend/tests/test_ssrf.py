"""SSRF validation unit tests."""

from unittest.mock import patch

import pytest

from app.core.ssrf import SSRFError, normalize_url_for_lock, validate_scan_url


class TestValidateScanURL:
    def test_valid_go_ke_url(self):
        with patch("app.core.ssrf.socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [(2, 1, 6, "", ("102.68.142.1", 0))]
            result = validate_scan_url("https://www.ict.go.ke")
            assert result.hostname == "www.ict.go.ke"
            assert result.scheme == "https"

    def test_valid_gov_ke_url(self):
        with patch("app.core.ssrf.socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [(2, 1, 6, "", ("102.68.142.1", 0))]
            result = validate_scan_url("https://example.gov.ke")
            assert result.hostname == "example.gov.ke"

    def test_rejects_non_go_ke_domain(self):
        with patch("app.core.ssrf.socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [(2, 1, 6, "", ("93.184.216.34", 0))]
            with pytest.raises(SSRFError, match="not allowed"):
                validate_scan_url("https://example.com")

    def test_rejects_private_ip_after_dns(self):
        with patch("app.core.ssrf.socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [(2, 1, 6, "", ("192.168.1.1", 0))]
            with pytest.raises(SSRFError, match="blocked range"):
                validate_scan_url("https://internal.go.ke")

    def test_rejects_metadata_ip(self):
        with patch("app.core.ssrf.socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [(2, 1, 6, "", ("169.254.169.254", 0))]
            with pytest.raises(SSRFError, match="blocked range"):
                validate_scan_url("https://metadata.go.ke")

    def test_rejects_loopback_ip(self):
        with patch("app.core.ssrf.socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [(2, 1, 6, "", ("127.0.0.1", 0))]
            with pytest.raises(SSRFError, match="blocked range"):
                validate_scan_url("https://localhost.go.ke")

    def test_rejects_malformed_url(self):
        with pytest.raises(SSRFError):
            validate_scan_url("not-a-url")

    def test_rejects_empty_url(self):
        with pytest.raises(SSRFError, match="required"):
            validate_scan_url("")

    def test_rejects_non_http_scheme(self):
        with pytest.raises(SSRFError, match="http and https"):
            validate_scan_url("ftp://example.go.ke")

    def test_rejects_credentials_in_url(self):
        with pytest.raises(SSRFError, match="credentials"):
            validate_scan_url("https://user:pass@example.go.ke")

    def test_rejects_localhost_hostname(self):
        with pytest.raises(SSRFError, match="not allowed"):
            validate_scan_url("http://localhost")

    def test_tld_bypass_allows_other_domains(self):
        with patch("app.core.ssrf.socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [(2, 1, 6, "", ("93.184.216.34", 0))]
            result = validate_scan_url(
                "https://example.com",
                allowed_tlds=[".go.ke"],
                allow_tld_bypass=True,
            )
            assert result.hostname == "example.com"

    def test_dns_resolution_failure(self):
        import socket

        with patch("app.core.ssrf.socket.getaddrinfo") as mock_dns:
            mock_dns.side_effect = socket.gaierror("Name or service not known")
            with pytest.raises(SSRFError, match="Unable to resolve"):
                validate_scan_url("https://nonexistent.go.ke")


class TestNormalizeURLForLock:
    def test_normalizes_https_default_port(self):
        with patch("app.core.ssrf.socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [(2, 1, 6, "", ("102.68.142.1", 0))]
            result = normalize_url_for_lock("https://www.ict.go.ke/")
            assert result == "https://www.ict.go.ke"
