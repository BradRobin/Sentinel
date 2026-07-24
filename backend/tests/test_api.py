"""API endpoint tests."""

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class TestHealthEndpoint:
    def test_health_returns_200(self):
        with patch("app.api.v1.health.check_redis", return_value=True), patch(
            "app.api.v1.health.check_db", return_value=True
        ):
            response = client.get("/health")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ok"
            assert "version" in data

    def test_health_v1_alias(self):
        with patch("app.api.v1.health.check_redis", return_value=True), patch(
            "app.api.v1.health.check_db", return_value=True
        ):
            response = client.get("/api/v1/health")
            assert response.status_code == 200


class TestScanEndpoint:
    def test_create_scan_rejects_invalid_tld(self):
        with patch("app.core.ssrf.socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [(2, 1, 6, "", ("93.184.216.34", 0))]
            response = client.post(
                "/api/v1/scans",
                json={"url": "https://example.com"},
            )
            assert response.status_code == 400
            assert "not allowed" in response.json()["detail"]

    def test_create_scan_rejects_private_ip(self):
        with patch("app.core.ssrf.socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [(2, 1, 6, "", ("192.168.1.1", 0))]
            response = client.post(
                "/api/v1/scans",
                json={"url": "https://internal.go.ke"},
            )
            assert response.status_code == 400
            assert "blocked range" in response.json()["detail"]

    def test_create_scan_accepts_valid_go_ke(self):
        with patch("app.core.ssrf.socket.getaddrinfo") as mock_dns, patch(
            "app.api.v1.scans.get_cached_scan", return_value=None
        ), patch(
            "app.api.v1.scans.create_scan_record", return_value="scan-uuid-1"
        ), patch("app.api.v1.scans.run_scan.delay") as mock_delay, patch(
            "app.api.v1.scans.set_job_status"
        ) as mock_set:
            mock_dns.return_value = [(2, 1, 6, "", ("102.68.142.1", 0))]
            response = client.post(
                "/api/v1/scans",
                json={"url": "https://www.ict.go.ke"},
            )
            assert response.status_code == 202
            data = response.json()
            assert data["status"] == "queued"
            assert data["job_id"] == "scan-uuid-1"
            assert data["cache_hit"] is False
            mock_delay.assert_called_once_with("scan-uuid-1", "https://www.ict.go.ke")
            mock_set.assert_called_once()

    def test_create_scan_cache_hit_returns_immediately(self):
        cached = {
            "job_id": "cached-scan-1",
            "status": "complete",
            "url": "https://www.ict.go.ke",
            "result": {"findings": [], "finding_count": 0},
            "error": None,
            "cache_hit": True,
        }
        with patch("app.core.ssrf.socket.getaddrinfo") as mock_dns, patch(
            "app.api.v1.scans.get_cached_scan", return_value=cached
        ), patch("app.api.v1.scans.set_job_status") as mock_set, patch(
            "app.api.v1.scans.run_scan.delay"
        ) as mock_delay:
            mock_dns.return_value = [(2, 1, 6, "", ("102.68.142.1", 0))]
            response = client.post(
                "/api/v1/scans",
                json={"url": "https://www.ict.go.ke"},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "complete"
            assert data["cache_hit"] is True
            assert data["job_id"] == "cached-scan-1"
            mock_delay.assert_not_called()
            mock_set.assert_called_once()

    def test_force_bypasses_cache(self):
        with patch("app.core.ssrf.socket.getaddrinfo") as mock_dns, patch(
            "app.api.v1.scans.invalidate_cached_scan"
        ) as mock_inv, patch(
            "app.api.v1.scans.create_scan_record", return_value="fresh-1"
        ), patch("app.api.v1.scans.run_scan.delay") as mock_delay, patch(
            "app.api.v1.scans.set_job_status"
        ):
            mock_dns.return_value = [(2, 1, 6, "", ("102.68.142.1", 0))]
            response = client.post(
                "/api/v1/scans",
                json={"url": "https://www.ict.go.ke", "force": True},
            )
            assert response.status_code == 202
            mock_inv.assert_called_once()
            mock_delay.assert_called_once()

    def test_get_scan_not_found(self):
        with patch("app.api.v1.scans.get_job_status", return_value=None):
            response = client.get("/api/v1/scans/nonexistent-id")
            assert response.status_code == 404

    def test_get_scan_returns_status(self):
        with patch(
            "app.api.v1.scans.get_job_status",
            return_value={
                "job_id": "abc-123",
                "status": "running",
                "url": "https://www.ict.go.ke",
                "result": None,
                "error": None,
                "cache_hit": False,
                "progress": "Checking security…",
                "current_category": "security",
                "categories_completed": ["domain_identity"],
                "total_categories": 8,
                "updated_at": "2026-07-24T09:51:02Z",
                "error_category": None,
            },
        ):
            response = client.get("/api/v1/scans/abc-123")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "running"
            assert data["progress"] == "Checking security…"
            assert data["current_category"] == "security"
            assert data["categories_completed"] == ["domain_identity"]
            assert data["total_categories"] == 8
            assert data["updated_at"] == "2026-07-24T09:51:02Z"
