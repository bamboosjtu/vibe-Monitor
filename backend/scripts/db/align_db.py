"""M0 数据库状态对齐脚本

本脚本用于将 sandbox.db 对齐到 M0 第二轮要求的完整状态。

使用场景：
1. 新项目首次初始化数据库
2. 迁移文件与数据库不同步时的修复
3. 开发者接手项目后的环境对齐

用法：
    uv run python scripts/db/align_db.py

注意：
- 本脚本不删除 sandbox.db
- 通过 ALTER TABLE 补齐缺失列
- 通过 SQLModel.metadata.create_all 补齐缺失表
- 可重复执行（幂等）
"""

import sys
import sqlite3
from pathlib import Path

# 确保项目路径正确
BACKEND_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import DATABASE_PATH
from app.core.db import init_db


def add_missing_columns():
    """补齐 import_batch 表的缺失列（M0 第二轮新增）"""
    db_path = str(DATABASE_PATH)
    if not os.path.exists(db_path):
        print(f"[INFO] 数据库文件不存在: {db_path}")
        print(f"[INFO] 将由 init_db() 创建")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.execute("PRAGMA table_info(import_batch)")
    existing_cols = {row[1] for row in cursor.fetchall()}

    missing_cols = []
    # M0 第二轮新增列
    for col_name, col_type, default in [
        ("skipped_records", "INTEGER", "0"),
        ("unresolved_records", "INTEGER", "0"),
    ]:
        if col_name not in existing_cols:
            missing_cols.append((col_name, col_type, default))

    if missing_cols:
        for col_name, col_type, default in missing_cols:
            sql = f"ALTER TABLE import_batch ADD COLUMN {col_name} {col_type} NOT NULL DEFAULT {default}"
            print(f"[MIGRATE] {sql}")
            conn.execute(sql)
        conn.commit()
        print(f"[OK] 已补齐 {len(missing_cols)} 个缺失列")
    else:
        print("[OK] import_batch 表结构已是最新")

    conn.close()


def main():
    print("=" * 60)
    print("M0 数据库状态对齐")
    print("=" * 60)
    print(f"数据库路径: {DATABASE_PATH}")
    print()

    # Step 1: 补齐缺失列
    print("Step 1: 检查并补齐 import_batch 缺失列")
    print("-" * 40)
    add_missing_columns()
    print()

    # Step 2: 创建/更新所有表
    print("Step 2: 创建/更新所有表")
    print("-" * 40)
    init_db()
    print("[OK] 所有表已创建/确认")
    print()

    # Step 3: 验证
    print("Step 3: 验证数据库状态")
    print("-" * 40)
    conn = sqlite3.connect(str(DATABASE_PATH))
    cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [row[0] for row in cursor.fetchall()]
    print(f"  表列表: {tables}")

    expected_tables = [
        "import_batch",
        "meeting_current",
        "raw_meeting_snapshot",
        "raw_tower",
        "raw_year_progress",
        "tower_current",
        "year_progress_current",
    ]
    for t in expected_tables:
        status = "OK" if t in tables else "MISSING"
        print(f"  {t}: {status}")

    # 验证 import_batch 列
    cursor2 = conn.execute("PRAGMA table_info(import_batch)")
    cols = [row[1] for row in cursor2.fetchall()]
    required_cols = ["id", "batch_no", "data_type", "source_file",
                     "total_records", "success_records", "failed_records",
                     "skipped_records", "unresolved_records",
                     "error_log", "status", "created_at", "created_by"]
    for c in required_cols:
        status = "OK" if c in cols else "MISSING"
        print(f"  import_batch.{c}: {status}")

    conn.close()

    print()
    print("=" * 60)
    print("数据库对齐完成")
    print("=" * 60)


if __name__ == "__main__":
    main()
