# backend 定位

## 结论

`backend/` 需要保留，并作为 Monitor 的 BFF / 应用处理层。

当前链路是：

```text
DataHub Domain API -> Monitor backend / BFF -> frontend
```

## 保留原因

未来基建 online 不只是地图展示，还会需要应用层能力：

- 用户会话。
- 权限和角色。
- 工单。
- 事件。
- 履历。
- 战绩。
- 规则配置。
- 对 DataHub 已治理数据的消费侧聚合。

这些不适合全部塞进 DataHub。DataHub 应保持数据治理和 serving API 边界，Monitor backend 可以承接消费侧应用逻辑。

## 当前不做

backend 当前不应重新承担：

- DCP 登录。
- DCP 页面采集。
- downloader 调度。
- release ingestion。
- DataHub raw layer 存储。
- typed canonical store 存储。
- normalizer。
- DataHub checkpoint。

## 未来推荐边界

| 层 | 职责 |
| --- | --- |
| DataHub | command batch、ingestion、raw layer、normalizer、canonical、Domain API |
| Monitor backend | BFF、用户态、应用规则、工单、履历、基建 online 机制 |
| Monitor frontend | 地图、交互、可视化、操作入口 |

## 迁移原则

- 新能力优先判断属于 DataHub 还是 Monitor backend。
- 只要涉及 DCP raw -> canonical，放 DataHub。
- 只要涉及用户操作、组织角色、业务闭环，放 Monitor backend。
- 前端只消费 Monitor backend 稳定 DTO，不直接访问 DataHub 内部表结构、raw layer 或 downloader。

## 当前文档状态

`backend/README.md` 已调整为当前 BFF 说明。旧 FastAPI + SQLite 数据底座说明已清理。
