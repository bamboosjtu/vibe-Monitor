from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

import app.main as main_module
from app.cache.store import MonitorCacheStore
from app.core.config import settings
from app.datahub.client import DataHubClient, DataHubClientError
from app.read_models.service import MonitorReadModelService


def _mock_datahub_payload(path: str) -> dict:
    if path == "/health/v1/datasets":
        return {
            "datasets": {
                "daily_meeting": {
                    "latest_raw_event_id": 11,
                    "latest_collected_at": "2026-05-08T08:00:00+08:00",
                },
                "tower": {
                    "latest_raw_event_id": 21,
                    "latest_collected_at": "2026-05-08T08:10:00+08:00",
                },
                "station": {
                    "latest_raw_event_id": 22,
                    "latest_collected_at": "2026-05-08T08:10:00+08:00",
                },
                "line_section": {
                    "latest_raw_event_id": 31,
                    "latest_collected_at": "2026-05-08T08:20:00+08:00",
                },
                "project_preconstruction": {
                    "latest_raw_event_id": 32,
                    "latest_collected_at": "2026-05-08T08:20:00+08:00",
                },
                "year_progress": {
                    "latest_raw_event_id": 0,
                    "latest_collected_at": None,
                },
            }
        }
    if path == "/health/v1/summary":
        return {
            "overall_status": "ok",
            "reasons": [],
        }
    if path == "/api/v1/sandbox/map/skeleton":
        return {
            "meta": {
                "limit": 10000,
                "stations_count": 1,
                "towers_count": 1,
                "truncated": False,
            },
            "lines": [],
            "towers": [
                {
                    "id": "dcp:tower:S01:B01:G1",
                    "single_project_code": "S01",
                    "bidding_section_code": "B01",
                    "tower_no": "G1",
                    "longitude": 112.9,
                    "latitude": 28.2,
                }
            ],
            "stations": [
                {
                    "id": "dcp:station:S01",
                    "project_code": "PRJ-001",
                    "single_project_code": "S01",
                    "longitude": 112.8,
                    "latitude": 28.1,
                }
            ],
        }
    if path == "/api/v1/sandbox/dates":
        return {
            "dates": ["2026-05-07", "2026-05-08"],
            "latest_date": "2026-05-08",
            "count": 2,
        }
    if path == "/api/v1/sandbox/map/summary":
        return {
            "meta": {
                "date": "2026-05-08",
                "limit": 10000,
                "work_points_count": 1,
                "truncated": False,
            },
            "work_points": [
                {
                    "id": "dcp:work_point:2026-05-08:meeting-001",
                    "project_name": "示例工程",
                    "longitude": 112.7,
                    "latitude": 28.0,
                    "person_count": 10,
                    "risk_level": "2",
                    "work_status": "working",
                    "voltage_level": "500kV",
                    "city": "长沙",
                    "work_date": "2026-05-08",
                }
            ],
        }
    raise AssertionError(f"unexpected path: {path}")


def test_cache_store_set_get_and_clear(tmp_path: Path) -> None:
    store = MonitorCacheStore(tmp_path / "monitor_cache.db")
    store.init_schema()
    store.upsert_cache_entry(
        cache_key="k1",
        cache_type="summary",
        payload={"value": 1},
        ttl_seconds=300,
    )

    entry = store.get_cache_entry("k1")

    assert entry is not None
    assert entry["payload"] == {"value": 1}
    assert entry["is_expired"] is False
    assert store.count_cache_entries() == 1
    assert store.clear_cache() == 1
    assert store.count_cache_entries() == 0


def test_read_model_service_builds_views_and_project_index(
    monkeypatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(DataHubClient, "_get_json", lambda self, path, query=None: _mock_datahub_payload(path))
    service = MonitorReadModelService(
        store=MonitorCacheStore(tmp_path / "monitor_cache.db"),
        datahub=DataHubClient(base_url="http://127.0.0.1:8000"),
        ttl_seconds=300,
    )

    skeleton = service.refresh_map_skeleton(force=True)
    summary = service.refresh_daily_summary(date="2026-05-08", force=True)
    projects = service.refresh_project_index(force=True)

    assert skeleton["towers"][0]["id"] == "dcp:tower:S01:B01:G1"
    assert summary["work_points"][0]["project_name"] == "示例工程"
    assert projects["projects"][0]["project_code"] in {"PRJ-001", "unknown_project"}


def test_read_model_service_uses_stale_cache_when_datahub_unavailable(
    monkeypatch, tmp_path: Path
) -> None:
    store = MonitorCacheStore(tmp_path / "monitor_cache.db")
    monkeypatch.setattr(DataHubClient, "_get_json", lambda self, path, query=None: _mock_datahub_payload(path))
    service = MonitorReadModelService(
        store=store,
        datahub=DataHubClient(base_url="http://127.0.0.1:8000"),
        ttl_seconds=1,
    )
    service.refresh_map_skeleton(force=True)

    def _raise(*_args, **_kwargs):
        raise DataHubClientError("down")

    monkeypatch.setattr(DataHubClient, "_get_json", _raise)
    cached = service.refresh_map_skeleton(force=False)

    assert cached["cached"] is True
    assert cached["stale"] is False


def test_monitor_backend_api_endpoints(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(main_module, "init_db", lambda: None)
    monkeypatch.setattr(settings, "MONITOR_CACHE_DB", str(tmp_path / "monitor_cache.db"))
    monkeypatch.setattr(DataHubClient, "_get_json", lambda self, path, query=None: _mock_datahub_payload(path))

    with TestClient(main_module.app) as client:
        health = client.get("/api/health")
        skeleton = client.get("/api/map/skeleton")
        dates = client.get("/api/map/dates")
        summary = client.get("/api/map/summary?date=2026-05-08")
        projects = client.get("/api/projects")
        refresh = client.post("/api/cache/refresh", json={"scope": "all", "force": True})
        status = client.get("/api/cache/status")
        clear = client.post("/api/cache/clear")

    assert health.status_code == 200
    assert health.json()["data"]["backend_status"] == "ok"
    assert skeleton.json()["data"]["towers"][0]["id"] == "dcp:tower:S01:B01:G1"
    assert dates.json()["data"]["latest_date"] == "2026-05-08"
    assert summary.json()["data"]["date"] == "2026-05-08"
    assert projects.json()["data"]["projects"]
    assert refresh.status_code == 200
    assert status.json()["data"]["cache_entries_count"] >= 1
    assert clear.json()["data"]["cache_entries_deleted"] >= 1
