# 输变电工程数字沙盘系统

基于 React + TypeScript + MapLibre GL JS 的电力工程作业态势监控系统。

**当前版本**: M1 Round2 - 真实骨架地图 + 变电站接入 + 图层控制

> 新接手请先阅读 [项目交接说明](doc/项目交接说明.md)。该文档按当前代码实际实现整理了启动方式、数据流、已知限制和后续建议。

---

## 功能特性

### 核心功能

- **地图展示**: 湖南省范围地图，叠加作业点、杆塔和变电站图层
- **点位渲染**: 作业点点大小映射人数，点颜色映射风险等级
- **骨架地图**: 后端返回线路、杆塔、变电站数据；当前前端渲染杆塔点位（三角形）和变电站点位（五角星），线路暂不渲染
- **多维筛选**: 支持按作业状态、风险等级、电压等级筛选
- **详情面板**: 点击地图对象（作业点/杆塔/变电站）查看详情
- **统计面板**: 实时统计作业点数量、人数、风险分布、市州分布
- **图层控制**: 独立开关控制杆塔、作业点、变电站图层的显隐
- **时间轴（按天）**: 按天切换历史数据，支持上一天/下一天导航、自动播放

### 页面状态

- loading / error / empty / filtered-empty / ready 完整状态覆盖
- 日期越界控制（首天/末天按钮自动禁用）
- 选中项被筛掉后自动清空详情

---

## 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **地图引擎**: MapLibre GL JS 3.6
- **状态管理**: Zustand
- **图表库**: ECharts 5
- **样式**: TailwindCSS
- **后端框架**: Python 3.11 + FastAPI
- **数据库**: SQLite + SQLModel + Alembic
- **测试**: Vitest + Testing Library

---

## 项目结构

```
vibe-monitor/
├── frontend/                    # 前端 React 应用
│   ├── api/                     # API 客户端层
│   │   ├── client.ts            # HTTP 客户端（GET / upload）
│   │   ├── config.ts            # 数据源配置（mock / api / local）
│   │   ├── adapter.ts           # 数据适配器
│   │   ├── mapApi.ts            # 地图 API（summary / bootstrap / skeleton）
│   │   └── index.ts             # 统一导出
│   ├── app/
│   │   └── App.tsx              # 主应用组件（页面布局 + 状态路由）
│   ├── constants/
│   │   ├── index.ts             # 常量（电压等级等）
│   │   ├── map.ts               # 地图配置（中心点/缩放/样式）
│   │   └── layers.ts            # 图层配置（颜色/点位/边界）
│   ├── features/
│   │   ├── filter/              # 筛选面板
│   │   │   └── FilterPanel.tsx  # 状态/风险/电压筛选 + 图层控制
│   │   ├── map/                 # 地图容器
│   │   │   └── MapContainer.tsx # MapLibre 初始化 + 图层管理 + 点击交互
│   │   ├── detail/              # 详情面板
│   │   │   └── DetailPanel.tsx  # 作业点/杆塔/变电站详情展示
│   │   ├── stats/               # 统计面板
│   │   │   ├── StatsPanel.tsx   # 统计面板主组件
│   │   │   ├── StatCard.tsx     # 统计卡片
│   │   │   ├── RiskChart.tsx    # 风险分布图
│   │   │   ├── DistributionChart.tsx # 市州分布图
│   │   │   ├── InfoTooltip.tsx  # 信息提示
│   │   │   └── chartConfigs.ts  # 图表配置
│   │   └── timeline/            # 时间轴组件
│   │       ├── Timeline.tsx     # 日期切换/播放控制
│   │       └── Timeline.test.tsx
│   ├── lib/
│   │   ├── dataParser.ts        # 数据清洗与归一化
│   │   ├── dateDataLoader.ts    # 按日期加载 JSON 数据
│   │   ├── filter.ts            # 筛选逻辑
│   │   ├── geojson.ts           # GeoJSON 转换
│   │   ├── stats.ts             # 统计计算
│   │   ├── useDataLoader.ts     # 数据加载 Hook
│   │   └── lruCache.ts          # LRU 缓存
│   ├── store/
│   │   └── index.ts             # Zustand 全局状态
│   ├── types/
│   │   └── index.ts             # TypeScript 类型定义
│   ├── styles/
│   │   └── globals.css          # 全局样式
│   ├── test/
│   │   └── setup.ts             # 测试环境配置
│   ├── scripts/                 # 前端辅助脚本
│   │   ├── generate-data-index.js
│   │   └── validate-frontend-chain.js
│   ├── index.html               # Vite HTML 入口
│   ├── package.json             # 前端依赖与 npm scripts
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   └── main.tsx                 # React 入口文件
├── backend/                     # 后端 FastAPI 服务
│   ├── app/
│   │   ├── api/                 # API 路由
│   │   │   ├── health.py        # GET /health
│   │   │   ├── bootstrap.py     # GET /api/bootstrap
│   │   │   ├── map_summary.py   # GET /api/map/summary
│   │   │   ├── skeleton.py      # GET /api/map/skeleton
│   │   │   ├── import_routes.py # POST /api/import/*
│   │   │   └── routes.py        # 路由注册
│   │   ├── core/                # 核心配置
│   │   │   ├── config.py        # 应用配置（CORS 等）
│   │   │   └── db.py            # 数据库连接/初始化
│   │   ├── importers/           # 数据导入服务
│   │   │   ├── import_service.py    # 基础导入器
│   │   │   ├── year_progress_importer.py
│   │   │   ├── tower_importer.py
│   │   │   ├── meeting_importer.py
│   │   │   ├── line_importer.py
│   │   │   └── station_importer.py
│   │   ├── models/
│   │   │   ├── base.py          # 基础模型
│   │   │   └── m0_models.py     # 全部数据模型
│   │   ├── schemas/
│   │   │   └── responses.py     # 响应模型
│   │   └── main.py              # FastAPI 应用入口
│   ├── alembic/                 # 数据库迁移
│   ├── scripts/                 # 后端维护、导入、诊断脚本
│   │   ├── db/
│   │   ├── imports/
│   │   └── diagnostics/
│   ├── tests/                   # pytest 测试目录
│   ├── pyproject.toml           # uv 项目与依赖配置
│   └── uv.lock                  # uv 锁文件
├── data/                        # 数据文件目录
├── doc/                         # 文档目录
│   ├── M0需求分析.md
│   ├── M1需求分析.md
│   └── 验收清单.md
└── README.md
```

