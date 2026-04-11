"""数据库会话管理"""

from sqlmodel import create_engine, Session, SQLModel
from app.core.config import settings

# 创建引擎
connect_args = {"check_same_thread": False}  # SQLite 需要此参数
engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=settings.DEBUG,  # 开发时打印 SQL
)


def init_db():
    """初始化数据库（创建所有表）
    
    必须先导入所有模型，SQLAlchemy 才能发现它们并创建表。
    """
    # 导入所有模型以注册到 metadata
    from app.models.m0_models import (
        ImportBatch,
        RawYearProgress, RawTower, RawMeetingSnapshot,
        YearProgressCurrent, TowerCurrent, MeetingCurrent,
    )
    SQLModel.metadata.create_all(engine)


def get_session():
    """获取数据库会话（用于 FastAPI 依赖注入）"""
    with Session(engine) as session:
        yield session
