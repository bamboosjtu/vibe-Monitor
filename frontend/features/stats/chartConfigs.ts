/**
 * 图表配置轻量集中管理
 * 
 * 提取重复或稳定的 ECharts 配置项，降低组件内代码复杂度
 * 不做图表体系重构，仅做配置提取
 */

import type { StatsData } from '@/lib/stats';
import { RISK_COLORS } from '@/constants/layers';

/**
 * 迷你趋势图配置（sparkline）
 * 用于统计卡片中的迷你折线图/面积图
 */
export function getSparklineOption(data: number[], color: string): echarts.EChartsOption {
  return {
    grid: {
      left: 0,
      right: 0,
      top: 2,
      bottom: 2,
    },
    xAxis: {
      type: 'category',
      show: false,
      data: data.map((_, i) => i),
    },
    yAxis: {
      type: 'value',
      show: false,
      min: Math.min(...data) * 0.9,
      max: Math.max(...data) * 1.1,
    },
    series: [
      {
        type: 'line',
        data: data,
        smooth: true,
        symbol: 'none',
        lineStyle: {
          color: color,
          width: 2,
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: color + '40' }, // 25% opacity
              { offset: 1, color: color + '00' }, // 0% opacity
            ],
          },
        },
        animation: false,
      },
    ],
  };
}

/**
 * 风险分布图表配置
 * 业务语义：一级 (1)=最高风险 (红)，四级 (4)=较低风险 (蓝)，无风险=灰色
 * 展示口径：底层数据中的 unknown 在 UI 上统一显示为"无风险"
 */
export function getRiskChartOption(stats: StatsData): echarts.EChartsOption {
  const data = [
    { value: stats.riskDistribution[1], name: '一级', itemStyle: { color: RISK_COLORS[1] } },
    { value: stats.riskDistribution[2], name: '二级', itemStyle: { color: RISK_COLORS[2] } },
    { value: stats.riskDistribution[3], name: '三级', itemStyle: { color: RISK_COLORS[3] } },
    { value: stats.riskDistribution[4], name: '四级', itemStyle: { color: RISK_COLORS[4] } },
    { value: stats.riskDistribution.unknown, name: '无风险', itemStyle: { color: RISK_COLORS.unknown } },
  ].filter(item => item.value > 0);

  return {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: true,
          fontSize: 12,
          formatter: '{b}\n{c}',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 13,
            fontWeight: 'bold',
          },
        },
        data,
        animation: false,
      },
    ],
  };
}

/**
 * 建管单位分布图表配置
 * 纵轴固定为 0-120，刻度间隔 30
 * 柱高 = 作业点数，标签显示 = 作业人数 (作业点数)
 */
export function getDistributionChartOption(stats: StatsData): echarts.EChartsOption {
  const data = stats.constructionUnitDistribution.map(item => ({
    value: item.points,
    name: item.unit,
    persons: item.persons,
  }));

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const p = params[0];
        const item = stats.constructionUnitDistribution.find(d => d.unit === p.name);
        return `${p.name}<br/>作业点数：${p.value}<br/>作业总人数：${item?.persons || 0}`;
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '5%',
      top: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: data.map(item => item.name),
      axisLabel: {
        fontSize: 11,
        rotate: 0,
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 120,
      interval: 30,
      minInterval: 1,
    },
    series: [
      {
        type: 'bar',
        data: data.map(item => ({
          value: item.value,
          persons: item.persons,
        })),
        itemStyle: {
          color: '#3b82f6',
          borderRadius: [4, 4, 0, 0],
        },
        barWidth: '60%',
        label: {
          show: true,
          position: 'top',
          fontSize: 10,
          color: '#666',
          formatter: (params: any) => {
            const item = stats.constructionUnitDistribution.find(d => d.unit === params.name);
            return `${item?.persons || 0}(${params.value})`;
          },
        },
        animation: false,
      },
    ],
  };
}
