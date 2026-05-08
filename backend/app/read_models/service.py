from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Any

from app.cache.store import MonitorCacheStore
from app.core.config import settings
from app.datahub.client import DataHubClient, DataHubClientError


def _json_hash(payload: dict[str, Any]) -> str:
    return hashlib.sha256(
        json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()


def _utcnow_iso() -> str:
    return datetime.utcnow().isoformat()


class MonitorReadModelService:
    def __init__(
        self,
        *,
        store: MonitorCacheStore | None = None,
        datahub: DataHubClient | None = None,
        ttl_seconds: int | None = None,
    ):
        self.store = store or MonitorCacheStore(settings.MONITOR_CACHE_DB)
        self.datahub = datahub or DataHubClient(
            base_url=settings.DATAHUB_BASE_URL,
            timeout_seconds=settings.DATAHUB_TIMEOUT_SECONDS,
        )
        self.ttl_seconds = ttl_seconds or settings.MONITOR_CACHE_TTL_SECONDS
        self.store.init_schema()

    def _dataset_health(self) -> dict:
        return self.datahub.get_datasets_health()

    def _build_watermark(self, *dataset_keys: str) -> str:
        datasets = self._dataset_health().get("datasets", {})
        watermark = {}
        for key in dataset_keys:
            item = datasets.get(key) or {}
            watermark[key] = {
                "latest_raw_event_id": item.get("latest_raw_event_id"),
                "latest_collected_at": item.get("latest_collected_at"),
            }
        return json.dumps(watermark, ensure_ascii=False, sort_keys=True)

    def _watermark_with_cache_fallback(self, cache_key: str, *dataset_keys: str) -> str:
        try:
            return self._build_watermark(*dataset_keys)
        except DataHubClientError:
            current = self.store.get_cache_entry(cache_key)
            if current and current.get("source_watermark"):
                return str(current["source_watermark"])
            raise

    def _cache_response(
        self,
        *,
        cache_key: str,
        cache_type: str,
        payload: dict[str, Any],
        source_watermark: str,
        filters_hash: str | None = None,
    ) -> dict[str, Any]:
        refreshed_at = _utcnow_iso()
        entry_payload = {
            **payload,
            "cached": True,
            "stale": False,
            "source_watermark": source_watermark,
            "refreshed_at": refreshed_at,
        }
        self.store.upsert_cache_entry(
            cache_key=cache_key,
            cache_type=cache_type,
            payload=entry_payload,
            filters_hash=filters_hash,
            source_watermark=source_watermark,
            ttl_seconds=self.ttl_seconds,
        )
        self.store.set_state("latest_refresh_at", refreshed_at)
        return entry_payload

    def _get_cached_payload(self, cache_key: str) -> dict[str, Any] | None:
        entry = self.store.get_cache_entry(cache_key)
        return entry["payload"] if entry else None

    def _resolve_cached_or_refresh(
        self,
        *,
        cache_key: str,
        cache_type: str,
        source_watermark: str,
        builder: callable,
        filters_hash: str | None = None,
        force: bool = False,
    ) -> dict[str, Any]:
        current = self.store.get_cache_entry(cache_key)
        if (
            not force
            and current
            and not current["is_expired"]
            and current.get("source_watermark") == source_watermark
        ):
            payload = dict(current["payload"])
            payload["cached"] = True
            payload["stale"] = False
            return payload

        try:
            payload = builder()
            return self._cache_response(
                cache_key=cache_key,
                cache_type=cache_type,
                payload=payload,
                source_watermark=source_watermark,
                filters_hash=filters_hash,
            )
        except DataHubClientError as exc:
            if current:
                payload = dict(current["payload"])
                payload["cached"] = True
                payload["stale"] = bool(current["is_expired"])
                payload["warning"] = f"DataHub unavailable, serving cached data: {exc}"
                return payload
            raise

    def refresh_health_snapshot(self, *, force: bool = False) -> dict[str, Any]:
        source_watermark = self._watermark_with_cache_fallback(
            "health_snapshot_view",
            "daily_meeting", "tower", "station", "line_section", "project_preconstruction", "year_progress"
        )
        return self._resolve_cached_or_refresh(
            cache_key="health_snapshot_view",
            cache_type="health_snapshot_view",
            source_watermark=source_watermark,
            force=force,
            builder=lambda: {
                "health": self.datahub.get_health_summary(),
                "datahub_url": self.datahub.base_url,
            },
        )

    def refresh_map_skeleton(self, *, force: bool = False) -> dict[str, Any]:
        source_watermark = self._watermark_with_cache_fallback(
            "map_skeleton_view", "tower", "station"
        )
        return self._resolve_cached_or_refresh(
            cache_key="map_skeleton_view",
            cache_type="map_skeleton_view",
            source_watermark=source_watermark,
            force=force,
            builder=self._build_map_skeleton_view,
        )

    def _build_map_skeleton_view(self) -> dict[str, Any]:
        skeleton = self.datahub.get_sandbox_skeleton()
        return {
            "lines": skeleton.get("lines", []),
            "towers": skeleton.get("towers", []),
            "stations": skeleton.get("stations", []),
            "metadata": skeleton.get("meta", {}),
        }

    def refresh_dates_view(self, *, force: bool = False) -> dict[str, Any]:
        source_watermark = self._watermark_with_cache_fallback("daily_dates_view", "daily_meeting")
        return self._resolve_cached_or_refresh(
            cache_key="daily_dates_view",
            cache_type="daily_dates_view",
            source_watermark=source_watermark,
            force=force,
            builder=self._build_dates_view,
        )

    def _build_dates_view(self) -> dict[str, Any]:
        dates = self.datahub.get_sandbox_dates()
        return {
            "dates": dates.get("dates", []),
            "latest_date": dates.get("latest_date"),
            "count": dates.get("count", 0),
        }

    def refresh_daily_summary(self, *, date: str | None, force: bool = False) -> dict[str, Any]:
        query = {"date": date or ""}
        filters_hash = _json_hash(query)
        cache_key = f"daily_summary_view:{date or 'latest'}"
        source_watermark = self._watermark_with_cache_fallback(cache_key, "daily_meeting")
        return self._resolve_cached_or_refresh(
            cache_key=cache_key,
            cache_type="daily_summary_view",
            source_watermark=source_watermark,
            filters_hash=filters_hash,
            force=force,
            builder=lambda: self._build_daily_summary_view(date=date),
        )

    def _build_daily_summary_view(self, *, date: str | None) -> dict[str, Any]:
        summary = self.datahub.get_sandbox_summary(date)
        return {
            "date": summary.get("meta", {}).get("date"),
            "work_points": summary.get("work_points", []),
            "summary": summary.get("meta", {}),
            "metadata": {
                "requested_date": date,
            },
            # legacy shape for old backend callers
            "total_points": summary.get("meta", {}).get("work_points_count", 0),
            "data": summary.get("work_points", []),
        }

    def refresh_project_index(self, *, force: bool = False) -> dict[str, Any]:
        skeleton = self.refresh_map_skeleton(force=force)
        latest_summary = self.refresh_daily_summary(date=None, force=force)
        watermark = json.dumps(
            {
                "skeleton": skeleton.get("source_watermark"),
                "summary": latest_summary.get("source_watermark"),
            },
            ensure_ascii=False,
            sort_keys=True,
        )

        def builder() -> dict[str, Any]:
            project_index: dict[str, dict[str, Any]] = {}
            for station in skeleton.get("stations", []):
                project_code = station.get("project_code") or station.get("prj_code") or "unknown_project"
                item = project_index.setdefault(
                    project_code,
                    {
                        "project_code": project_code,
                        "project_name": None,
                        "tower_count": 0,
                        "station_count": 0,
                        "work_point_count": 0,
                    },
                )
                item["station_count"] += 1
            for tower in skeleton.get("towers", []):
                project_code = tower.get("project_code") or "unknown_project"
                item = project_index.setdefault(
                    project_code,
                    {
                        "project_code": project_code,
                        "project_name": None,
                        "tower_count": 0,
                        "station_count": 0,
                        "work_point_count": 0,
                    },
                )
                item["tower_count"] += 1
            for work_point in latest_summary.get("work_points", []):
                project_code = work_point.get("project_code") or "unknown_project"
                item = project_index.setdefault(
                    project_code,
                    {
                        "project_code": project_code,
                        "project_name": None,
                        "tower_count": 0,
                        "station_count": 0,
                        "work_point_count": 0,
                    },
                )
                item["work_point_count"] += 1
                item["project_name"] = item["project_name"] or work_point.get("project_name")

            items = sorted(project_index.values(), key=lambda item: item["project_code"])
            self.store.clear_project_read_models()
            for item in items:
                self.store.upsert_project_read_model(
                    project_code=item["project_code"],
                    project_name=item["project_name"],
                    status=None,
                    payload=item,
                    source_watermark=watermark,
                )
            return {"projects": items}

        return self._resolve_cached_or_refresh(
            cache_key="project_index_view",
            cache_type="project_index_view",
            source_watermark=watermark,
            force=force,
            builder=builder,
        )

    def refresh_scope(
        self, *, scope: str, date: str | None = None, force: bool = False
    ) -> dict[str, Any]:
        if scope == "all":
            return {
                "health": self.refresh_health_snapshot(force=force),
                "skeleton": self.refresh_map_skeleton(force=force),
                "dates": self.refresh_dates_view(force=force),
                "summary": self.refresh_daily_summary(date=date, force=force),
                "projects": self.refresh_project_index(force=force),
            }
        if scope == "health":
            return {"health": self.refresh_health_snapshot(force=force)}
        if scope == "skeleton":
            return {"skeleton": self.refresh_map_skeleton(force=force)}
        if scope == "summary":
            return {
                "dates": self.refresh_dates_view(force=force),
                "summary": self.refresh_daily_summary(date=date, force=force),
            }
        raise ValueError(f"unsupported refresh scope: {scope}")

    def cache_status(self) -> dict[str, Any]:
        health = self._get_cached_payload("health_snapshot_view")
        return {
            "datahub_url": self.datahub.base_url,
            "cache_db": str(self.store.db_path),
            "cache_entries_count": self.store.count_cache_entries(),
            "latest_refresh_at": (self.store.get_state("latest_refresh_at") or {}).get("state_value"),
            "latest_datahub_health_status": (health or {}).get("health", {}).get("overall_status"),
            "cache_types": self.store.cache_types(),
            "source_watermark": (health or {}).get("source_watermark"),
        }

    def clear_cache(self) -> dict[str, Any]:
        cache_entries_deleted = self.store.clear_cache()
        project_entries_deleted = self.store.clear_project_read_models()
        self.store.set_state("latest_refresh_at", None)
        return {
            "cache_entries_deleted": cache_entries_deleted,
            "project_entries_deleted": project_entries_deleted,
        }
