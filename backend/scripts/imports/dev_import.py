"""M0 开发辅助脚本 - 直接调用 import service

不依赖后端 HTTP 服务，直接在 Python 进程内调用导入器。
用于快速调试和 schema 对齐验证。

用法：
  cd backend
  uv run python scripts/imports/dev_import.py
"""

import json
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_ROOT.parent
DATA_DIR = os.path.join(PROJECT_ROOT, "data")

sys.path.insert(0, str(BACKEND_ROOT))

from app.core.db import engine
from app.core.config import settings
from sqlmodel import Session
from app.importers.tower_importer import TowerImporter
from app.importers.year_progress_importer import YearProgressImporter
from app.importers.meeting_importer import MeetingImporter
from app.models.m0_models import ImportBatch


def print_section(title: str):
    print()
    print("=" * 60)
    print(f"  {title}")
    print("=" * 60)


def import_one_file(file_path: str, data_type: str):
    """导入单个文件并打印结果"""
    print(f"\n>>> 导入: {file_path}")
    print(f"    文件大小: {os.path.getsize(file_path) / 1024:.1f} KB")

    with open(file_path, "r", encoding="utf-8-sig") as f:
        data = json.load(f)

    with Session(engine) as session:
        if data_type == "tower":
            importer = TowerImporter(session)
        elif data_type == "year_progress":
            importer = YearProgressImporter(session)
        elif data_type == "meeting":
            importer = MeetingImporter(session)
        else:
            raise ValueError(f"未知数据类型: {data_type}")

        batch_no = f"DEV-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"
        result = importer.import_data(data, batch_no, os.path.basename(file_path))

        print(f"    批次号: {result['batch_no']}")
        print(f"    总记录数: {result['total_records']}")
        print(f"    成功记录: {result['success_records']}")
        print(f"    失败记录: {result['failed_records']}")
        print(f"    状态: {result['status']}")
        if result.get("error_log"):
            print(f"    错误日志: {result['error_log'][:200]}")

        return result


def check_bootstrap():
    """检查 bootstrap 状态"""
    from sqlmodel import Session, select

    with Session(engine) as session:
        from app.models.m0_models import YearProgressCurrent, TowerCurrent, MeetingCurrent, ImportBatch

        yp_count = session.exec(select(YearProgressCurrent)).all()
        tower_count = session.exec(select(TowerCurrent)).all()
        meeting_count = session.exec(select(MeetingCurrent)).all()

        print(f"\n--- Bootstrap 状态 ---")
        print(f"  YearProgressCurrent 记录数: {len(yp_count)}")
        print(f"  TowerCurrent 记录数: {len(tower_count)}")
        print(f"  MeetingCurrent 记录数: {len(meeting_count)}")

        # 检查 unresolved 记录
        unresolved = session.exec(
            select(YearProgressCurrent).where(YearProgressCurrent.is_resolved == False)
        ).all()
        print(f"  YearProgress unresolved 记录数: {len(unresolved)}")
        if unresolved:
            print(f"    示例: source_code={unresolved[0].source_code}, source_name={unresolved[0].source_name}")
        # 检查 resolved 记录
        resolved = session.exec(
            select(YearProgressCurrent).where(YearProgressCurrent.is_resolved == True)
        ).all()
        print(f"  YearProgress resolved 记录数: {len(resolved)}")

        # 检查最近批次
        batches = session.exec(
            select(ImportBatch).order_by(ImportBatch.created_at.desc()).limit(5)
        ).all()
        print(f"\n  最近导入批次:")
        for b in batches:
            print(f"    {b.batch_no} | {b.data_type} | {b.success_records}/{b.total_records} | {b.status}")


if __name__ == "__main__":
    print()
    print("█" * 60)
    print("█ M0 开发辅助导入（直接调用 import service）")
    print("█" * 60)
    print(f"正式源数据目录: {DATA_DIR}")

    # 1. Tower 导入
    print_section("Tower 数据导入")
    tower_dir = os.path.join(DATA_DIR, "tower")
    for f in sorted(os.listdir(tower_dir)):
        if f.endswith(".json"):
            import_one_file(os.path.join(tower_dir, f), "tower")

    # 2. Year Progress 导入
    print_section("Year Progress 数据导入")
    yp_dir = os.path.join(DATA_DIR, "year_progress_formation")
    for f in sorted(os.listdir(yp_dir)):
        if f.endswith(".json"):
            import_one_file(os.path.join(yp_dir, f), "year_progress")

    # 3. Meeting 导入（只导入一个文件做验证）
    print_section("Meeting 数据导入")
    meeting_dir = os.path.join(DATA_DIR, "daily_meeting")
    meeting_files = sorted([f for f in os.listdir(meeting_dir) if f.endswith(".json")])
    if meeting_files:
        # 导入第一个文件做验证
        import_one_file(os.path.join(meeting_dir, meeting_files[0]), "meeting")

    # 4. 检查 bootstrap
    print_section("Bootstrap 验证")
    check_bootstrap()

    print()
    print("█" * 60)
    print("█ 开发辅助导入完成")
    print("█" * 60)
    print()
