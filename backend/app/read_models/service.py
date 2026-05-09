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

    def refresh_domain_projects(
        self,
        *,
        keyword: str | None = None,
        status: str | None = None,
        limit: int = 1000,
        offset: int = 0,
        force: bool = False,
    ) -> dict[str, Any]:
        query = {
            "keyword": keyword or "",
            "status": status or "",
            "limit": limit,
            "offset": offset,
        }
        filters_hash = _json_hash(query)
        cache_key = "domain:projects" if not any([keyword, status, offset]) else f"domain:projects:{filters_hash}"
        source_watermark = self._watermark_with_cache_fallback(
            cache_key,
            "project_preconstruction",
            "tower",
            "station",
            "line_section",
            "daily_meeting",
            "year_progress",
        )
        return self._resolve_cached_or_refresh(
            cache_key=cache_key,
            cache_type="domain_projects",
            source_watermark=source_watermark,
            filters_hash=filters_hash,
            force=force,
            builder=lambda: self._build_domain_projects_view(
                keyword=keyword,
                status=status,
                limit=limit,
                offset=offset,
                source_watermark=source_watermark,
            ),
        )

    def _build_domain_projects_view(
        self,
        *,
        keyword: str | None,
        status: str | None,
        limit: int,
        offset: int,
        source_watermark: str,
    ) -> dict[str, Any]:
        projects = self.datahub.get_domain_projects(
            keyword=keyword,
            limit=limit,
            offset=offset,
        )
        progress_items: list[dict[str, Any]] = []
        try:
            progress = self.datahub.get_domain_year_progress(
                limit=min(settings.DOMAIN_PROGRESS_MERGE_LIMIT, max(limit, 1)),
                offset=0,
            )
            progress_items = list(progress.get("items", []))
        except DataHubClientError:
            progress_items = []
        progress_by_project: dict[str, list[dict[str, Any]]] = {}
        for item in progress_items:
            code = item.get("project_code")
            if code:
                progress_by_project.setdefault(str(code), []).append(item)

        items = []
        for item in projects.get("items", []):
            project_code = item.get("project_code")
            progress_items = progress_by_project.get(str(project_code), [])
            statuses = sorted(
                {
                    str(progress_item.get("status"))
                    for progress_item in progress_items
                    if progress_item.get("status") not in (None, "")
                }
            )
            resolved_status = statuses[0] if len(statuses) == 1 else None
            if status and resolved_status != status:
                continue
            items.append(
                {
                    "project_code": project_code,
                    "project_name": item.get("project_name"),
                    "status": resolved_status,
                    "single_project_count": item.get("single_project_count", 0),
                    "bidding_section_count": item.get("bidding_section_count", 0),
                    "tower_count": item.get("tower_count", 0),
                    "station_count": item.get("station_count", 0),
                    "line_section_count": item.get("line_section_count", 0),
                    "work_point_count": item.get("work_point_count", 0),
                    "latest_work_date": item.get("latest_work_date"),
                    "progress_summary": {
                        "count": len(progress_items),
                        "statuses": statuses,
                    },
                    "source_watermark": source_watermark,
                }
            )
        return {
            "projects": items,
            "count": len(items),
            "filters": {"keyword": keyword, "status": status, "limit": limit, "offset": offset},
        }

    def refresh_domain_project_detail(
        self,
        *,
        project_code: str,
        date: str | None = None,
        include_work_points: bool = True,
        include_towers: bool = True,
        include_stations: bool = True,
        include_line_sections: bool = True,
        force: bool = False,
    ) -> dict[str, Any]:
        query = {
            "project_code": project_code,
            "date": date or "",
            "include_work_points": include_work_points,
            "include_towers": include_towers,
            "include_stations": include_stations,
            "include_line_sections": include_line_sections,
        }
        filters_hash = _json_hash(query)
        cache_key = f"domain:project:{project_code}"
        source_watermark = self._watermark_with_cache_fallback(
            cache_key,
            "project_preconstruction",
            "tower",
            "station",
            "line_section",
            "daily_meeting",
            "year_progress",
        )
        return self._resolve_cached_or_refresh(
            cache_key=cache_key,
            cache_type="domain_project_detail",
            source_watermark=source_watermark,
            filters_hash=filters_hash,
            force=force,
            builder=lambda: self._build_domain_project_detail_view(
                project_code=project_code,
                date=date,
                include_work_points=include_work_points,
                include_towers=include_towers,
                include_stations=include_stations,
                include_line_sections=include_line_sections,
                source_watermark=source_watermark,
            ),
        )

    def _build_domain_project_detail_view(
        self,
        *,
        project_code: str,
        date: str | None,
        include_work_points: bool,
        include_towers: bool,
        include_stations: bool,
        include_line_sections: bool,
        source_watermark: str,
    ) -> dict[str, Any]:
        view = self.datahub.get_domain_project_view(
            project_code,
            date=date,
            include_work_points=include_work_points,
            limit=10000,
        )
        line_sections_index = self.datahub.get_domain_line_sections(
            project_code=project_code,
            limit=5000,
            offset=0,
        )
        line_index_by_key = {
            item["line_section_key"]: item for item in line_sections_index.get("items", [])
        }
        line_sections = []
        warnings: list[str] = []
        for item in view.get("line_sections", []):
            key = item.get("entity_key")
            stats = line_index_by_key.get(str(key), {})
            merged = {**item, "sequence_stats": stats}
            if stats.get("missing_physical_count", 0) > 0:
                warnings.append(f"line_section missing tower entities: {key}")
            if stats.get("scope_without_tower_count", 0) > 0:
                warnings.append(f"line_section scope has no tower entities: {key}")
            line_sections.append(merged)

        return {
            "project": view.get("project"),
            "single_projects": view.get("hierarchy", {}).get("single_projects", []),
            "bidding_sections": view.get("hierarchy", {}).get("bidding_sections", []),
            "towers": view.get("towers", []) if include_towers else [],
            "stations": view.get("stations", []) if include_stations else [],
            "line_sections": line_sections if include_line_sections else [],
            "work_points": view.get("work_points", []) if include_work_points else [],
            "project_progress": view.get("project_progress", []),
            "counts": view.get("summary", {}),
            "warnings": sorted(set(warnings)),
            "source_watermark": source_watermark,
        }

    def refresh_domain_line_sections(
        self,
        *,
        project_code: str | None = None,
        single_project_code: str | None = None,
        bidding_section_code: str | None = None,
        limit: int = 1000,
        offset: int = 0,
        force: bool = False,
    ) -> dict[str, Any]:
        query = {
            "project_code": project_code or "",
            "single_project_code": single_project_code or "",
            "bidding_section_code": bidding_section_code or "",
            "limit": limit,
            "offset": offset,
        }
        filters_hash = _json_hash(query)
        cache_key = f"domain:line_sections:{filters_hash}"
        source_watermark = self._watermark_with_cache_fallback(
            cache_key, "line_section", "tower", "project_preconstruction"
        )
        return self._resolve_cached_or_refresh(
            cache_key=cache_key,
            cache_type="domain_line_sections",
            source_watermark=source_watermark,
            filters_hash=filters_hash,
            force=force,
            builder=lambda: self._build_domain_line_sections_view(
                project_code=project_code,
                single_project_code=single_project_code,
                bidding_section_code=bidding_section_code,
                limit=limit,
                offset=offset,
                source_watermark=source_watermark,
            ),
        )

    def _build_domain_line_sections_view(
        self,
        *,
        project_code: str | None,
        single_project_code: str | None,
        bidding_section_code: str | None,
        limit: int,
        offset: int,
        source_watermark: str,
    ) -> dict[str, Any]:
        response = self.datahub.get_domain_line_sections(
            project_code=project_code,
            single_project_code=single_project_code,
            bidding_section_code=bidding_section_code,
            limit=limit,
            offset=offset,
        )
        items = []
        for item in response.get("items", []):
            if item.get("missing_physical_count", 0) > 0:
                resolved_status = "warning"
            elif item.get("scope_without_tower_count", 0) > 0:
                resolved_status = "scope_without_tower"
            else:
                resolved_status = "ok"
            items.append(
                {
                    **item,
                    "status": resolved_status,
                    "source_watermark": source_watermark,
                }
            )
        return {"line_sections": items, "count": len(items)}

    def refresh_domain_year_progress(
        self,
        *,
        project_code: str | None = None,
        status: str | None = None,
        limit: int = 1000,
        offset: int = 0,
        force: bool = False,
    ) -> dict[str, Any]:
        query = {
            "project_code": project_code or "",
            "status": status or "",
            "limit": limit,
            "offset": offset,
        }
        filters_hash = _json_hash(query)
        cache_key = f"domain:year_progress:{filters_hash}"
        source_watermark = self._watermark_with_cache_fallback(
            cache_key, "year_progress", "project_preconstruction"
        )
        return self._resolve_cached_or_refresh(
            cache_key=cache_key,
            cache_type="domain_year_progress",
            source_watermark=source_watermark,
            filters_hash=filters_hash,
            force=force,
            builder=lambda: self._build_domain_year_progress_view(
                project_code=project_code,
                status=status,
                limit=limit,
                offset=offset,
                source_watermark=source_watermark,
            ),
        )

    def _build_domain_year_progress_view(
        self,
        *,
        project_code: str | None,
        status: str | None,
        limit: int,
        offset: int,
        source_watermark: str,
    ) -> dict[str, Any]:
        response = self.datahub.get_domain_year_progress(
            project_code=project_code,
            status=status,
            limit=limit,
            offset=offset,
        )
        items = [
            {
                "project_code": item.get("project_code"),
                "project_name": item.get("project_name"),
                "status": item.get("status"),
                "progress_payload": item.get("raw"),
                "source_watermark": source_watermark,
            }
            for item in response.get("items", [])
        ]
        return {"items": items, "count": len(items)}

    def refresh_scope(
        self,
        *,
        scope: str,
        date: str | None = None,
        force: bool = False,
        limit: int | None = None,
    ) -> dict[str, Any]:
        if scope == "all":
            return {
                "health": self.refresh_health_snapshot(force=force),
                "skeleton": self.refresh_map_skeleton(force=force),
                "dates": self.refresh_dates_view(force=force),
                "summary": self.refresh_daily_summary(date=date, force=force),
                "projects": self.refresh_project_index(force=force),
                "domain_projects": self.refresh_domain_projects(
                    force=force, limit=limit or 1000
                ),
                "line_sections": self.refresh_domain_line_sections(
                    force=force, limit=limit or 1000
                ),
                "year_progress": self.refresh_domain_year_progress(
                    force=force, limit=limit or 1000
                ),
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
        if scope == "domain":
            result: dict[str, Any] = {
                "partial_success": False,
                "errors": [],
            }
            for key, fn in (
                (
                    "domain_projects",
                    lambda: self.refresh_domain_projects(
                        force=force, limit=limit or 1000
                    ),
                ),
                (
                    "line_sections",
                    lambda: self.refresh_domain_line_sections(
                        force=force, limit=limit or 1000
                    ),
                ),
                (
                    "year_progress",
                    lambda: self.refresh_domain_year_progress(
                        force=force, limit=limit or 1000
                    ),
                ),
            ):
                try:
                    result[key] = fn()
                except DataHubClientError as exc:
                    result["errors"].append({"scope": key, "error": str(exc)})
            result["partial_success"] = bool(result["errors"])
            if (
                "domain_projects" not in result
                and "line_sections" not in result
                and "year_progress" not in result
            ):
                raise DataHubClientError("all domain refresh operations failed")
            return result
        if scope == "domain_projects":
            return {
                "domain_projects": self.refresh_domain_projects(
                    force=force, limit=limit or 1000
                )
            }
        if scope.startswith("domain_project:"):
            project_code = scope.split(":", 1)[1]
            return {
                "domain_project": self.refresh_domain_project_detail(
                    project_code=project_code,
                    date=date,
                    force=force,
                )
            }
        if scope == "line_sections":
            return {
                "line_sections": self.refresh_domain_line_sections(
                    force=force, limit=limit or 1000
                )
            }
        if scope == "year_progress":
            return {
                "year_progress": self.refresh_domain_year_progress(
                    force=force, limit=limit or 1000
                )
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
