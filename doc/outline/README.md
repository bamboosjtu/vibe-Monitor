# 基建 online 文档索引

`doc/exp/` 保存长期目标文档。当前代码阶段仍是 DataHub sandbox API 下的数字沙盘 MVP，不应一次性实现这里的完整机制。

## 当前推荐主文档

| 文档 | 状态 | 用途 |
| --- | --- | --- |
| [基建online策划方案v1.2.md](./基建online策划方案v1.2.md) | 主文档 | 终极目标、机制包、分期策略 |
| [基建online技术设计.md](./基建online技术设计.md) | 技术草案 | 未来 backend / BFF / 应用服务设计参考 |
| [基建online可研方案.md](./基建online可研方案.md) | 评审稿 | 对外阐述、建设价值、风险控制 |
| [基建online需求分析.md](./基建online需求分析.md) | 长 PRD | 需求、字段、状态机、接口草案 |

## 已归档素材

```text
archive/rounds/
  round1.txt
  round2.txt
  round3.txt
  round4.txt
  round5.txt

archive/drafts/
  基建online策划方案.md
  基建online策划方案v1.1.md
  基建online策划方案深度研究.md
```

这些是过程稿或旧版稿，不作为当前实现依据。

## 与当前 MVP 的关系

当前 MVP 只提供基建 online 的地图底座：

- 作业点。
- 杆塔。
- 变电站。
- 按天时间轴。
- 筛选、统计、详情。

基建 online 中的赛季、角色、事件、军令、工单、日循环、健康度、战绩、履历、规则引擎等机制，未来应通过 Monitor backend / BFF 和 DataHub 数据资产逐步实现。
