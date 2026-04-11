# 后端数据底座

当前后端是 FastAPI + SQLite + SQLModel + Alembic，依赖由 uv 管理。后端主要承担数据导入、数据库落库、bootstrap/map summary/skeleton API。前端默认 local 模式不依赖后端启动。

## 快速开始

### 1. 安装依赖

```bash
cd backend
uv sync --dev
```

### 2. 数据库状态对齐

```bash
cd backend
uv run python scripts/db/align_db.py
```

`scripts/db/align_db.py` 是 M0 第二轮引入的数据库状态对齐脚本，用于：
- 补齐 `import_batch` 表的缺失列（`skipped_records`、`unresolved_records`）
- 创建/确认所有 M0 必需表
- 可重复执行（幂等），不删除 `sandbox.db`

> **注意**: 如果是全新项目，也可以使用 `uv run python scripts/db/init_db.py` 从零创建数据库。
> `align_db.py` 适用于已有数据库但需要同步最新 schema 的场景。

### 3. 启动后端服务

```bash
cd backend
uv run python run.py
```

服务将在 `http://localhost:8000` 启动。API 文档：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 4. 导入正式数据（HTTP API 链路）

```bash
cd backend
uv run python scripts/imports/import_via_api.py
```

`scripts/imports/import_via_api.py` 会通过 HTTP API 从正式 `data/` 目录导入所有文件，并在导入完成后自动验证 bootstrap 和 map summary。

### 5. 导入正式数据（直接调用开发辅助脚本）

```bash
cd backend
uv run python scripts/imports/dev_import.py
```

`scripts/imports/dev_import.py` 直接在 Python 进程内调用导入器，不依赖后端 HTTP 服务。仅用于开发调试，不用于正式导入链路。

### 6. 诊断脚本

```bash
cd backend
uv run python scripts/diagnostics/verify_http.py
uv run python scripts/diagnostics/verify_skeleton_api.py
uv run python scripts/diagnostics/verify_m1r2.py
```

这些脚本是人工诊断入口，不是 pytest 测试。真正的 pytest 用例应放在 `backend/tests/`。

### 7. 手动导入（curl）

```bash
# 导入年度目标数据（使用正式文件）
curl -X POST "http://localhost:8000/api/import/year-progress" \
  -F "file=@../data/year_progress_formation/year_progress_formation_a_detail_2025.json"

# 导入杆塔数据
curl -X POST "http://localhost:8000/api/import/towers" \
  -F "file=@../data/tower/tower_1316A021000Q03.json"

# 导入 meetlist 数据
curl -X POST "http://localhost:8000/api/import/meetings" \
  -F "file=@../data/daily_meeting/meeting_20250101_all.json"
```

### 8. 验证导入结果

```bash
# 查看系统启动信息
curl http://localhost:8000/api/bootstrap

# 查看地图摘要
curl http://localhost:8000/api/map/summary
```

## 目录结构

```
backend/
├── app/
│   ├── main.py                     # FastAPI 入口
│   ├── core/                       # 核心配置
│   │   ├── config.py               # 应用配置
│   │   └── db.py                   # 数据库连接
│   ├── models/                     # 数据模型
│   │   ├── base.py                 # 基础模型
│   │   └── m0_models.py            # M0 数据表
│   ├── schemas/                    # API Schema
│   │   └── responses.py            # 响应结构
│   ├── api/                        # API 路由
│   │   ├── health.py               # 健康检查
│   │   ├── bootstrap.py            # 系统启动信息
│   │   ├── map_summary.py          # 地图摘要
│   │   ├── import_routes.py        # 数据导入路由
│   │   └── routes.py               # 路由汇总
│   └── importers/                  # 导入服务
│       ├── import_service.py               # 导入基类
│       ├── year_progress_importer.py       # 年度目标导入
│       ├── tower_importer.py               # 杆塔导入
│       └── meeting_importer.py             # 站班会导入
├── data/                           # 数据文件
│   └── sandbox.db                  # SQLite 数据库（自动生成）
├── alembic/                        # Alembic 迁移
├── scripts/
│   ├── db/                         # 数据库维护脚本
│   │   ├── init_db.py
│   │   └── align_db.py
│   ├── imports/                    # 数据导入与聚合脚本
│   │   ├── import_via_api.py
│   │   ├── dev_import.py
│   │   ├── m1_import.py
│   │   ├── m1_round2_import.py
│   │   └── reimport_stations.py
│   └── diagnostics/                # 接口与数据诊断脚本
│       ├── verify_http.py
│       ├── verify_skeleton_api.py
│       ├── verify_m1r2.py
│       ├── check_yp.py
│       └── check_yp2.py
├── tests/                          # pytest 测试目录
├── pyproject.toml                  # uv 项目与依赖配置
├── uv.lock                         # uv 锁文件
└── run.py                          # 启动脚本
```

