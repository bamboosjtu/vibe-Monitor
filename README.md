# 输变电工程数字沙盘系统

基于 React + TypeScript + MapLibre GL JS 的电力工程作业态势监控系统。

## 功能特性

- **地图展示**: 湖南省范围地图，显示站班会作业点位
- **点位渲染**: 点大小映射作业人数，点颜色映射风险等级
- **多维筛选**: 支持按作业状态、风险等级、市州、电压等级筛选
- **详情面板**: 点击点位查看作业详情
- **统计面板**: 实时统计作业点数量、人数、风险分布、市州分布
- **页面状态**: 完整的加载、错误、空数据、筛选空结果状态处理

## 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **地图引擎**: MapLibre GL JS 3.6
- **状态管理**: Zustand
- **图表库**: ECharts 5
- **样式**: TailwindCSS

## 项目结构

```
src/
├── app/
│   └── App.tsx              # 主应用组件
├── features/
│   ├── filter/              # 筛选面板
│   │   └── FilterPanel.tsx
│   ├── map/                 # 地图容器
│   │   └── MapContainer.tsx
│   ├── detail/              # 详情面板
│   │   └── DetailPanel.tsx
│   └── stats/               # 统计面板
│       └── StatsPanel.tsx
├── lib/
│   ├── dataParser.ts        # 数据解析与清洗
│   ├── filter.ts            # 筛选逻辑
│   ├── geojson.ts           # GeoJSON 转换
│   ├── stats.ts             # 统计计算
│   └── useDataLoader.ts     # 数据加载 Hook
├── store/
│   └── index.ts             # Zustand 状态管理
├── constants/
│   ├── index.ts             # 常量定义
│   ├── map.ts               # 地图配置
│   └── layers.ts            # 图层配置
├── types/
│   └── index.ts             # TypeScript 类型定义
└── main.tsx                 # 入口文件
```

## 数据说明

系统使用静态 JSON 数据（`public/data/20260401.json`），包含输变电工程站班会记录。

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

## 开发命令

```bash
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
```

## 筛选逻辑

### 作业状态
- `all`: 全部（包含未知状态）
- `working`: 作业中
- `paused`: 作业暂停
- `finished`: 当日作业完工

### 风险等级
- 1-4 级: 正常风险等级
- `unknown`: 未知风险（灰色显示）

### 市州
基于 `buildUnitName` 字段，包含：长沙、株洲、湘潭、衡阳、邵阳、岳阳、常德、张家界、益阳、郴州、永州、怀化、娄底、湘西、建设分公司

### 电压等级
基于显示名称筛选：1000kV、±800kV、500kV、220kV、110kV、35kV、10kV

## 统计口径

- **当日作业点总数**: 合法坐标记录数
- **当前作业总人数**: 合法坐标记录的人数之和
- **风险分布**: 按记录数统计
- **市州分布 Top5**: 按记录数统计，不含"其他"

## 坐标过滤规则

以下记录会被过滤（不上图、不参与统计）：
- 经纬度为空
- 经纬度非数字
- 经纬度超出湖南范围
- 经纬度为 0

## 浏览器支持

- Chrome 90+
- Firefox 90+
- Safari 14+
- Edge 90+

## 许可证

Private
