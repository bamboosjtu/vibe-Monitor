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


def _safe_attributes(entity: Any) -> dict[str, Any]:
    if isinstance(entity, dict):
        value = entity.get("attributes")
        return value if isinstance(value, dict) else {}
    return {}


def _entity_key(entity: Any) -> str | None:
    if isinstance(entity, dict):
        return entity.get("entity_key") or entity.get("id")
    return None


def _project_status_label(status: Any) -> str:
    return str(status) if status not in (None, "") else "unknown"


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
        projects = self.datahub.get_domain_projects(limit=1000, offset=0)
        line_sections_index = self.datahub.get_domain_line_sections(limit=5000, offset=0)
        line_section_stats = {
            item.get("line_section_key"): item
            for item in line_sections_index.get("items", [])
            if item.get("line_section_key")
        }
        lines: list[dict[str, Any]] = []
        towers: list[dict[str, Any]] = []
        stations: list[dict[str, Any]] = []

        for project in projects.get("items", []):
            project_code = project.get("project_code")
            if not project_code:
                continue
            detail = self.datahub.get_domain_project(
                str(project_code),
                include_work_points=False,
                include_towers=True,
                include_stations=True,
                include_line_sections=True,
                limit=10000,
            )
            for tower in detail.get("towers", []):
                attrs = _safe_attributes(tower)
                longitude = attrs.get("longitude")
                latitude = attrs.get("latitude")
                if longitude in (None, "", 0) or latitude in (None, "", 0):
                    continue
                towers.append(
                    {
                        "id": _entity_key(tower),
                        "project_code": attrs.get("project_code") or project_code,
                        "single_project_code": attrs.get("single_project_code"),
                        "bidding_section_code": attrs.get("bidding_section_code"),
                        "tower_no": attrs.get("tower_no"),
                        "tower_sequence_no": attrs.get("tower_sequence_no"),
                        "longitude": longitude,
                        "latitude": latitude,
                    }
                )
            for station in detail.get("stations", []):
                attrs = _safe_attributes(station)
                longitude = attrs.get("longitude")
                latitude = attrs.get("latitude")
                if longitude in (None, "", 0) or latitude in (None, "", 0):
                    continue
                stations.append(
                    {
                        "id": _entity_key(station),
                        "project_code": attrs.get("project_code") or project_code,
                        "single_project_code": attrs.get("single_project_code"),
                        "name": attrs.get("station_name") or attrs.get("name") or attrs.get("single_project_name"),
                        "longitude": longitude,
                        "latitude": latitude,
                    }
                )
            for line_section in detail.get("line_sections", []):
                attrs = _safe_attributes(line_section)
                key = _entity_key(line_section)
                stats = line_section_stats.get(key, {})
                lines.append(
                    {
                        "id": key,
                        "line_section_key": key,
                        "line_section_name": attrs.get("line_section_name"),
                        "project_code": attrs.get("project_code") or project_code,
                        "single_project_code": attrs.get("single_project_code"),
                        "bidding_section_code": attrs.get("bidding_section_code"),
                        "tower_count": stats.get("matched_tower_count")
                        or stats.get("tower_sequence_count")
                        or 0,
                        "coords": attrs.get("coords") or [],
                        "voltage_level": attrs.get("voltage_level"),
                    }
                )

        return {
            "lines": lines,
            "towers": towers,
            "stations": stations,
            "metadata": {
                "source": "datahub_domain_api",
                "projects_count": len(projects.get("items", [])),
                "lines_count": len(lines),
                "towers_count": len(towers),
                "stations_count": len(stations),
            },
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
        projects = self.datahub.get_domain_projects(limit=1000, offset=0)
        date_values = sorted(
            {
                str(item.get("latest_work_date"))
                for item in projects.get("items", [])
                if item.get("latest_work_date") not in (None, "")
            }
        )
        return {
            "dates": date_values,
            "latest_date": date_values[-1] if date_values else None,
            "count": len(date_values),
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
        projects = self.datahub.get_domain_projects(limit=1000, offset=0)
        latest_date = date or max(
            (
                str(item.get("latest_work_date"))
                for item in projects.get("items", [])
                if item.get("latest_work_date") not in (None, "")
            ),
            default=None,
        )
        work_points: list[dict[str, Any]] = []
        for project in projects.get("items", []):
            project_code = project.get("project_code")
            if not project_code:
                continue
            detail = self.datahub.get_domain_project(
                str(project_code),
                date=latest_date,
                include_work_points=True,
                include_towers=False,
                include_stations=False,
                include_line_sections=False,
                limit=10000,
            )
            for item in detail.get("work_points", []):
                attrs = _safe_attributes(item)
                work_date = attrs.get("work_date") or item.get("entity_date")
                if latest_date and work_date not in (latest_date, None, ""):
                    continue
                work_points.append(
                    {
                        "id": _entity_key(item),
                        "project_name": attrs.get("project_name") or project.get("project_name"),
                        "project_code": attrs.get("project_code") or project_code,
                        "longitude": attrs.get("longitude"),
                        "latitude": attrs.get("latitude"),
                        "person_count": attrs.get("person_count"),
                        "risk_level": attrs.get("risk_level"),
                        "work_status": attrs.get("work_status"),
                        "voltage_level": attrs.get("voltage_level"),
                        "city": attrs.get("city"),
                        "work_date": work_date,
                    }
                )
        return {
            "date": latest_date,
            "work_points": work_points,
            "summary": {
                "date": latest_date,
                "work_points_count": len(work_points),
                "source": "datahub_domain_api",
            },
            "metadata": {
                "requested_date": date,
            },
            # legacy shape for old backend callers
            "total_points": len(work_points),
            "data": work_points,
        }

    def refresh_project_index(self, *, force: bool = False) -> dict[str, Any]:
        domain_projects = self.refresh_domain_projects(force=force, limit=1000, offset=0)
        watermark = json.dumps(
            {
                "domain_projects": domain_projects.get("source_watermark"),
            },
            ensure_ascii=False,
            sort_keys=True,
        )

        def builder() -> dict[str, Any]:
            items = [
                {
                    "project_code": item.get("project_code"),
                    "project_name": item.get("project_name"),
                    "status": item.get("status"),
                    "tower_count": item.get("tower_count", 0),
                    "station_count": item.get("station_count", 0),
                    "line_section_count": item.get("line_section_count", 0),
                    "work_point_count": item.get("work_point_count", 0),
                    "single_project_count": item.get("single_project_count", 0),
                    "bidding_section_count": item.get("bidding_section_count", 0),
                }
                for item in domain_projects.get("projects", [])
            ]
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
        view = self.datahub.get_domain_project(
            project_code,
            date=date,
            include_work_points=include_work_points,
            include_towers=include_towers,
            include_stations=include_stations,
            include_line_sections=include_line_sections,
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

        work_points = []
        latest_work_date = None
        for item in view.get("work_points", []):
            attributes = _safe_attributes(item)
            work_date = attributes.get("work_date") or item.get("entity_date")
            if work_date not in (None, ""):
                latest_work_date = max(
                    latest_work_date or str(work_date),
                    str(work_date),
                )
            work_points.append(
                {
                    "id": item.get("entity_key"),
                    "project_name": attributes.get("project_name"),
                    "project_code": attributes.get("project_code"),
                    "longitude": attributes.get("longitude"),
                    "latitude": attributes.get("latitude"),
                    "person_count": attributes.get("person_count"),
                    "risk_level": attributes.get("risk_level"),
                    "work_status": attributes.get("work_status"),
                    "voltage_level": attributes.get("voltage_level"),
                    "city": attributes.get("city"),
                    "work_date": work_date,
                }
            )

        progress_statuses = sorted(
            {
                _project_status_label(_safe_attributes(item).get("status"))
                for item in view.get("project_progress", [])
            }
        )

        return {
            "project": view.get("project"),
            "single_projects": view.get("single_projects", []),
            "bidding_sections": view.get("bidding_sections", []),
            "towers": view.get("towers", []) if include_towers else [],
            "stations": view.get("stations", []) if include_stations else [],
            "line_sections": line_sections if include_line_sections else [],
            "work_points": work_points if include_work_points else [],
            "project_progress": view.get("project_progress", []),
            "counts": view.get("summary", {}),
            "latest_work_date": latest_work_date,
            "progress_summary": {
                "count": len(view.get("project_progress", [])),
                "statuses": progress_statuses,
            },
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
                resolved_status = "warning"
            elif item.get("reference_node_count", 0) > 0:
                resolved_status = "reference"
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

    def refresh_domain_project_map_view(
        self,
        *,
        project_code: str,
        date: str | None = None,
        force: bool = False,
    ) -> dict[str, Any]:
        detail = self.refresh_domain_project_detail(
            project_code=project_code,
            date=date,
            include_work_points=True,
            include_towers=True,
            include_stations=True,
            include_line_sections=True,
            force=force,
        )
        return {
            "project": detail.get("project"),
            "towers": detail.get("towers", []),
            "stations": detail.get("stations", []),
            "work_points": detail.get("work_points", []),
            "line_sections": detail.get("line_sections", []),
            "counts": detail.get("counts", {}),
            "warnings": detail.get("warnings", []),
            "latest_work_date": detail.get("latest_work_date"),
            "progress_summary": detail.get("progress_summary", {}),
            "source_watermark": detail.get("source_watermark"),
        }

    def refresh_domain_line_section_detail(
        self,
        *,
        line_section_key: str,
        force: bool = False,
    ) -> dict[str, Any]:
        cache_key = f"domain:line_section_detail:{line_section_key}"
        source_watermark = self._watermark_with_cache_fallback(
            cache_key, "line_section", "tower", "project_preconstruction"
        )
        return self._resolve_cached_or_refresh(
            cache_key=cache_key,
            cache_type="domain_line_section_detail",
            source_watermark=source_watermark,
            force=force,
            builder=lambda: self._build_domain_line_section_detail_view(
                line_section_key=line_section_key,
                source_watermark=source_watermark,
            ),
        )

    def _build_domain_line_section_detail_view(
        self,
        *,
        line_section_key: str,
        source_watermark: str,
    ) -> dict[str, Any]:
        line_sections = self.refresh_domain_line_sections(force=False, limit=5000)
        line_section_item = next(
            (
                item
                for item in line_sections.get("line_sections", [])
                if item.get("line_section_key") == line_section_key
            ),
            None,
        )
        if line_section_item is None:
            raise DataHubClientError(f"line section not found: {line_section_key}")

        project_code = line_section_item.get("project_code")
        if not project_code:
            raise DataHubClientError(
                f"line section missing project_code: {line_section_key}"
            )
        project_view = self.datahub.get_domain_project(
            str(project_code),
            include_work_points=False,
            include_towers=True,
            include_stations=False,
            include_line_sections=True,
            limit=10000,
        )
        line_section = next(
            (
                item
                for item in project_view.get("line_sections", [])
                if item.get("entity_key") == line_section_key
            ),
            None,
        )
        tower_lookup = {
            item.get("entity_key"): item
            for item in project_view.get("towers", [])
            if item.get("entity_key")
        }
        relationship_response = self.datahub.get_domain_relationships(
            relationship_type="HAS_TOWER_SEQUENCE",
            from_entity_type="line_section",
            from_entity_key=line_section_key,
            limit=10000,
            offset=0,
        )
        relationships = list(relationship_response.get("items", []))
        relationships.sort(
            key=lambda item: (item.get("attributes", {}) or {}).get("sequence_index", 0)
        )

        tower_sequence = []
        matched_towers = []
        reference_nodes = []
        missing_nodes = []
        scope_without_tower = []
        warnings: list[str] = []
        for relationship in relationships:
            attributes = relationship.get("attributes") or {}
            tower_no = attributes.get("tower_no")
            node_kind = attributes.get("node_kind")
            sequence_item = {
                "tower_key": relationship.get("to_entity_key"),
                "tower_no": tower_no,
                "sequence_index": attributes.get("sequence_index"),
                "node_kind": node_kind,
                "matched": relationship.get("to_entity_key") in tower_lookup,
            }
            tower_sequence.append(sequence_item)
            if relationship.get("to_entity_key") in tower_lookup:
                matched_towers.append(tower_lookup[relationship.get("to_entity_key")])
            elif node_kind == "reference_node":
                reference_nodes.append(sequence_item)
            elif line_section_item.get("scope_without_tower_count", 0) > 0:
                scope_without_tower.append(sequence_item)
            else:
                missing_nodes.append(sequence_item)

        if missing_nodes:
            warnings.append("部分物理塔序列节点缺少 tower 实体")
        if scope_without_tower:
            warnings.append("部分区段作用域没有 tower 实体")

        return {
            "line_section": line_section or line_section_item,
            "tower_sequence": tower_sequence,
            "matched_towers": matched_towers,
            "reference_nodes": reference_nodes,
            "missing_nodes": missing_nodes,
            "scope_without_tower": scope_without_tower,
            "warnings": warnings,
            "source_watermark": source_watermark,
        }

    def refresh_project_status(self, *, force: bool = False) -> dict[str, Any]:
        projects = self.refresh_domain_projects(force=force, limit=1000, offset=0)
        return {
            "items": [
                {
                    "project_code": item.get("project_code"),
                    "project_name": item.get("project_name"),
                    "status": item.get("status"),
                    "progress_summary": item.get("progress_summary"),
                    "source_watermark": item.get("source_watermark"),
                }
                for item in projects.get("projects", [])
            ],
            "count": len(projects.get("projects", [])),
        }

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
        if scope == "project_status":
            return {"project_status": self.refresh_project_status(force=force)}
        if scope.startswith("domain_project_map:"):
            project_code = scope.split(":", 1)[1]
            return {
                "domain_project_map": self.refresh_domain_project_map_view(
                    project_code=project_code,
                    date=date,
                    force=force,
                )
            }
        if scope.startswith("domain_line_section:"):
            line_section_key = scope.split(":", 1)[1]
            return {
                "domain_line_section": self.refresh_domain_line_section_detail(
                    line_section_key=line_section_key,
                    force=force,
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
