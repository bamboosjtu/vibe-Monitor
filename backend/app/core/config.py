"""应用配置管理"""

from pydantic_settings import BaseSettings
from pathlib import Path
from typing import List


class Settings(BaseSettings):
    """应用配置"""
    
    # 项目信息
    APP_NAME: str = "输变电工程数字沙盘系统"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True
    
    # 数据库配置
    DATABASE_URL: str = "sqlite:///./data/sandbox.db"
    
    # CORS 配置
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",  # Vite 开发服务器
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]
    
    # 导入配置
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024  # 50MB
    ALLOWED_IMPORT_FORMATS: List[str] = [".json", ".csv", ".xlsx"]
    
    # 日志配置
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# 确保数据目录存在（使用后端目录的绝对路径）
BACKEND_DIR = Path(__file__).parent.parent.parent
DATA_DIR = BACKEND_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# 使用绝对路径构建数据库 URL
DATABASE_PATH = DATA_DIR / "sandbox.db"
if settings.DATABASE_URL.startswith("sqlite:///./"):
    settings.DATABASE_URL = f"sqlite:///{DATABASE_PATH}"
