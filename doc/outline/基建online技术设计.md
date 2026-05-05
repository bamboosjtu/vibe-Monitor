下面先给一版**可直接开工的技术设计**。我按你当前已经在用、且相对容易入门的路线来定：

**前端继续沿用你现有栈：React + TypeScript + Vite + TailwindCSS + Zustand + MapLibre + ECharts。**这套已经在MVP需求和策划里写明，当前阶段也是基于静态数据、按天切换、后续再考虑轮询或 WebSocket。

**后端建议：FastAPI + SQLModel + PostgreSQL + Redis（可选）**。
理由很简单：Python 上手门槛低、开发快、类型和数据模型够用、和规则引擎/事件计算也很契合。公司现有方向本来就是“数字工单 + 远程集中监控 + 过程预警 + 指挥调度”，这类系统更适合先做清晰的业务服务和规则计算，不必一开始上重框架。

我先不把桌面端单独拉出来。**P1 先做 Web 版**，把机制和数据闭环跑通；后面真有离线、桌面缓存、系统集成需求，再把前端壳包装成 Tauri。这样更稳，也更符合你“熟悉栈 + 容易入门”的要求。

------

# 《基建online》技术设计（Technical Design）

## 1. 设计目标

本技术设计围绕三个目标展开：

**第一，延续现有MVP技术路线。**
当前MVP已明确采用 React + TypeScript + Vite + TailwindCSS + Zustand + MapLibre + ECharts；当前数据刷新仍以静态数据为主，后续才演进到轮询 / WebSocket。

**第二，按机制包拆分，降低耦合。**
赛季、角色、事件、工单、健康度、战绩、履历、地图表达各自独立，便于分阶段开发、局部上线、快速调整。

**第三，先机制后实时。**
当前MVP第二轮只渲染站班会点位图层，不展示杆塔和线路轨迹；线路骨架和实时化都在后续阶段。技术上也应先把组织、事件、工单、评价跑通，再增强空间骨架和实时联动。

------

## 2. 技术选型

## 2.1 前端选型

### 核心栈

- **React**
- **TypeScript**
- **Vite**
- **TailwindCSS**
- **Zustand**
- **MapLibre GL JS**
- **ECharts**

这与当前需求规格和策划中的技术栈保持一致。

### 选型原因

- React + TS：你当前已在用，组件化和状态管理成熟。
- Vite：开发快，构建和本地调试成本低。
- Tailwind：对中后台、地图左右面板布局很省心。
- Zustand：比 Redux 更轻，适合本项目前期。
- MapLibre：你当前地图底座已定，继续沿用最省切换成本。
- ECharts：做统计、赛季看板、战绩图足够用。

### 前端不建议现在引入的东西

- 不建议一开始上 Next.js
- 不建议一开始上 Redux Toolkit
- 不建议一开始上复杂 3D 引擎
- 不建议一开始做 Tauri 双端并行

这些都会显著增加理解和维护成本，但对 P1 不产生决定性价值。

------

## 2.2 后端选型

### 建议栈

- **FastAPI**
- **SQLModel**
- **PostgreSQL**
- **Alembic**
- **Pydantic v2**
- **Redis（可选）**
- **APScheduler / Celery（二选一，P1 优先 APScheduler）**

### 为什么这样选

#### FastAPI

- 学习成本低
- 类型提示好
- OpenAPI 自动生成
- 非常适合中后台、规则服务、工单服务

#### SQLModel

- 对你这种“既要 ORM，又不想写太重”的场景比较合适
- 和 FastAPI / Pydantic 思路接近
- 比直接上纯 SQLAlchemy 更好入门

#### PostgreSQL

- 关系模型清晰
- JSONB 足够灵活
- 后续做事件、工单、账本、履历都方便
- 地图如果以后想上 PostGIS，也能平滑扩展

#### Redis

P1 不是必需，但建议预留：

- 做热点缓存
- 做会话或短时状态
- 做排行榜缓存
- 做简单消息队列替代

#### 定时任务

P1 优先 **APScheduler**

- 够轻
- 够简单
- 适合做健康度重算、工单超期扫描、赛季统计刷新

后面事件量大了，再换 Celery 或 Dramatiq。

------

## 2.3 实时通信选型

### P1

- **HTTP + 轮询**
- 前端每 30s/60s 拉一次摘要数据
- 详情页按需刷新

### P2

- **WebSocket**
- 用于事件流、工单状态变化、排行榜刷新

### 原因

