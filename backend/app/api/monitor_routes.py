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
        data = service.refresh_scope(scope=request.scope, date=request.date, force=request.force)
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