---

## 数据说明

### 数据源

当前前端支持双数据源：

| 数据源 | 模式 | 说明 |
|--------|------|------|
| 本地静态 JSON | `local`（默认） | 从 `/data/daily_meeting/meeting_YYYYMMDD_all.json` 加载；开发/预览由 Vite 读取仓库根目录 `data/` |
| 后端 API | `api` | 从 `GET /api/map/summary` 获取 |

前端默认使用 `local` 模式，因此仅运行前端即可演示站班会作业点。API 模式可通过 `setDataSource('api')` 切换，但当前前端 API baseUrl 默认为 `http://localhost:8001`，后端默认端口为 `8000`，使用 API 模式前需要统一端口。

### 数据文件组织

```
项目根目录/
├── data/                          # 原始数据源目录
│   ├── daily_meeting/             # 站班会数据
│   ├── tower/                     # 杆塔数据
│   ├── year_progress_formation/   # 年度目标数据
│   └── substation_coordinates/    # 变电站坐标数据（M1R2）
│
└── frontend/public/data/          # 前端静态资源目录
    └── daily_meeting/index.json   # 日期清单（manifest）
```

**重要说明**：
- `data/` 目录：存放原始数据文件
- `frontend/public/data/daily_meeting/index.json`：日期清单，系统通过此文件发现可用日期
- 开发/预览环境中，`frontend/vite.config.ts` 会把仓库根目录 `data/` 暴露为浏览器路径 `/data/`
- 新增数据文件后，需运行 `npm run generate:data-index` 更新 `index.json`

### 数据字段映射

| 原始字段 | 归一化字段 | 说明 |
|---------|-----------|------|
| `prjName` | `projectName` | 工程名称 |
| `toolBoxTalkLongitude` | `longitude` | 经度 |
| `toolBoxTalkLatitude` | `latitude` | 纬度 |
| `currentConstrHeadcount` | `personCount` | 当前作业人数 |
| `reAssessmentRiskLevel` | `riskLevel` | 风险等级(1-4/unknown) |
| `currentConstructionStatus` | `workStatus` | 作业状态 |
| `voltageLevel` | `voltageLevel` | 电压等级编码 |
| `buildUnitName` | `city` | 市州 |

---

## 开发命令

### 前端

```bash
# 进入前端工程
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 代码检查
npm run lint

# 运行测试
npm run test

# 生成数据日期清单
npm run generate:data-index
```

### 后端

```bash
# 进入后端工程
cd backend

# 安装依赖
uv sync --dev

# 启动后端服务
uv run python run.py

# 数据库状态对齐
uv run python scripts/db/align_db.py

# 数据库迁移
uv run alembic upgrade head
```

---

## 时间轴使用说明

### 基本操作

- **当前日期显示**: 顶部标题栏右侧显示当前选中日期（YYYY年MM月DD日格式）
- **日期选择**: 下拉框快速跳转到指定日期
- **上一天/下一天**: 点击按钮切换日期，边界自动禁用
- **播放/暂停**: 按天自动轮播，到达最后一天自动停止
- **键盘快捷键**: 左方向键 = 上一天，右方向键 = 下一天

### 日期切换行为