## 技术栈

- Python 3.11+
- FastAPI
- SQLModel
- SQLite
- Alembic
- uv

## 数据表说明

### raw_* 表（原始数据）
- `raw_year_progress` - 年度目标原始数据
- `raw_tower` - 杆塔原始数据
- `raw_meeting_snapshot` - meetlist 原始快照

### current 表（当前生效视图）
- `year_progress_current` - 年度目标当前生效数据
- `tower_current` - 杆塔当前生效数据
- `meeting_current` - meetlist 当前生效数据

### 其他表
- `import_batch` - 导入批次记录

## 导入规则

- **年度目标**: 以 `prjCode` + `source_code` 为查找键全覆盖更新
- **杆塔**: 以 `singleProjectCode + towerNo` 为主键全覆盖更新
- **meetlist**: 以 `id` 为主键更新当前视图

## 数据库状态记录

### M0 第二轮变更（2026-04-18）

**变更原因**: `import_batch` 表新增 `skipped_records` 和 `unresolved_records` 列，用于统一导入结果返回结构。

**变更方式**: 通过 `align_db.py` 执行 `ALTER TABLE` 添加列。

**为何未用 alembic**: 首轮 migration 文件已包含这两列，但数据库在 migration 更新前通过 `init_db.py` 创建，导致 DB 缺少列而 alembic 未 stamp。M0 阶段采用手动补齐方式，后续 M1 启动前建议清理 DB 并重新 alembic stamp。

**对齐方式**:
```bash
# 推荐：对齐脚本（幂等，可重复执行）
uv run python scripts/db/align_db.py

# 或：彻底重建（仅适用于开发环境，会清空所有数据）
rm data/sandbox.db
uv run python scripts/db/init_db.py
```

### 当前数据库表结构

| 表名 | 用途 | 主键 |
|------|------|------|
| `import_batch` | 导入批次记录 | `id` |
| `raw_year_progress` | 年度目标原始数据 | `id` |
| `year_progress_current` | 年度目标当前视图 | `id` |
| `raw_tower` | 杆塔原始数据 | `id` |
| `tower_current` | 杆塔当前视图 | `id` |
| `raw_meeting_snapshot` | 站班会原始快照 | `id` |
| `meeting_current` | 站班会当前视图 | `id` |

### import_batch 表完整列清单

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER | 自增主键 |
| `batch_no` | VARCHAR | 批次编号（唯一索引） |
| `data_type` | VARCHAR | 数据类型（year_progress/tower/meeting） |
| `source_file` | VARCHAR | 源文件名 |
| `total_records` | INTEGER | 总记录数 |
| `success_records` | INTEGER | 成功记录数 |
| `failed_records` | INTEGER | 失败记录数 |
| `skipped_records` | INTEGER | 跳过记录数（M0 第二轮新增） |
| `unresolved_records` | INTEGER | 未解析记录数（M0 第二轮新增） |
| `error_log` | TEXT | 错误日志 |
| `status` | VARCHAR | 导入状态 |
| `created_at` | DATETIME | 创建时间 |
| `created_by` | VARCHAR | 导入人 |

## M0 已知限制

### year_progress_formation 缺少稳定 singleProjectCode

正式源数据中没有 `singleProjectCode` 字段。当前采用 unresolved 落库策略：

| 字段 | 值 |
|------|-----|
| `single_project_code` | NULL |
| `source_code` | 源数据中的 code |
| `source_name` | 源数据中的 name |
| `key_type` | "source_code_fallback" |
| `is_resolved` | false |

### map_summary work_status

当前返回原始编码值（如 "03"），M1 阶段统一映射为中文标签。

### 前端 API 端口

后端默认启动在 `http://localhost:8000`，但当前前端 API 客户端默认 `baseUrl` 是 `http://localhost:8001`。如需使用前端 API 模式，需要先统一该配置。

## 正式源数据目录

正式源数据位于与 `backend` 平级的 `data/` 目录：
- `data/daily_meeting/` - 站班会数据
- `data/tower/` - 杆塔数据
- `data/year_progress_formation/` - 年度目标数据
- `data/schema/` - schema 定义文件

`backend/data/` 目录仅用于 SQLite 数据库文件，不作为正式数据源。
