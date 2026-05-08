"""运行后端服务"""

import uvicorn
from app.core.config import settings

if __name__ == "__main__":
    print("=" * 60)
    print("输变电工程数字沙盘系统 - M0-lite 后端服务")
    print("=" * 60)
    print(f"数据库: {settings.DATABASE_URL}")
    print(f"CORS 来源: {settings.CORS_ORIGINS}")
    print()
    print("API 文档:")
    print(f"  - Swagger UI: http://{settings.MONITOR_BACKEND_HOST}:{settings.MONITOR_BACKEND_PORT}/docs")
    print(f"  - ReDoc: http://{settings.MONITOR_BACKEND_HOST}:{settings.MONITOR_BACKEND_PORT}/redoc")
    print()
    print(f"DataHub: {settings.DATAHUB_BASE_URL}")
    print(f"缓存库: {settings.MONITOR_CACHE_DB}")
    print(f"健康检查: http://{settings.MONITOR_BACKEND_HOST}:{settings.MONITOR_BACKEND_PORT}/health")
    print("=" * 60)
    print()

    uvicorn.run(
        "app.main:app",
        host=settings.MONITOR_BACKEND_HOST,
        port=settings.MONITOR_BACKEND_PORT,
        reload=settings.DEBUG,
    )