- **筛选条件**: 切换日期时保持不变
- **选中项**: 若选中项在新日期存在则保留，不存在则清空
- **统计数据**: 自动重新计算当前日期的统计

---

## 筛选逻辑

### 作业状态
- `all`: 全部（包含未知状态）
- `working`: 作业中
- `paused`: 作业暂停
- `finished`: 当日作业完工

### 风险等级
- 1-4 级: 正常风险等级（1=最高，4=最低）
- `unknown`: 未知风险（灰色显示，展示口径为"无风险"）

### 电压等级
基于显示名称筛选：1000kV、±800kV、500kV、220kV、110kV、35kV、10kV

---

## 图层控制

在筛选面板底部提供图层显隐开关：

| 图层 | 标识 | 渲染方式 |
|------|------|----------|
| 杆塔 (Tower) | 紫色三角形 | Symbol layer，icon-size: 0.6 |
| 作业点 (WorkPoint) | 红色圆点（大小映射人数） | Circle layer，半径随人数变化 |
| 变电站 (Station) | 红色五角星 | Symbol layer，icon-size: 0.7 |

> 注：线路图层（Line）在 M1R2 中已移除，等待更可靠数据后再恢复。

---

## 详情面板

点击地图上的对象可在右侧详情面板查看信息：

### 作业点详情
- 工程名称、风险等级、作业人数、作业状态
- 电压等级、市州、作业地点
- 施工单位、监理单位、工作负责人
- 作业内容、作业票号、作业日期

### 杆塔详情
- 杆塔编号、所属线路、坐标

### 变电站详情
- 变电站名称、项目编码、坐标

---

## 统计口径

- **当日作业点总数**: 合法坐标记录数（指当前选中日期）
- **当前作业总人数**: 合法坐标记录的人数之和
- **风险分布**: 按记录数统计
- **市州分布 Top5**: 按记录数统计，不含"其他"

必须保证：**地图标记数量 == 当日作业点总数**

---

## 坐标过滤规则

以下记录会被过滤（不上图、不参与统计）：
- 经纬度为空
- 经纬度非数字
- 经纬度超出湖南范围（经度 108.6~114.3，纬度 24.6~30.2）
- 经纬度为 0

---

## 后端 API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/bootstrap` | GET | 系统启动信息（含 unresolved 统计） |
| `/api/map/summary` | GET | 地图摘要数据（作业点位） |
| `/api/map/skeleton` | GET | 骨架地图数据（线路+杆塔+变电站） |
| `/api/import/year-progress` | POST | 年度目标数据导入 |
| `/api/import/towers` | POST | 杆塔数据导入 |
| `/api/import/meetings` | POST | 站班会数据导入 |

---

## 数据库模型

| 表名 | 用途 | 阶段 |
|------|------|------|
| `import_batch` | 导入批次记录 | M0 |
| `raw_year_progress` / `year_progress_current` | 年度目标数据 | M0 |
| `raw_tower` / `tower_current` | 杆塔数据 | M0 |
| `raw_meeting_snapshot` / `meeting_current` | 站班会数据 | M0 |
| `raw_line` / `line_current` | 线路数据 | M1R1 |
| `raw_station` / `station_current` | 变电站数据 | M1R2 |

---

## 当前未实现功能

以下功能在当前阶段中**尚未实现**：

| 功能 | 说明 | 计划阶段 |
|------|------|----------|
| **WebSocket** | 无实时数据推送 | 后续阶段 |
| **按小时时间轴** | 当前仅支持按天切换 | 后续阶段视需求 |
| **线路轨迹上图** | M1R1 已实现但暂移除（等待更可靠数据） | M1 Round3 |
| **线路电压等级** | 字段未对齐，当前为 null | M1 Round3 |
| **YearProgress 完整映射** | 491 条 unresolved 记录待映射 | M1 Round2/3 |
| **登录权限** | 无认证机制 | 后续阶段 |
| **数据导出** | 无导出功能 | 后续阶段 |
| **移动端适配** | 仅桌面端 | 后续阶段 |

---

## 浏览器支持

- Chrome 90+
- Firefox 90+
- Safari 14+
- Edge 90+

---

## 版本历史

- **MVP 第一轮** (2026-04-05): 当前作业上图闭环
- **MVP 第二轮** (2026-04-11): 时间轴与历史回溯（按天版本）
- **M0 首轮** (2026-04-18): 后端数据源接入（FastAPI + SQLite + SQLModel）
- **M0 第二轮** (2026-04-18): 数据标准收紧与工程稳固
- **M1 Round1** (2026-04-18): 真实骨架地图（线路 + 杆塔）
- **M1 Round2** (2026-04-18): 变电站接入 + 图层控制 + 详情面板统一 + 线路暂移除
- **M1 Round3** (计划中): YearProgress 完整映射 + 线路恢复

---

## 许可证

Private
