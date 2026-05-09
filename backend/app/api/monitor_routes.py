from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.datahub.client import DataHubClientError
from app.read_models.service import MonitorReadModelService
from app.schemas.responses import ApiResponse


router = APIRouter()


class CacheRefreshRequest(BaseModel):
    scope: str = "all"
    date: str | None = None
    force: bool = False
    limit: int | None = None


def _service() -> MonitorReadModelService:
    return MonitorReadModelService()


@router.get("/cache/status", response_model=ApiResponse)
def get_cache_status():
    service = _service()
    return ApiResponse(data=service.cache_status())


@router.post("/cache/refresh", response_model=ApiResponse)
def refresh_cache(request: CacheRefreshRequest):
    service = _service()
    try:
        data = service.refresh_scope(
            scope=request.scope,
            date=request.date,
            force=request.force,
            limit=request.limit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except DataHubClientError as exc:
        raise HTTPException(status_code=502, detail=f"DataHub unavailable: {exc}") from exc
    return ApiResponse(data=data)


@router.post("/cache/clear", response_model=ApiResponse)
def clear_cache():
    service = _service()
    return ApiResponse(data=service.clear_cache())


@router.get("/health", response_model=ApiResponse)
def monitor_backend_health():
    service = _service()
    cache_status = service.cache_status()
    reachable = False
    try:
        health = service.refresh_health_snapshot(force=False)
        reachable = True
    except DataHubClientError:
        health = None
    return ApiResponse(
        data={
            "backend_status": "ok",
            "datahub_reachable": reachable,
            "cache_status": cache_status,
            "datahub_health": health,
        }
    )


@router.get("/map/skeleton", response_model=ApiResponse)
def get_map_skeleton(force: bool = Query(False)):
    service = _service()
    try:
        data = service.refresh_map_skeleton(force=force)
    except DataHubClientError as exc:
        raise HTTPException(status_code=502, detail=f"DataHub unavailable: {exc}") from exc
    return ApiResponse(data=data)


@router.get("/map/dates", response_model=ApiResponse)
def get_map_dates(force: bool = Query(False)):
    service = _service()
    try:
        data = service.refresh_dates_view(force=force)
    except DataHubClientError as exc:
        raise HTTPException(status_code=502, detail=f"DataHub unavailable: {exc}") from exc
    return ApiResponse(data=data)


@router.get("/map/summary", response_model=ApiResponse)
def get_map_summary(date: str | None = Query(None), force: bool = Query(False)):
    service = _service()
    try:
        data = service.refresh_daily_summary(date=date, force=force)
    except DataHubClientError as exc:
        raise HTTPException(status_code=502, detail=f"DataHub unavailable: {exc}") from exc
    return ApiResponse(data=data)


@router.get("/projects", response_model=ApiResponse)
def get_projects(force: bool = Query(False)):
    service = _service()
    try:
        data = service.refresh_project_index(force=force)
    except DataHubClientError as exc:
        raise HTTPException(status_code=502, detail=f"DataHub unavailable: {exc}") from exc
    return ApiResponse(data=data)


@router.get("/domain/projects", response_model=ApiResponse)
def get_domain_projects(
    keyword: str | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(1000, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    force: bool = Query(False),
):
    service = _service()
    try:
        data = service.refresh_domain_projects(
            keyword=keyword,
            status=status,
            limit=limit,
            offset=offset,
            force=force,
        )
    except DataHubClientError as exc:
        raise HTTPException(status_code=502, detail=f"DataHub unavailable: {exc}") from exc
    return ApiResponse(data=data)


@router.get("/domain/projects/{project_code}", response_model=ApiResponse)
def get_domain_project_detail(
    project_code: str,
    date: str | None = Query(None),
    include_work_points: bool = Query(True),
    include_towers: bool = Query(True),
    include_stations: bool = Query(True),
    include_line_sections: bool = Query(True),
    force: bool = Query(False),
):
    service = _service()
    try:
        data = service.refresh_domain_project_detail(
            project_code=project_code,
            date=date,
            include_work_points=include_work_points,
            include_towers=include_towers,
            include_stations=include_stations,
            include_line_sections=include_line_sections,
            force=force,
        )
    except DataHubClientError as exc:
        raise HTTPException(status_code=502, detail=f"DataHub unavailable: {exc}") from exc
    return ApiResponse(data=data)


@router.get("/domain/projects/{project_code}/map", response_model=ApiResponse)
def get_domain_project_map_view(
    project_code: str,
    date: str | None = Query(None),
    force: bool = Query(False),
):
    service = _service()
    try:
        data = service.refresh_domain_project_map_view(
            project_code=project_code,
            date=date,
            force=force,
        )
    except DataHubClientError as exc:
        raise HTTPException(status_code=502, detail=f"DataHub unavailable: {exc}") from exc
    return ApiResponse(data=data)


@router.get("/domain/line-sections", response_model=ApiResponse)
def get_domain_line_sections(
    project_code: str | None = Query(None),
    single_project_code: str | None = Query(None),
    bidding_section_code: str | None = Query(None),
    limit: int = Query(1000, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    force: bool = Query(False),
):
    service = _service()
    try:
        data = service.refresh_domain_line_sections(
            project_code=project_code,
            single_project_code=single_project_code,
            bidding_section_code=bidding_section_code,
            limit=limit,
            offset=offset,
            force=force,
        )
    except DataHubClientError as exc:
        raise HTTPException(status_code=502, detail=f"DataHub unavailable: {exc}") from exc
    return ApiResponse(data=data)


@router.get("/domain/line-sections/{line_section_key}", response_model=ApiResponse)
def get_domain_line_section_detail(
    line_section_key: str,
    force: bool = Query(False),
):
    service = _service()
    try:
        data = service.refresh_domain_line_section_detail(
            line_section_key=line_section_key,
            force=force,
        )
    except DataHubClientError as exc:
        raise HTTPException(status_code=502, detail=f"DataHub unavailable: {exc}") from exc
    return ApiResponse(data=data)


@router.get("/domain/year-progress", response_model=ApiResponse)
def get_domain_year_progress(
    project_code: str | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(1000, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    force: bool = Query(False),
):
    service = _service()
    try:
        data = service.refresh_domain_year_progress(
            project_code=project_code,
            status=status,
            limit=limit,
            offset=offset,
            force=force,
        )
    except DataHubClientError as exc:
        raise HTTPException(status_code=502, detail=f"DataHub unavailable: {exc}") from exc
    return ApiResponse(data=data)


@router.get("/domain/project-status", response_model=ApiResponse)
def get_domain_project_status(force: bool = Query(False)):
    service = _service()
    try:
        data = service.refresh_project_status(force=force)
    except DataHubClientError as exc:
        raise HTTPException(status_code=502, detail=f"DataHub unavailable: {exc}") from exc
    return ApiResponse(data=data)
