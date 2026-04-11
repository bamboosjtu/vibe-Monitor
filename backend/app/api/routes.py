"""API 路由注册"""

from fastapi import APIRouter

from app.api import health, bootstrap, map_summary, import_routes, skeleton

router = APIRouter()

# 注册各模块路由
router.include_router(health.router, tags=["health"])
router.include_router(bootstrap.router, tags=["bootstrap"])
router.include_router(map_summary.router, tags=["map"])
router.include_router(import_routes.router, tags=["import"])
router.include_router(skeleton.router, tags=["map"])
