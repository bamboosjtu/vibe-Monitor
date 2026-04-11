"""M1 Round2 数据导入脚本

导入内容：
1. Station 数据（data/substation_coordinates/）
2. 重新聚合 Line（确保数据最新）

用法：
  cd backend
  uv run python scripts/imports/m1_round2_import.py
"""

import sys
import os
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_ROOT.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.core.db import engine, SQLModel
from app.core.config import DATABASE_PATH
from sqlmodel import Session, select
from app.importers.station_importer import StationImporter
from app.importers.line_importer import LineImporter
from datetime import datetime
import uuid


def ensure_tables():
    """确保新表存在"""
    SQLModel.metadata.create_all(engine)
    print("[OK] 所有表已创建/确认")


def import_stations():
    """导入变电站数据"""
    data_dir = os.path.join(PROJECT_ROOT, "data", "substation_coordinates")
    
    if not os.path.exists(data_dir):
        print(f"[WARN] 变电站数据目录不存在: {data_dir}")
        return
    
    files = [f for f in os.listdir(data_dir) if f.endswith('.json')]
    print(f"[INFO] 发现 {len(files)} 个变电站数据文件")
    
    with Session(engine) as session:
        importer = StationImporter(session)
        
        for fname in files:
            fpath = os.path.join(data_dir, fname)
            print(f"  导入: {fname}")
            
            with open(fpath, 'r', encoding='utf-8-sig') as f:
                import json
                data = json.load(f)
            
            batch_no = f"ST-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"
            result = importer.import_data(data, batch_no, fname)
            
            print(f"    总记录: {result['total_count']}, 成功: {result['success_count']}, 失败: {result['failed_count']}")
        
        session.commit()


def build_lines():
    """重新聚合线路"""
    with Session(engine) as session:
        importer = LineImporter(session)
        batch_no = f"LINE-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"
        result = importer.build_lines(batch_no, "aggregated_from_tower_current")
        
        print(f"\n[Line 聚合结果]")
        print(f"  线路数: {result['total_count']}")
        print(f"  成功: {result['success_count']}")
        print(f"  失败: {result['failed_count']}")
        
        session.commit()


def verify_data():
    """验证数据"""
    from app.models.m0_models import StationCurrent, LineCurrent, TowerCurrent
    
    with Session(engine) as session:
        stations = session.exec(select(StationCurrent)).all()
        lines = session.exec(select(LineCurrent)).all()
        towers = session.exec(select(TowerCurrent)).all()
        
        print("\n[数据验证]")
        print(f"  变电站: {len(stations)} 个")
        print(f"  线路: {len(lines)} 条")
        print(f"  杆塔: {len(towers)} 座")
        
        if stations:
            for s in stations:
                print(f"    站: {s.single_project_code} ({s.longitude}, {s.latitude})")


if __name__ == "__main__":
    print("=" * 60)
    print("M1 Round2 - 数据导入")
    print("=" * 60)
    
    ensure_tables()
    import_stations()
    build_lines()
    verify_data()
    
    print("\n" + "=" * 60)
    print("M1 Round2 数据导入完成")
    print("=" * 60)
