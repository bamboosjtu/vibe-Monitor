"""M1 round1 线路聚合 + 骨架验证

用法：
  cd backend
  uv run python scripts/imports/m1_import.py
"""

import sys
import os
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BACKEND_ROOT))

from app.core.db import engine, SQLModel
from app.core.config import DATABASE_PATH
from app.models.m0_models import (
    LineRaw, LineCurrent,
    TowerCurrent,
)
from sqlmodel import Session, select
from app.importers.line_importer import LineImporter
from datetime import datetime
import uuid
import json


def ensure_tables():
    """确保新表存在"""
    SQLModel.metadata.create_all(engine)
    print("[OK] 所有表已创建/确认")


def build_lines():
    """从 tower_current 聚合线路"""
    with Session(engine) as session:
        importer = LineImporter(session)
        batch_no = f"LINE-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"
        result = importer.build_lines(batch_no, "aggregated_from_tower_current")

        print(f"\n--- 线路聚合结果 ---")
        for k, v in result.items():
            if k != "error_log":
                print(f"  {k}: {v}")
            elif v:
                print(f"  error_log: {v[:200]}")

        session.commit()


def verify_skeleton():
    """验证骨架数据"""
    with Session(engine) as session:
        # 线路统计
        lines = session.exec(select(LineCurrent)).all()
        print(f"\n--- 骨架验证 ---")
        print(f"  线路数: {len(lines)}")

        total_towers_in_lines = sum(l.tower_count for l in lines)
        total_coords = 0
        for line in lines:
            coords = json.loads(line.coords) if line.coords else []
            total_coords += len(coords)

        print(f"  线路总塔数: {total_towers_in_lines}")
        print(f"  线路有效坐标点数: {total_coords}")

        if lines:
            # 打印前 3 条线路
            for line in lines[:3]:
                coords = json.loads(line.coords) if line.coords else []
                print(f"  线路: {line.single_project_code} | 塔数: {line.tower_count} | 坐标点: {len(coords)} | 电压: {line.voltage_level}")

        # 塔统计
        towers = session.exec(select(TowerCurrent)).all()
        valid_towers = [t for t in towers if t.longitude_edit and t.latitude_edit]
        print(f"\n  杆塔总数: {len(towers)}")
        print(f"  有效坐标塔数: {len(valid_towers)}")


if __name__ == "__main__":
    print("=" * 60)
    print("M1 round1 - 线路聚合 + 骨架验证")
    print("=" * 60)

    ensure_tables()
    build_lines()
    verify_skeleton()

    print("\n" + "=" * 60)
    print("M1 round1 数据导入完成")
    print("=" * 60)
