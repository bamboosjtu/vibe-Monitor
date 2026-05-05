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
    print("  - Swagger UI: http://localhost:8001/docs")
    print("  - ReDoc: http://localhost:8001/redoc")
    print()
    print("健康检查: http://localhost:8001/health")
    print("=" * 60)
    print()

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8001,
        reload=settings.DEBUG,
    )
