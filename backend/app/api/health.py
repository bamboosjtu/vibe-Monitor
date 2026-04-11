"""健康检查路由"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health_check():
    """健康检查"""
    return {
        "status": "ok",
        "message": "输变电工程数字沙盘系统 - M0-lite",
        "version": "0.1.0"
    }