当前需求规格已明确：MVP第一轮和第二轮都是静态数据，后续阶段才进入轮询 / WebSocket。技术设计也应遵守这个节奏，而不是提前引入实时复杂度。

------

# 3. 总体架构

采用**前后端分离 + 模块化单体（Modular Monolith）**。

我不建议你 P1 一上来拆微服务。
更适合的是：

- 代码层面强模块拆分
- 部署层面先单体服务
- 数据层先单库
- 后面按模块热度再拆

这样最符合“容易入门 + 可演进”。

------

## 3.1 架构图

```text
┌──────────────────────────────┐
│          Web Frontend        │
│ React + TS + Vite            │
│ Tailwind + Zustand           │
│ MapLibre + ECharts           │
└──────────────┬───────────────┘
               │ HTTPS
┌──────────────▼───────────────┐
│        FastAPI Backend       │
│  ┌────────────────────────┐  │
│  │ Season Module          │  │
│  │ Role Module            │  │
│  │ Event Module           │  │
│  │ WorkOrder Module       │  │
│  │ DailyLoop Module       │  │
│  │ Health Module          │  │
│  │ Score Module           │  │
│  │ Career Module          │  │
│  │ Rule Engine Module     │  │
│  │ Map Projection Module  │  │
│  └────────────────────────┘  │
└───────┬───────────────┬──────┘
        │               │
 ┌──────▼──────┐   ┌────▼─────┐
 │ PostgreSQL  │   │  Redis   │
 │  主业务库    │   │ 缓存/短队列│
 └─────────────┘   └──────────┘

       外部数据接入层（P1可先批量导入）
 ┌────────────────────────────────────┐
 │ e基建2.0 / 基建数智化 / 站班会数据  │
 │ CSV / JSON / Excel / API           │
 └────────────────────────────────────┘
```

------

# 4. 模块划分

后端按业务机制包拆成 10 个模块，每个模块有自己的：

- router
- service
- repository
- schema
- model
- events
- tests

目录建议如下：

```text
backend/
  app/
    main.py
    core/
      config.py
      db.py
      auth.py
      exceptions.py
      scheduler.py
      cache.py
    modules/
      season/
      role/
      event/
      work_order/
      daily_loop/
      health/
      score/
      career/
      rule_engine/
      map_projection/
    shared/
      enums/
      schemas/
      utils/
      audit/
      pagination/
  migrations/
  tests/
```

前端目录建议如下：

```text
frontend/
  src/
    app/
      router.tsx
      providers.tsx
    pages/
      OverviewPage.tsx
      WarzonePage.tsx
      ProjectCommandPage.tsx
      EventCenterPage.tsx
      WorkOrderCenterPage.tsx
      DailyLoopPage.tsx
      ScoreCenterPage.tsx
      CareerCenterPage.tsx
    features/
      season/
      role/
      event/
      workOrder/
      dailyLoop/
      health/
      score/
      career/
      map/
    entities/
      project/
      person/
      unit/
    shared/
      api/
      components/
      hooks/
      lib/
      styles/
    store/
      appStore.ts
      mapStore.ts
      filterStore.ts
```

------

# 5. 核心模块设计

## 5.1 Season Module

### 作用

管理赛季、目标、榜单。

### 主要能力

- 创建赛季
- 发布赛季
- 战区目标分解
- 榜单统计
- 赛季归档

### 主要表

- `season`
- `season_target`
- `season_ranking_snapshot`

### 核心接口

- `POST /api/seasons`
- `POST /api/seasons/{id}/publish`
- `GET /api/seasons/current`
- `GET /api/seasons/{id}/rankings`

------

## 5.2 Role Module

### 作用

管理组织关系和席位。

### 关键对象

- 战区（建管单位）
- 督军府
- 军师
- 现场督军
- 军团（施工单位）
- 作战军（施工项目部）

### 关键规则

- 一个督军府可包含多个军师
- 建管单位与军团多对多
- 军团组建作战军
- 作战军的关键岗位变更要留痕

### 主要表

- `management_unit`
- `owner_command_post`
- `advisor_assignment`
- `supervision_team`
- `contractor_unit`
- `battle_unit`
- `battle_unit_member`

------

## 5.3 Event Module

### 作用

统一接收和管理各类事件。

### 事件来源

- 规则触发
- 人工发起
- 外部数据同步
- 工单状态变化
- 任命/调整动作

### 事件状态

- NEW
- CONFIRMED
- IN_PROGRESS
- CLEARED
- ARCHIVED

