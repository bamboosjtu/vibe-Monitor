# vibe-Monitor backend

`backend/` 当前承担 Monitor 专属 BFF / Read Model / Cache 职责，面向 `vibe-DataCollectorHub`。

当前推荐链路：

```text
vibe-DataCollectorHub Domain/health API -> vibe-Monitor backend -> frontend
```

## 当前状态

数据治理主职责已经转移到 `vibe-DataCollectorHub`：

- release ingestion and raw layer storage。
- normalizer。
- typed canonical store。
- Domain API。

backend 不应复制这些事实层职责；它现在只做消费侧 read model、缓存和 Monitor DTO 适配。

## 保留用途

当前和未来可承接：

- Monitor 专属 BFF / cache。
- DataHub 健康快照与缓存控制面。
- map skeleton / daily summary / dates / project index 的消费侧读模型，数据来自 DataHub Domain API。
- 用户会话和权限。
- 基建 online 的角色、事件、军令、工单、履历、战绩、规则等应用层逻辑。
- 对 DataHub 已治理数据的消费侧聚合。

## 禁止边界

backend 不应实现：

- DCP 登录。
- DCP 页面采集。
- downloader 调度。
- release ingestion。
- DataHub raw layer / typed canonical store 主存储。
- DataHub normalizer。
- DataHub checkpoint。

## 新增 BFF 配置

默认环境变量：

```text
MONITOR_BACKEND_HOST=127.0.0.1
MONITOR_BACKEND_PORT=8001
DATAHUB_BASE_URL=http://127.0.0.1:8000
MONITOR_CACHE_DB=./data/monitor_cache.db
MONITOR_CACHE_TTL_SECONDS=300
```

第一版缓存表：

- `monitor_cache_entries`
- `monitor_cache_state`
- `project_read_models`

缓存支持：

- skeleton 全局缓存
- dates 缓存
- summary 按日期缓存
- health snapshot 缓存
- 手动 refresh / clear

## 启动

如需运行 backend：

```powershell
cd D:\vibe-coding\vibe-workspace\vibe-Monitor\backend
uv sync --dev
uv run python run.py
```

默认启动后：

- Swagger: `http://127.0.0.1:8001/docs`
- Monitor backend health: `http://127.0.0.1:8001/health`

主要 BFF API：

```text
GET  /api/health
GET  /api/map/skeleton
GET  /api/map/dates
GET  /api/map/summary?date=YYYY-MM-DD
GET  /api/projects
GET  /api/cache/status
POST /api/cache/refresh
POST /api/cache/clear
```

缓存刷新示例：

```powershell
curl -X POST http://127.0.0.1:8001/api/cache/refresh `
  -H "Content-Type: application/json" `
  -d "{\"scope\":\"all\",\"force\":true}"
```

## 测试

```powershell
cd D:\vibe-coding\vibe-workspace\vibe-Monitor\backend
uv run pytest tests\test_monitor_backend_cache.py
```

不要为了恢复旧测试而把 DataHub 已承担的数据治理职责搬回 Monitor backend。

旧 backend 数据底座说明不再作为当前实现依据。
