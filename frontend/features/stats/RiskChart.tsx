import { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import type { StatsData } from '@/lib/stats';
import { getRiskChartOption } from './chartConfigs';

interface RiskChartProps {
  stats: StatsData;
  isFilteredEmpty: boolean;
}

export function RiskChart({ stats, isFilteredEmpty }: RiskChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // 初始化图表
  useEffect(() => {
    if (!chartRef.current) return;
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  // 更新图表数据
  useEffect(() => {
    if (!chartInstance.current) return;
    const option = getRiskChartOption(stats);
    chartInstance.current.setOption(option, { notMerge: false, lazyUpdate: true });
  }, [stats]);

  return (
    <div className="bg-gray-50 rounded p-4 border border-gray-200 h-full flex flex-col relative">
      <div className="text-sm text-gray-500 mb-2">风险分布</div>
      <div ref={chartRef} className="w-full flex-1 min-h-0" />
      {isFilteredEmpty && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 rounded">
          <span className="text-sm text-gray-400">筛选无结果</span>
        </div>
      )}
    </div>
  );
}
