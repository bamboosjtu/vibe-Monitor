import type { RiskLevel } from '@/types';
import type { CircleLayerSpecification, LineLayerSpecification, FillLayerSpecification } from 'maplibre-gl';

/**
 * 风险等级颜色配置
 * 业务语义：
 * - 一级风险(1): 最高风险 -> 红色
 * - 二级风险(2): 较高风险 -> 橙色
 * - 三级风险(3): 中等风险 -> 黄色
 * - 四级风险(4): 较低风险 -> 蓝色
 * - 无风险(0): 绿色
 * - 未知风险: 灰色
 */
export const RISK_COLORS: Record<RiskLevel, string> = {
  0: '#22c55e',   // 绿色 - 无风险
  1: '#ef4444',   // 红色 - 一级风险（最高）
  2: '#f97316',   // 橙色 - 二级风险（较高）
  3: '#eab308',   // 黄色 - 三级风险（中等）
  4: '#3b82f6',   // 蓝色 - 四级风险（较低）
  unknown: '#6b7280', // 灰色 - 未知风险
};

/**
 * CircleLayer 配置
 * 点大小映射 personCount（0-300）
 */
export const POINT_LAYER_CONFIG: CircleLayerSpecification = {
  id: 'station-points',
  source: 'workpoint-data',
  type: 'circle',
  paint: {
    // 圆半径：基于 personCount，最小 5px，最大 20px（对齐冻结需求）
    'circle-radius': [
      'interpolate',
      ['linear'],
      ['get', 'personCount'],
      0, 5,
      50, 8,
      100, 12,
      200, 16,
      300, 20,
    ],
    // 圆颜色：基于 riskLevel
    'circle-color': [
      'match',
      ['get', 'riskLevel'],
      0, RISK_COLORS[0],
      1, RISK_COLORS[1],
      2, RISK_COLORS[2],
      3, RISK_COLORS[3],
      4, RISK_COLORS[4],
      RISK_COLORS.unknown,
    ],
    // 边框
    'circle-stroke-width': 1,
    'circle-stroke-color': '#ffffff',
    'circle-stroke-opacity': 0.8,
    // 透明度
    'circle-opacity': 0.85,
  },
};

/**
 * 选中态点位图层配置
 * 使用描边高亮，半径略大于原点位
 */
export const SELECTED_POINT_LAYER_CONFIG: CircleLayerSpecification = {
  id: 'selected-point',
  source: 'selected-point',
  type: 'circle',
  paint: {
    // 半径比原点位大 3px
    'circle-radius': [
      'interpolate',
      ['linear'],
      ['get', 'personCount'],
      0, 8,
      50, 11,
      100, 15,
      200, 19,
      300, 23,
    ],
    // 填充透明，只显示描边
    'circle-color': 'rgba(0, 0, 0, 0)',
    // 高亮描边
    'circle-stroke-width': 3,
    'circle-stroke-color': '#3b82f6',
    'circle-stroke-opacity': 1,
  },
};

/**
 * 边界图层配置（复用）
 */
export const BOUNDARY_LAYER_CONFIG = {
  line: {
    id: 'hunan-boundary-line',
    type: 'line',
    source: 'hunan-boundary',
    paint: {
      'line-color': '#3b82f6',
      'line-width': 2,
      'line-opacity': 0.8,
    },
  } as LineLayerSpecification,
  fill: {
    id: 'hunan-boundary-fill',
    type: 'fill',
    source: 'hunan-boundary',
    paint: {
      'fill-color': '#3b82f6',
      'fill-opacity': 0.05,
    },
  } as FillLayerSpecification,
};
