import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as echarts from 'echarts';
import { useAppStore } from '@/store';
import { calculateStats, validateConsistency, calculateStatsChangesAsync } from '@/lib/stats';
import type { StatsData, StatsChanges } from '@/lib/stats';
import { LRUCache } from '@/lib/lrucache';
import { getSparklineOption } from './chartConfigs';
import { StatCard } from './StatCard';
import { RiskChart } from './RiskChart';
import { DistributionChart } from './DistributionChart';

// 历史趋势数据类型
interface TrendData {
  dates: string[];
  points: number[];
  persons: number[];
}

// Tooltip 信息类型
interface TooltipInfo {
  calculationPeriod: string;
  noWorkDates: string;
}

export function StatsPanel() {
  const { filteredData, pageStatus, currentDate, availableDates } = useAppStore();

  // 迷你趋势图 ref
  const pointsTrendRef = useRef<HTMLDivElement>(null);
  const personsTrendRef = useRef<HTMLDivElement>(null);
  const pointsTrendInstance = useRef<echarts.ECharts | null>(null);
  const personsTrendInstance = useRef<echarts.ECharts | null>(null);

  // 计算统计数据 - 使用 useMemo 避免每次渲染都创建新对象
  const stats = useMemo(() => calculateStats(filteredData), [filteredData]);

  // 变化值状态（基于真实历史数据）
  const [statsChanges, setStatsChanges] = useState<StatsChanges>({
    hasWork: stats.totalPoints > 0,
    prevWorkingDay: null,
    recent30Days: null,
  });
  const [isLoadingChanges, setIsLoadingChanges] = useState(false);

  // 趋势图数据
  const [trendData, setTrendData] = useState<TrendData>({ dates: [], points: [], persons: [] });

  // Tooltip 信息
  const [tooltipInfo, setTooltipInfo] = useState<TooltipInfo>({ calculationPeriod: '', noWorkDates: '' });

  // 历史数据缓存（LRU 缓存，最大 60 条，防止无上限增长）
  // 选择 60 的理由：支持最近 60 个有作业日的缓存，足够覆盖近 2 个月的数据访问
  const historicalCacheRef = useRef<LRUCache<string, StatsData>>(new LRUCache(60));

  // 使用 ref 存储 stats 避免依赖项频繁变化导致的无限循环
  const statsRef = useRef(stats);
  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  // 计算变化值（基于真实历史数据）
  const loadChanges = useCallback(async () => {
    const currentStats = statsRef.current;

    // 如果日期数据未准备好，直接显示无变化数据状态
    if (!currentDate || availableDates.length === 0) {
      setStatsChanges({ hasWork: currentStats.totalPoints > 0, prevWorkingDay: null, recent30Days: null });
      setTrendData({ dates: [], points: [], persons: [] });
      setTooltipInfo({ calculationPeriod: '', noWorkDates: '' });
      setIsLoadingChanges(false);
      return;
    }

    setIsLoadingChanges(true);
    try {
      const changes = await calculateStatsChangesAsync(
        currentStats,
        currentDate,
        availableDates,
        historicalCacheRef.current
      );
      setStatsChanges(changes);

      // 加载趋势图数据（最近 30 个有作业日）并生成 tooltip 信息
      await loadTrendDataAndTooltip(currentDate, availableDates);
    } catch (err) {
      console.error('[StatsPanel] 加载变化值失败:', err);
      setStatsChanges({ hasWork: currentStats.totalPoints > 0, prevWorkingDay: null, recent30Days: null });
      setTrendData({ dates: [], points: [], persons: [] });
      setTooltipInfo({ calculationPeriod: '', noWorkDates: '' });
    } finally {
      setIsLoadingChanges(false);
    }
  }, [currentDate, availableDates]);

  // 加载趋势图数据并生成 tooltip 信息
  const loadTrendDataAndTooltip = async (currentDate: string, availableDates: string[]) => {
    const currentIndex = availableDates.indexOf(currentDate);
    if (currentIndex === -1) return;

    const trendDates: string[] = [];
    const trendPoints: number[] = [];
    const trendPersons: number[] = [];
    const noWorkDatesList: string[] = [];

    // 收集最近 30 个有作业日（包括当前日期）
    for (let i = currentIndex; i >= 0 && trendDates.length < 30; i--) {
      const date = availableDates[i];
      let historyStats = historicalCacheRef.current.get(date);

      if (!historyStats) {
        try {
          const { loadAndParseByDate } = await import('@/lib/dateDataLoader');
          const result = await loadAndParseByDate(date);
          historyStats = calculateStats(result.normalizedData);
          historicalCacheRef.current.set(date, historyStats);
        } catch (err) {
          console.warn(`[TrendData] 加载历史数据失败：${date}`, err);
          continue;
        }
      }

      if (historyStats.totalPoints > 0) {
        trendDates.unshift(date); // 从旧到新排序
        trendPoints.unshift(historyStats.totalPoints);
        trendPersons.unshift(historyStats.totalPersons);
      } else {
        noWorkDatesList.unshift(date);
      }
    }

    setTrendData({ dates: trendDates, points: trendPoints, persons: trendPersons });

    // 生成 tooltip 信息
    const calculationPeriod = trendDates.length > 0
      ? `${trendDates[0].replace(/-/g, '')}-${trendDates[trendDates.length - 1].replace(/-/g, '')}`
      : '';
    const noWorkDates = compressDateRanges(noWorkDatesList);

    setTooltipInfo({ calculationPeriod, noWorkDates });
  };

  // 压缩日期范围为区间显示
  const compressDateRanges = (dates: string[]): string => {
    if (dates.length === 0) return '无';

    const sorted = [...dates].sort();
    const result: string[] = [];
    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const prev = sorted[i - 1];
      const prevDate = new Date(prev);
      const currentDate = new Date(current);
      const diffDays = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        // 连续日期
        end = current;
      } else {
        // 不连续，保存当前区间
        if (start === end) {
          result.push(start.replace(/-/g, ''));
        } else {
          result.push(`${start.replace(/-/g, '')}-${end.replace(/-/g, '')}`);
        }
        start = current;
        end = current;
      }
    }

    // 保存最后一个区间
    if (start === end) {
      result.push(start.replace(/-/g, ''));
    } else {
      result.push(`${start.replace(/-/g, '')}-${end.replace(/-/g, '')}`);
    }

    return result.join('，');
  };

  // 一致性校验（调试用）
  useEffect(() => {
    if (pageStatus === 'ready' || pageStatus === 'filtered_empty') {
      validateConsistency(filteredData.length, stats.totalPoints);
    }
  }, [filteredData.length, stats.totalPoints, pageStatus]);

  // 加载变化值（基于真实历史数据）
  useEffect(() => {
    loadChanges();
  }, [loadChanges]);

  // 初始化并更新迷你趋势图 - 作业点数
  useEffect(() => {
    if (!pointsTrendRef.current || trendData.points.length === 0) return;

    if (!pointsTrendInstance.current) {
      pointsTrendInstance.current = echarts.init(pointsTrendRef.current);
    }

    const option = getSparklineOption(trendData.points, '#3b82f6');
    pointsTrendInstance.current.setOption(option, { notMerge: true, lazyUpdate: true });

    return () => {
      pointsTrendInstance.current?.dispose();
      pointsTrendInstance.current = null;
    };
  }, [trendData.points]);

  // 初始化并更新迷你趋势图 - 作业人数
  useEffect(() => {
    if (!personsTrendRef.current || trendData.persons.length === 0) return;

    if (!personsTrendInstance.current) {
      personsTrendInstance.current = echarts.init(personsTrendRef.current);
    }

    const option = getSparklineOption(trendData.persons, '#10b981');
    personsTrendInstance.current.setOption(option, { notMerge: true, lazyUpdate: true });

    return () => {
      personsTrendInstance.current?.dispose();
      personsTrendInstance.current = null;
    };
  }, [trendData.persons]);

  // 窗口大小变化时重新调整图表
  useEffect(() => {
    const handleResize = () => {
      pointsTrendInstance.current?.resize();
      personsTrendInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isFilteredEmpty = pageStatus === 'filtered_empty';

  return (
    <div className="panel p-4 h-full flex flex-col">
      <h2 className="panel-title mb-3">统计数据</h2>

      {/* 卡片网格 - 固定高度结构，不受数据状态影响 */}
      <div className="grid grid-cols-4 gap-4 flex-1 min-h-0">
        {/* 当日作业点总数 - 指数卡片样式 */}
        <StatCard
          title="当日作业点总数"
          value={stats.totalPoints}
          trendRef={pointsTrendRef}
          prevDayChange={statsChanges.prevWorkingDay?.pointsChange ?? 0}
          prevDayRate={statsChanges.prevWorkingDay?.pointsChangeRate ?? 0}
          monthChange={statsChanges.recent30Days?.pointsDeviation ?? 0}
          monthRate={statsChanges.recent30Days?.pointsDeviationRate ?? 0}
          hasPrevDay={!!statsChanges.prevWorkingDay}
          hasMonthData={!!statsChanges.recent30Days}
          isLoading={isLoadingChanges}
          hasWork={statsChanges.hasWork}
          tooltipInfo={tooltipInfo}
        />

        {/* 当前作业总人数 - 指数卡片样式 */}
        <StatCard
          title="当前作业总人数"
          value={stats.totalPersons}
          trendRef={personsTrendRef}
          prevDayChange={statsChanges.prevWorkingDay?.personsChange ?? 0}
          prevDayRate={statsChanges.prevWorkingDay?.personsChangeRate ?? 0}
          monthChange={statsChanges.recent30Days?.personsDeviation ?? 0}
          monthRate={statsChanges.recent30Days?.personsDeviationRate ?? 0}
          hasPrevDay={!!statsChanges.prevWorkingDay}
          hasMonthData={!!statsChanges.recent30Days}
          isLoading={isLoadingChanges}
          hasWork={statsChanges.hasWork}
          tooltipInfo={tooltipInfo}
        />

        {/* 风险分布图 */}
        <RiskChart stats={stats} isFilteredEmpty={isFilteredEmpty} />

        {/* 建管单位分布 Top5 */}
        <DistributionChart stats={stats} isFilteredEmpty={isFilteredEmpty} />
      </div>
    </div>
  );
}
