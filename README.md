# vibe-Monitor

`vibe-Monitor` 是数字沙盘消费端。当前推荐主链路是 `Monitor frontend -> Monitor backend BFF -> DataHub Domain API`，前端仍保留 local/mock fallback。

## 当前定位

```text
vibe-downloader
  -> vibe-DataCollectorHub
  -> Domain API
  -> vibe-Monitor backend
  -> vibe-Monitor frontend
```

`vibe-Monitor` 负责：

- 地图展示。
- 作业点、杆塔、变电站图层。
- 时间轴日期切换。
- 筛选、统计、详情展示。
- 将 DataHub Domain API DTO 转成前端 view model。
- 在 backend 构建 Monitor 专属 read model / cache。

`vibe-Monitor` 不负责：

- DCP 登录、分页、采集。
- 解析 DCP Envelope 或 raw_event 存储结构。
- 直接访问 DataHub raw layer 或 downloader。
- 依赖 DCP raw 字段名。
- DataHub canonical normalization。
- DataHub 调度、checkpoint、cache。

## MVP 显示范围

当前第一版联调只显示：

| DataHub entity | Monitor 图层 | 说明 |
| --- | --- | --- |
| `work_point` | 作业点 | 来自 daily_meeting |
| `tower` | 杆塔 | 来自 tower_details |
| `station` | 变电站 | 来自 substation_coordinates |

暂不显示：

- `line_section`
- `year_progress`

## 数据源模式

前端支持三类模式：

| 模式 | 环境变量 | 用途 |
| --- | --- | --- |
| `monitor_backend` | `VITE_DATA_SOURCE=monitor_backend` | 推荐默认模式，调用 Monitor backend BFF/cache |
| `datahub` | `VITE_DATA_SOURCE=datahub` | 兼容别名，仍通过 Monitor backend BFF 读取数据 |
| `local` | `VITE_DATA_SOURCE=local` | 本地 JSON fallback / demo |

Monitor backend mode 使用：

```text
GET /api/health
GET /api/map/dates
GET /api/map/summary?date=YYYY-MM-DD
GET /api/map/skeleton
GET /api/cache/status
POST /api/cache/refresh
POST /api/cache/clear
```

## 快速启动

### 推荐：Monitor backend 模式

先启动 `vibe-DataCollectorHub`：

```powershell
cd D:\vibe-coding\vibe-workspace\vibe-DataCollectorHub
uv run run.py
```

再启动 Monitor backend：

```powershell
cd D:\vibe-coding\vibe-workspace\vibe-Monitor\backend
uv sync --dev
uv run python run.py
```

最后启动 frontend：

```powershell
cd D:\vibe-coding\vibe-workspace\vibe-Monitor\frontend

$env:VITE_DATA_SOURCE = "monitor_backend"
$env:VITE_MONITOR_BACKEND_URL = "http://localhost:8001"
npm run dev
```

### Local fallback

```powershell
cd D:\vibe-coding\vibe-workspace\vibe-Monitor\frontend

$env:VITE_DATA_SOURCE = "local"
npm run dev
```

## backend 保留策略

`backend/` 不删除。当前它已经开始承担 BFF / 应用处理层职责，用于：

- 对 DataHub Domain API 数据做 Monitor 专属聚合。
- 本地缓存 skeleton / dates / summary / health。
- 承载基建 online 的应用层逻辑。
- 提供权限、会话、用户操作、工单、履历等消费侧能力。

约束：

- backend 不应复制 DataHub 的 raw_events / canonical_entities 存储职责。
- backend 不应重新实现 DCP 采集、调度、checkpoint。
- backend 如接入数据，只消费 DataHub Domain API 或 health API。

## 文档入口

| 文档 | 用途 |
| --- | --- |
| [doc/README.md](./doc/README.md) | 文档总索引 |
| [doc/当前状态.md](./doc/当前状态.md) | 当前架构、范围、边界 |
| [doc/运行与联调.md](./doc/运行与联调.md) | 本地运行和手动验收 |
| [doc/backend定位.md](./doc/backend定位.md) | backend 保留原因和未来边界 |
| [doc/exp/README.md](./doc/exp/README.md) | 基建 online 终极目标文档索引 |

旧 M0/M1/本轮进展文档的过程稿已清理，不再保留归档目录。

## 验证命令

```powershell
cd D:\vibe-coding\vibe-workspace\vibe-Monitor\backend
uv run pytest tests\test_monitor_backend_cache.py

cd D:\vibe-coding\vibe-workspace\vibe-Monitor\frontend
npm run test:run
npm run build
```
