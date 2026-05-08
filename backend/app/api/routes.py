"""API 路由注册"""

from fastapi import APIRouter

from app.api import bootstrap, import_routes, monitor_routes

router = APIRouter()

# 注册各模块路由
router.include_router(bootstrap.router, tags=["bootstrap"])
router.include_router(import_routes.router, tags=["import"])
router.include_router(monitor_routes.router, tags=["monitor"])
