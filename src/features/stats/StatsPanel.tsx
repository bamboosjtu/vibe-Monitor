import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { RISK_COLORS } from '@/constants/layers';
import { useAppStore } from '@/store';
import { calculateStats, validateConsistency } from '@/lib/stats';
import type { StatsData } from '@/lib/stats';

export function StatsPanel() {
  const { filteredData, pageStatus } = useAppStore();
  const riskChartRef = useRef<HTMLDivElement>(null);
  const cityChartRef = useRef<HTMLDivElement>(null);
  const riskChartInstance = useRef<echarts.ECharts | null>(null);
  const cityChartInstance = useRef<echarts.ECharts | null>(null);

  // 计算统计数据
  const stats = calculateStats(filteredData);

  // 一致性校验（调试用）
  useEffect(() => {
    if (pageStatus === 'ready' || pageStatus === 'filtered_empty') {
      validateConsistency(filteredData.length, stats.totalPoints);
    }
  }, [filteredData.length, stats.totalPoints, pageStatus]);

  // 初始化并更新风险分布图表
  useEffect(() => {
    if (!riskChartRef.current) return;

    if (!riskChartInstance.current) {
      riskChartInstance.current = echarts.init(riskChartRef.current);
    }

    const option = getRiskChartOption(stats);
    riskChartInstance.current.setOption(option);

    return () => {
      riskChartInstance.current?.dispose();
      riskChartInstance.current = null;
    };
  }, [stats]);

  // 初始化并更新市州分布图表
  useEffect(() => {
    if (!cityChartRef.current) return;

    if (!cityChartInstance.current) {
      cityChartInstance.current = echarts.init(cityChartRef.current);
    }

    const option = getCityChartOption(stats);
    cityChartInstance.current.setOption(option);

    return () => {
      cityChartInstance.current?.dispose();
      cityChartInstance.current = null;
    };
  }, [stats]);

  // 筛选为空时的提示
  if (pageStatus === 'filtered_empty') {
    return (
      <div className="panel p-4 h-full flex items-center justify-center">
        <div className="text-center text-gray-400">
          <p className="text-sm">筛选无结果</p>
          <p className="text-xs text-gray-300 mt-1">暂无统计数据</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel p-4 h-full flex flex-col">
      <h2 className="panel-title mb-3">统计数据</h2>

      {/* 卡片网格 - 使用 flex-1 充满剩余空间 */}
      <div className="grid grid-cols-4 gap-4 flex-1 min-h-0">
        {/* 当日作业点总数 */}
        <div className="bg-gray-50 rounded p-4 flex flex-col justify-center items-center border border-gray-200 h-full">
          <div className="text-4xl font-bold text-blue-600 mb-2">
            {stats.totalPoints}
          </div>
          <div className="text-sm text-gray-500">当日作业点总数</div>
        </div>

        {/* 当前作业总人数 */}
        <div className="bg-gray-50 rounded p-4 flex flex-col justify-center items-center border border-gray-200 h-full">
          <div className="text-4xl font-bold text-blue-600 mb-2">
            {stats.totalPersons}
          </div>
          <div className="text-sm text-gray-500">当前作业总人数</div>
        </div>

        {/* 风险分布 */}
        <div className="bg-gray-50 rounded p-4 border border-gray-200 h-full flex flex-col">
          <div className="text-sm text-gray-500 mb-2">风险分布</div>
          <div ref={riskChartRef} className="w-full flex-1 min-h-0" />
        </div>

        {/* 市州分布 Top5 */}
        <div className="bg-gray-50 rounded p-4 border border-gray-200 h-full flex flex-col">
          <div className="text-sm text-gray-500 mb-2">市州分布 Top5</div>
          <div ref={cityChartRef} className="w-full flex-1 min-h-0" />
        </div>
      </div>
    </div>
  );
}

/**
 * 风险分布图表配置
 */
function getRiskChartOption(stats: StatsData): echarts.EChartsOption {
  const data = [
    { value: stats.riskDistribution[1], name: '一级', itemStyle: { color: RISK_COLORS[1] } },
    { value: stats.riskDistribution[2], name: '二级', itemStyle: { color: RISK_COLORS[2] } },
    { value: stats.riskDistribution[3], name: '三级', itemStyle: { color: RISK_COLORS[3] } },
    { value: stats.riskDistribution[4], name: '四级', itemStyle: { color: RISK_COLORS[4] } },
    { value: stats.riskDistribution.unknown, name: '未知', itemStyle: { color: RISK_COLORS.unknown } },
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
      },
    ],
  };
}

/**
 * 市州分布图表配置
 */
function getCityChartOption(stats: StatsData): echarts.EChartsOption {
  const data = stats.cityDistribution.map(item => ({
    value: item.count,
    name: item.city,
  }));

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: '{b}: {c}',
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '5%',
      top: '10%',
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
      minInterval: 1,
    },
    series: [
      {
        type: 'bar',
        data: data.map(item => item.value),
        itemStyle: {
          color: '#3b82f6',
          borderRadius: [4, 4, 0, 0],
        },
        barWidth: '60%',
        label: {
          show: true,
          position: 'top',
          fontSize: 11,
          color: '#666',
        },
      },
    ],
  };
}
