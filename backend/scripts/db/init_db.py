"""数据库初始化脚本

用于初始化 SQLite 数据库，创建所有 M0 必需表。
"""

import sys
from pathlib import Path

# 添加 backend 根目录到路径
BACKEND_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BACKEND_ROOT))

# 必须先导入所有模型，SQLAlchemy 才能发现它们
from app.models.m0_models import (
    ImportBatch,
    RawYearProgress, RawTower, RawMeetingSnapshot, RawStation,
    YearProgressCurrent, TowerCurrent, MeetingCurrent, StationCurrent,
    LineRaw, LineCurrent,
)

from app.core.db import engine, SQLModel
from app.core.config import settings

def main():
    """初始化数据库"""
    print("=" * 60)
    print("输变电工程数字沙盘系统 - M0 数据库初始化")
    print("=" * 60)
    print(f"数据库路径: {settings.DATABASE_URL}")
    print()
    
    try:
        # 创建所有表
        SQLModel.metadata.create_all(engine)
        
        print("✓ 数据库初始化成功")
        print()
        print("已创建的表:")
        for table in SQLModel.metadata.sorted_tables:
            print(f"  - {table.name}")
        print()
        print("=" * 60)
        
    except Exception as e:
        print(f"✗ 数据库初始化失败: {e}")
        raise

if __name__ == "__main__":
    main()
