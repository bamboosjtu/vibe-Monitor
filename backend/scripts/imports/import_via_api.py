"""M0 数据导入验证脚本（正式数据链路）

本脚本通过 HTTP API 向上传正式 data/ 目录中的真实源文件。
裸数组只作为 fallback，主路径为 envelope + raw_data[*]。

用法：
  1. 确保后端已启动（uv run python run.py）
  2. 运行本脚本：uv run python scripts/imports/import_via_api.py
"""

import requests
import os
import sys
from pathlib import Path

BASE_URL = "http://localhost:8000/api"

# 正式源数据目录（与 backend 平级）
PROJECT_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = os.path.join(PROJECT_ROOT, "data")

YEAR_PROGRESS_DIR = os.path.join(DATA_DIR, "year_progress_formation")
TOWER_DIR = os.path.join(DATA_DIR, "tower")
MEETING_DIR = os.path.join(DATA_DIR, "daily_meeting")


def test_import_year_progress():
    """测试年度目标导入 - 使用正式文件"""
    print("=" * 60)
    print("测试：导入年度目标数据（正式源）")
    print("=" * 60)

    files_to_import = []
    for f in sorted(os.listdir(YEAR_PROGRESS_DIR)):
        if f.endswith(".json"):
            files_to_import.append(os.path.join(YEAR_PROGRESS_DIR, f))

    if not files_to_import:
        print(f"[WARN] 未找到正式文件: {YEAR_PROGRESS_DIR}")
        return None

    for file_path in files_to_import:
        print(f"\n>>> 导入: {file_path}")
        print(f"    文件大小: {os.path.getsize(file_path) / 1024:.1f} KB")

        with open(file_path, "rb") as f:
            response = requests.post(
                f"{BASE_URL}/import/year-progress",
                files={"file": (os.path.basename(file_path), f, "application/json")},
                timeout=300,
            )

        result = response.json()
        print(f"    状态码: {response.status_code}")
        if result.get("code") == 0:
            data = result.get("data", {})
            print(f"    批次号: {data.get('batch_no')}")
            print(f"    数据类型: {data.get('data_type')}")
            print(f"    总记录数: {data.get('total_count')}")
            print(f"    成功记录: {data.get('success_count')}")
            print(f"    失败记录: {data.get('failed_count')}")
            print(f"    跳过记录: {data.get('skipped_count')}")
            if data.get('unresolved_count') is not None:
                print(f"    未解析记录: {data.get('unresolved_count')}")
            print(f"    状态: {data.get('status')}")
        else:
            print(f"    错误: {result}")

    return result


def test_import_towers():
    """测试杆塔导入 - 使用正式文件"""
    print("=" * 60)
    print("测试：导入杆塔数据（正式源）")
    print("=" * 60)

    files_to_import = []
    for f in sorted(os.listdir(TOWER_DIR)):
        if f.endswith(".json"):
            files_to_import.append(os.path.join(TOWER_DIR, f))

    if not files_to_import:
        print(f"[WARN] 未找到正式文件: {TOWER_DIR}")
        return None

    for file_path in files_to_import:
        print(f"\n>>> 导入: {file_path}")

        with open(file_path, "rb") as f:
            response = requests.post(
                f"{BASE_URL}/import/towers",
                files={"file": (os.path.basename(file_path), f, "application/json")},
                timeout=300,
            )

        result = response.json()
        print(f"    状态码: {response.status_code}")
        if result.get("code") == 0:
            data = result.get("data", {})
            print(f"    批次号: {data.get('batch_no')}")
            print(f"    数据类型: {data.get('data_type')}")
            print(f"    总记录数: {data.get('total_count')}")
            print(f"    成功记录: {data.get('success_count')}")
            print(f"    失败记录: {data.get('failed_count')}")
            print(f"    跳过记录: {data.get('skipped_count')}")
            print(f"    状态: {data.get('status')}")
        else:
            print(f"    错误: {result}")

    return result