### 主要表

- `event`
- `event_object_rel`
- `event_log`

### 技术建议

事件不要直接写死在前端。
后端维护枚举与事件码，前端只做展示映射。

------

## 5.4 WorkOrder Module

### 作用

承接军令与工单闭环。

### 工单类型

- 督战
- 支援
- 调整
- 请示
- 整改
- 复工

### 工单状态

- PENDING_ACCEPT
- PROCESSING
- WAITING_REVIEW
- CLOSED
- REJECTED
- OVERDUE
- FROZEN

### 主要表

- `work_order`
- `work_order_action_log`
- `work_order_attachment`
- `work_order_review`

### 技术建议

工单状态流转不要写死在 if/else 里。
用一张状态流转配置表更稳，后续不同工单类型能走不同路径。

------

## 5.5 DailyLoop Module

### 作用

承接日循环：作业票、站班会、日评价、整改单。

### 主要能力

- 拉取当日作业
- 挂接站班会状态
- 创建日评价
- 创建整改工单
- 输出项目日循环摘要

### 主要表

- `daily_operation_snapshot`
- `toolbox_talk_snapshot`
- `daily_evaluation`
- `rectification_relation`

### 数据来源

P1 可先支持：

- JSON 导入
- CSV 导入
- 手动录入部分评价数据

------

## 5.6 Health Module

### 作用

计算项目健康度。

### P1 公式建议

```
health_score = 0.35*progress + 0.25*safety + 0.20*quality + 0.10*resource + 0.10*coordination
```

### 等级映射

- `>= 85`：GREEN
- `70 - 84`：YELLOW
- `50 - 69`：RED
- `< 50` 或停工：GRAY

### 技术建议

健康度不要实时逐条重算。
P1 用两种策略：

- 事件触发局部刷新
- 定时任务做全量重算

------

## 5.7 Score Module

### 作用

管理个人 / 单位 / 项目三类账本。

### 核心思想

**账本式，而不是覆盖式。**

每次加分、扣分、冻结、调整，都写一条账本记录，而不是直接 update 总分。

### 主要表

- `performance_ledger`
- `performance_freeze`
- `performance_snapshot`

### 好处

- 可审计
- 可回滚
- 可申诉
- 可做赛季归档

------

## 5.8 Career Module

### 作用

管理履历和任免。

### 核心原则

履历记录**不可覆盖，只可追加**。

### 主要表

- `career_record`
- `appointment_record`
- `handover_record`

### 关键规则

- 任命、接任、调离、支援都生成履历
- 调整动作先关闭旧任期，再创建新任期
- 完整履历和非完整履历靠规则计算，不靠手工填

------

## 5.9 RuleEngine Module

### 作用

配置规则并触发事件、结算、冻结。

### P1 只做三类规则

- 事件触发规则
- 健康度权重规则
- 战绩结算规则

### P2 再扩展

- 履历分类规则
- 申诉冻结规则
- 高级组合规则

### 技术实现建议

P1 不要自研复杂规则 DSL。
直接用：

- JSON 配置
- Python 条件判断
- 规则版本表

足够。

------

## 5.10 MapProjection Module

### 作用

把业务数据转成前端地图需要的数据结构。

### 为什么单独做

不要让前端自己拼一堆业务数据。
后端应输出“地图投影 DTO”，例如：

- 点位
- 颜色
- 尺寸
- 图层类型
- 提示信息
- 热点标记
- 面板摘要

这能显著降低前端复杂度。

------

# 6. 数据库设计建议

## 6.1 数据库选型

**PostgreSQL**

### 原因

- 关系数据强
- JSONB 灵活
- 后续可接 PostGIS
- 账本、履历、工单都很适合

## 6.2 命名建议

- 表名统一小写下划线
- 主键统一 `id` 或 `<entity>_id`
- 时间字段统一 `created_at`, `updated_at`

## 6.3 关键表关系

### season

赛季主表

### project

项目主表

### management_unit

建管单位 / 战区

### owner_command_post

督军府

### advisor_assignment

军师任职

### contractor_unit

施工单位 / 军团

### battle_unit

施工项目部 / 作战军

### person

人员

### event

事件

### work_order

工单

### performance_ledger

战绩账本

### career_record

履历

------

# 7. API 设计建议

采用 REST API，P1 足够。

## 7.1 Season

- `GET /api/seasons/current`
- `POST /api/seasons`
- `POST /api/seasons/{id}/publish`
- `GET /api/seasons/{id}/rankings`

