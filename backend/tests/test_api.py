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
            detail = response.json()["detail"]
            assert detail["error_category"] == "domain_not_allowed"
            assert "go.ke" in detail["message"].lower()

    def test_create_scan_rejects_private_ip(self):
        with patch("app.core.ssrf.socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [(2, 1, 6, "", ("192.168.1.1", 0))]
            response = client.post(
                "/api/v1/scans",
                json={"url": "https://internal.go.ke"},
            )
            assert response.status_code == 400
            detail = response.json()["detail"]
            assert detail["error_category"] == "domain_not_allowed"

    def test_create_scan_rejects_invalid_scheme(self):
        response = client.post(
            "/api/v1/scans",
            json={"url": "ftp://www.ict.go.ke"},
        )
        assert response.status_code == 400
        detail = response.json()["detail"]
        assert detail["error_category"] == "invalid_url"

    def test_create_scan_accepts_valid_go_ke(self):
        with patch("app.core.ssrf.socket.getaddrinfo") as mock_dns, patch(
            "app.api.v1.scans.get_cached_scan", return_value=None
        ), patch(
            "app.api.v1.scans.get_active_scan_job_id", return_value=None
        ), patch(
            "app.api.v1.scans.claim_scan_lock", return_value=True
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
            assert data["attached_to_existing"] is False
            mock_delay.assert_called_once_with("scan-uuid-1", "https://www.ict.go.ke")
            mock_set.assert_called_once()

    def test_create_scan_attaches_to_in_progress(self):
        with patch("app.core.ssrf.socket.getaddrinfo") as mock_dns, patch(
            "app.api.v1.scans.get_cached_scan", return_value=None
        ), patch(
            "app.api.v1.scans.get_active_scan_job_id", return_value="existing-job"
        ), patch(
            "app.api.v1.scans.get_job_status",
            return_value={
                "job_id": "existing-job",
                "status": "running",
                "url": "https://www.ict.go.ke",
                "progress": "Checking security…",
                "current_category": "security",
                "categories_completed": ["domain_identity"],
                "total_categories": 8,
            },
        ), patch("app.api.v1.scans.create_scan_record") as mock_create, patch(
            "app.api.v1.scans.run_scan.delay"
        ) as mock_delay:
            mock_dns.return_value = [(2, 1, 6, "", ("102.68.142.1", 0))]
            response = client.post(
                "/api/v1/scans",
                json={"url": "https://www.ict.go.ke"},
            )
            assert response.status_code == 202
            data = response.json()
            assert data["job_id"] == "existing-job"
            assert data["attached_to_existing"] is True
            assert data["status"] == "running"
            mock_create.assert_not_called()
            mock_delay.assert_not_called()

    def test_create_scan_cache_hit_returns_immediately(self):
        cached = {
            "job_id": "cached-scan-1",
            "status": "complete",
            "url": "https://www.ict.go.ke",
            "result": {
                "findings": [],
                "finding_count": 0,
                "narrative": "Cached narrative exists for cache-hit behavior testing.",
            },
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
            "app.api.v1.scans.get_active_scan_job_id", return_value=None
        ), patch(
            "app.api.v1.scans.claim_scan_lock", return_value=True
        ), patch(
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

    def test_get_comparison_no_history(self):
        with patch(
            "app.api.v1.scans.get_comparison_for_scan",
            return_value={
                "has_history": False,
                "requested_period": "quarter",
                "available_periods": [],
                "period_label": "1 quarter ago",
            },
        ):
            response = client.get("/api/v1/scans/abc-123/comparison")
            assert response.status_code == 200
            body = response.json()
            assert body["has_history"] is False
            assert body["requested_period"] == "quarter"

    def test_get_comparison_with_history(self):
        payload = {
            "has_history": True,
            "requested_period": "month",
            "period_label": "1 month ago",
            "available_periods": ["week", "biweek", "month"],
            "current": {
                "date": "2026-07-24",
                "quarter": "2026-Q3",
                "overall_score": 73.0,
                "category_breakdown": {"security": 60.0},
            },
            "compared_to": {
                "date": "2026-06-18",
                "quarter": "2026-Q2",
                "overall_score": 81.0,
                "category_breakdown": {"security": 80.0},
            },
            "previous": {
                "date": "2026-06-18",
                "quarter": "2026-Q2",
                "overall_score": 81.0,
                "category_breakdown": {"security": 80.0},
            },
            "delta": {
                "overall": -8.0,
                "category_breakdown": {"security": -20.0},
            },
        }
        with patch(
            "app.api.v1.scans.get_comparison_for_scan", return_value=payload
        ):
            response = client.get(
                "/api/v1/scans/abc-123/comparison?period=month"
            )
            assert response.status_code == 200
            data = response.json()
            assert data["has_history"] is True
            assert data["delta"]["overall"] == -8.0
            assert data["compared_to"]["date"] == "2026-06-18"

    def test_get_comparison_rejects_bad_period(self):
        response = client.get("/api/v1/scans/abc-123/comparison?period=decade")
        assert response.status_code == 400

    def test_get_comparison_scan_not_found(self):
        with patch("app.api.v1.scans.get_comparison_for_scan", return_value=None):
            response = client.get("/api/v1/scans/missing/comparison")
            assert response.status_code == 404

    def test_get_comparison_availability(self):
        with patch(
            "app.api.v1.scans.get_availability_for_scan",
            return_value={
                "available_periods": ["week", "month"],
                "current_date": "2026-07-24",
                "period_labels": {"week": "1 week ago", "month": "1 month ago"},
            },
        ):
            response = client.get(
                "/api/v1/scans/abc-123/comparison/availability"
            )
            assert response.status_code == 200
            assert response.json()["available_periods"] == ["week", "month"]

    def test_domain_comparison_endpoint(self):
        with patch(
            "app.api.v1.domains.get_comparison_for_domain",
            return_value={
                "has_history": False,
                "requested_period": "year",
                "available_periods": [],
                "period_label": "1 year ago",
            },
        ):
            response = client.get(
                "/api/v1/domains/dom-1/comparison?period=year"
            )
            assert response.status_code == 200
            assert response.json()["requested_period"] == "year"

class TestRegistryScanEndpoint:
    def test_start_registry_scan_enqueues(self):
        summary = {
            "batch_id": "batch-1",
            "domain_count": 2,
            "queued": 2,
            "attached_in_flight": 0,
            "skipped_lock": 0,
            "concurrency": 2,
            "triggered_type": "manual",
            "jobs": [
                {
                    "job_id": "j1",
                    "url": "https://www.ict.go.ke",
                    "domain_id": "d1",
                    "action": "queued",
                },
                {
                    "job_id": "j2",
                    "url": "https://www.ca.go.ke",
                    "domain_id": "d2",
                    "action": "queued",
                },
            ],
        }
        with patch(
            "app.api.v1.registry.get_active_registry_batch_id", return_value=None
        ), patch(
            "app.api.v1.registry.list_verified_domains_for_scan",
            return_value=[{"domain_id": "d1", "url": "https://www.ict.go.ke"}],
        ), patch(
            "app.api.v1.registry.enqueue_registry_scans", return_value=summary
        ):
            response = client.post("/api/v1/registry/scan")
            assert response.status_code == 202
            data = response.json()
            assert data["batch_id"] == "batch-1"
            assert data["queued"] == 2
            assert data["resumed"] is False
            assert len(data["jobs"]) == 2

    def test_start_registry_scan_requires_domains(self):
        with patch(
            "app.api.v1.registry.get_active_registry_batch_id", return_value=None
        ), patch(
            "app.api.v1.registry.list_verified_domains_for_scan", return_value=[]
        ):
            response = client.post("/api/v1/registry/scan")
            assert response.status_code == 400

    def test_get_registry_scan_batch(self):
        payload = {
            "batch_id": "batch-1",
            "triggered_type": "manual",
            "domain_count": 1,
            "done": False,
            "counts": {
                "queued": 0,
                "running": 1,
                "complete": 0,
                "failed": 0,
                "unknown": 0,
            },
            "jobs": [
                {
                    "job_id": "j1",
                    "url": "https://www.ict.go.ke",
                    "domain_id": "d1",
                    "action": "queued",
                    "status": "running",
                    "progress": "Security…",
                    "error": None,
                }
            ],
        }
        with patch(
            "app.api.v1.registry.get_registry_scan_batch", return_value=payload
        ):
            response = client.get("/api/v1/registry/scan/batch-1")
            assert response.status_code == 200
            assert response.json()["counts"]["running"] == 1