def test_import_meetings():
    """测试 meetlist 导入 - 使用正式文件"""
    print("=" * 60)
    print("测试：导入 meetlist 数据（正式源）")
    print("=" * 60)

    # 选最近一个文件做验证导入（全量太多）
    files_to_import = sorted([
        os.path.join(MEETING_DIR, f)
        for f in os.listdir(MEETING_DIR)
        if f.endswith(".json")
    ])

    if not files_to_import:
        print(f"[WARN] 未找到正式文件: {MEETING_DIR}")
        return None

    # 导入第一个和最后一个作为验证
    test_files = [files_to_import[0]]
    if len(files_to_import) > 1:
        test_files.append(files_to_import[-1])

    for file_path in test_files:
        print(f"\n>>> 导入: {file_path}")
        print(f"    文件大小: {os.path.getsize(file_path) / 1024:.1f} KB")

        with open(file_path, "rb") as f:
            response = requests.post(
                f"{BASE_URL}/import/meetings",
                files={"file": (os.path.basename(file_path), f, "application/json")},
                timeout=300,
            )

        result = response.json()
        print(f"    状态码: {response.status_code}")
        if result.get("code") == 0:
            data = result.get("data", {})
            print(f"    批次号: {data.get('batch_no')}")
            print(f"    数据类型: {data.get('data_type')}")
            print(f"    总记录数: {data.get('total_count')}")
            print(f"    成功记录: {data.get('success_count')}")
            print(f"    失败记录: {data.get('failed_count')}")
            print(f"    跳过记录: {data.get('skipped_count')}")
            print(f"    状态: {data.get('status')}")
        else:
            print(f"    错误: {result}")

    return result


def test_bootstrap():
    """测试 bootstrap 信息"""
    print("=" * 60)
    print("测试：获取系统启动信息")
    print("=" * 60)

    try:
        response = requests.get(f"{BASE_URL}/bootstrap", timeout=10)
        result = response.json()
        print(f"状态码: {response.status_code}")
        data = result.get("data", {})
        print(f"  应用名: {data.get('app_name')}")
        print(f"  版本: {data.get('app_version')}")
        print(f"  DB已初始化: {data.get('db_initialized')}")
        print(f"  年度目标数据: {data.get('has_year_progress_data')}")
        print(f"  杆塔数据: {data.get('has_tower_data')}")
        print(f"  会议数据: {data.get('has_meeting_data')}")
        print(f"  最新导入时间: {data.get('latest_import_time')}")
        print(f"  导入批次数: {data.get('total_import_batches')}")
        if data.get('unresolved_year_progress_count') is not None:
            print(f"  未解析年度目标: {data.get('unresolved_year_progress_count')}")
        print()
        return result
    except Exception as e:
        print(f"[ERROR] 无法连接后端: {e}")
        print("请确保后端已启动: cd backend && python run.py")
        return None


def test_map_summary():
    """测试地图摘要"""
    print("=" * 60)
    print("测试：获取地图摘要")
    print("=" * 60)

    try:
        response = requests.get(f"{BASE_URL}/map/summary", timeout=10)
        result = response.json()
        print(f"状态码: {response.status_code}")
        data = result.get("data", {})
        items = data.get("items", [])
        print(f"  返回记录数: {len(items)}")
        if items:
            print(f"  示例记录 (前3条):")
            for item in items[:3]:
                print(f"    - id={item.get('id')}, city={item.get('city')}, risk={item.get('risk_level')}, persons={item.get('person_count')}, status={item.get('work_status')}")
        print()
        return result
    except Exception as e:
        print(f"[ERROR] 无法连接后端: {e}")
        return None


if __name__ == "__main__":
    print()
    print("█" * 60)
    print("█ M0 数据底座导入验证（正式数据链路）")
    print("█" * 60)
    print()
    print(f"正式源数据目录: {DATA_DIR}")
    print(f"  - year_progress_formation: {YEAR_PROGRESS_DIR}")
    print(f"  - tower: {TOWER_DIR}")
    print(f"  - daily_meeting: {MEETING_DIR}")
    print()

    # 验证目录存在
    for d in [YEAR_PROGRESS_DIR, TOWER_DIR, MEETING_DIR]:
        if not os.path.isdir(d):
            print(f"[ERROR] 目录不存在: {d}")
            sys.exit(1)
        count = len([f for f in os.listdir(d) if f.endswith(".json")])
        print(f"  {d}: {count} 个 JSON 文件")
    print()

    # 1. 先检查 bootstrap
    test_bootstrap()

    # 2. 导入三类数据
    test_import_year_progress()
    test_import_towers()
    test_import_meetings()

    # 3. 再次检查 bootstrap
    print("\n")
    test_bootstrap()

    # 4. 查看地图摘要
    test_map_summary()

    print("█" * 60)
    print("█ 验证完成")
    print("█" * 60)
    print()