## 7.2 Project / Role

- `GET /api/projects/{id}`
- `GET /api/projects/{id}/roles`
- `POST /api/projects/{id}/advisors`
- `POST /api/projects/{id}/battle-units`

## 7.3 Event

- `GET /api/events`
- `GET /api/events/{id}`
- `POST /api/events/manual`
- `PATCH /api/events/{id}/confirm`
- `PATCH /api/events/{id}/clear`

## 7.4 Work Order

- `GET /api/work-orders`
- `POST /api/work-orders`
- `PATCH /api/work-orders/{id}/accept`
- `PATCH /api/work-orders/{id}/submit`
- `PATCH /api/work-orders/{id}/approve`
- `PATCH /api/work-orders/{id}/reject`
- `PATCH /api/work-orders/{id}/freeze`

## 7.5 Daily Loop

- `GET /api/daily-loops`
- `POST /api/daily-evaluations`
- `POST /api/rectifications`

## 7.6 Health / Score / Career

- `GET /api/projects/{id}/health`
- `GET /api/scores/person/{id}`
- `GET /api/scores/unit/{id}`
- `GET /api/careers/person/{id}`

------

# 8. 前端设计建议

## 8.1 页面路由

- `/overview`
- `/warzones/:id`
- `/projects/:id`
- `/events`
- `/work-orders`
- `/daily-loops`
- `/scores`
- `/careers`

## 8.2 状态管理

Zustand 建议拆四个 store：

- `appStore`：用户、赛季、全局状态
- `filterStore`：筛选条件
- `mapStore`：地图图层、选中对象、热点状态
- `panelStore`：右侧详情、底部面板、弹窗

不要把所有状态塞一个 store。

## 8.3 地图层设计

P1 继续保持轻量：

- Layer 0：底图
- Layer 1：战区色块
- Layer 2：站班会点位
- Layer 3：热点高亮
- Layer 4：军令/事件飞线（可选）
- Layer 5：交互高亮层

这和当前需求里“地图只渲染站班会点位图层，变电站独立点位和杆塔线路后续再引入”的边界一致。

------

# 9. 部署设计建议

## 9.1 P1 部署

建议最简单的三件套：

- 前端：Nginx
- 后端：FastAPI + Uvicorn/Gunicorn
- 数据库：PostgreSQL

如果想更省事：

- Docker Compose 一把拉起

## 9.2 环境划分

- dev
- test
- prod

## 9.3 部署结构

```text
[Browser]
   |
[Nginx]
   |---- static frontend
   |---- /api -> FastAPI
   |
[FastAPI]
   |---- PostgreSQL
   |---- Redis(optional)
```

------

# 10. P1 开发顺序

我建议按下面顺序做，最稳。

## 第 1 周：基础骨架

- 后端项目初始化
- 数据库初始化
- 角色与项目主数据模型
- 前端路由与布局骨架
- Overview / Project 页面空壳

## 第 2 周：事件与工单

- Event Module
- WorkOrder Module
- 工单中心页面
- 项目页事件 / 工单面板

## 第 3 周：战绩与履历

- Score Module
- Career Module
- 战绩中心
- 履历中心

## 第 4 周：健康度与地图联动

- Health Module
- 项目健康度计算
- 地图热点 / 面板联动
- 联调测试

------

# 11. 为什么这版更适合你当前阶段

这版的核心不是“技术上最酷”，而是“你现在最容易推进”。

原因有四个：

第一，**前端不换栈**。
你当前MVP已经固定在 React + TS + Vite + Tailwind + Zustand + MapLibre + ECharts 上，继续沿用能最大限度复用现有代码和认知。

第二，**后端不走重路线**。
FastAPI + SQLModel + PostgreSQL 足够支撑 P1 的赛季、角色、事件、工单、战绩、履历，不会把时间耗在基础设施上。

第三，**架构先模块化单体，不急着微服务**。
你现在的关键矛盾不是并发量，而是业务机制要不要跑得通。先做模块化单体最合理。

第四，**节奏符合现有业务演进**。
当前需求里明确第二轮还是静态数据和按天切换，后续才是轮询 / WebSocket。技术路线也应先准实时、后实时。

------

# 12. 我现在需要你确认的一件事

我先按**后端使用 Python（FastAPI + SQLModel）**继续往下出更细的技术设计。
若你后端其实更想用 **Java / Spring Boot** 或 **Node.js / NestJS**，告诉我一句，我就直接改成那一版，不再重讲业务。