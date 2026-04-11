"""FastAPI 应用入口"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import router as api_router
from app.core.db import init_db

app = FastAPI(
    title="输变电工程数字沙盘系统",
    description="M0-lite 数据底座与 API 兼容层",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# 启动时初始化数据库（开发辅助，正式迁移请使用 alembic upgrade head）
@app.on_event("startup")
def startup_event():
    """应用启动时确保数据库表存在（开发模式）"""
    # 注意：生产环境应该使用 alembic upgrade head 进行迁移
    # init_db() 仅作为开发辅助，确保表存在
    init_db()

# CORS 配置（允许前端开发服务器访问）
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(api_router, prefix="/api")

# 健康检查
@app.get("/health", tags=["health"])
def health_check():
    """健康检查接口"""
    return {"status": "ok", "version": "0.1.0"}
