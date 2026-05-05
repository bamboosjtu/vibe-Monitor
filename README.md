# vibe-Monitor

`vibe-Monitor` 是数字沙盘消费端。当前 MVP 的主数据源是 `vibe-DataCollectorHub` 提供的 sandbox API，前端保留 local/mock JSON 模式作为演示和开发 fallback。

## 当前定位

```text
vibe-downloader
  -> vibe-DataCollectorHub
  -> sandbox API
  -> vibe-Monitor
```

`vibe-Monitor` 负责：

- 地图展示。
- 作业点、杆塔、变电站图层。
- 时间轴日期切换。
- 筛选、统计、详情展示。
- 将 DataHub sandbox DTO 转成前端 view model。

`vibe-Monitor` 不负责：

- DCP 登录、分页、采集。
- 解析 DCP Envelope 或 SourceEvent。
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
| `datahub` | `VITE_DATA_SOURCE=datahub` | 当前主链路，调用 DataHub sandbox API |
| `local` | `VITE_DATA_SOURCE=local` | 本地 JSON fallback / demo |
| `api` / `legacy-api` | 旧 backend API | 兼容旧流程，不作为当前主链路 |

DataHub mode 使用：

```text
GET /api/v1/sandbox/dates
GET /api/v1/sandbox/map/summary?date=YYYY-MM-DD
GET /api/v1/sandbox/map/skeleton
```

## 快速启动

### DataHub 模式

先启动 `vibe-DataCollectorHub`：

```powershell
cd C:\Users\theTruth\Documents\projects\vibe-work\vibe-DataCollectorHub
uv run run.py
```

启动 Monitor：

```powershell
cd C:\Users\theTruth\Documents\projects\vibe-work\vibe-Monitor\frontend

$env:VITE_DATA_SOURCE = "datahub"
$env:VITE_DATAHUB_BASE_URL = "http://localhost:8000"
npm run dev
```

### Local fallback

```powershell
cd C:\Users\theTruth\Documents\projects\vibe-work\vibe-Monitor\frontend

$env:VITE_DATA_SOURCE = "local"
npm run dev
```

## backend 保留策略

`backend/` 不删除。当前它不是第一版 DataHub 联调主链路，但后续仍可能作为 BFF / 应用处理层存在，用于：

- 对 DataHub sandbox / canonical 数据做 Monitor 专属聚合。
- 承载基建 online 的应用层逻辑。
- 提供权限、会话、用户操作、工单、履历等消费侧能力。

约束：

- backend 不应复制 DataHub 的 raw_events / canonical_entities 存储职责。
- backend 不应重新实现 DCP 采集、调度、checkpoint。
- backend 如接入数据，应优先消费 DataHub API。

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
cd C:\Users\theTruth\Documents\projects\vibe-work\vibe-Monitor\frontend
npm run test:run
npm run build
```
