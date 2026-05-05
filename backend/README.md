# vibe-Monitor backend

`backend/` 当前保留为 legacy API 与未来 BFF / 应用处理层。第一版 DataHub 联调主链路不依赖它。

当前主链路：

```text
vibe-DataCollectorHub sandbox API -> frontend
```

未来 backend 推荐链路：

```text
vibe-DataCollectorHub sandbox/canonical API -> backend BFF -> frontend
```

## 当前状态

历史上 backend 是 FastAPI + SQLite + SQLModel + Alembic 数据底座，提供过导入、bootstrap、map summary、map skeleton 等 API。

现在这些数据治理职责已经转移到 `vibe-DataCollectorHub`：

- SourceEvent ingestion。
- raw_events。
- normalizer。
- canonical_entities。
- sandbox API。

backend 不应再复制这些职责。

## 保留用途

未来可承接：

- Monitor 专属 BFF。
- 用户会话和权限。
- 基建 online 的角色、事件、军令、工单、履历、战绩、规则等应用层逻辑。
- 对 DataHub 已治理数据的消费侧聚合。

## 禁止边界

backend 不应实现：

- DCP 登录。
- DCP 页面采集。
- downloader 调度。
- SourceEvent ingestion。
- raw_events / canonical_entities 主存储。
- DataHub normalizer。
- DataHub checkpoint。

## 启动

如需运行 legacy backend：

```powershell
cd C:\Users\theTruth\Documents\projects\vibe-work\vibe-Monitor\backend
uv sync --dev
uv run python run.py
```

启动前请确认端口与 `frontend/api/config.ts` 中 legacy API base URL 一致。

## 测试

```powershell
cd C:\Users\theTruth\Documents\projects\vibe-work\vibe-Monitor\backend
uv run pytest
```

如果 legacy 测试因旧 schema 或旧数据失败，优先记录原因。不要为了恢复旧测试而把 DataHub 已承担的数据治理职责搬回 Monitor backend。

## 旧文档

旧 backend 数据底座说明已不再作为当前主文档。相关历史上下文已清理。
