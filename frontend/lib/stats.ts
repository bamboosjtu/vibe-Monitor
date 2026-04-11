import type { NormalizedStationMeeting, RiskLevel } from '@/types';
import type { LRUCache } from './lrucache';

/**
 * 统计数据结构
 */
export interface StatsData {
  // 当日作业点总数（合法坐标记录数）
  totalPoints: number;

  // 当前作业总人数（统计/详情值之和）
  totalPersons: number;

  // 风险分布（按记录数统计，包含 0=无风险, 1-4, unknown）
  riskDistribution: Record<RiskLevel, number>;

  // 建管单位分布 Top5（按记录数统计，不包含"其他"）
  // 口径说明：建管单位 = buildUnitName = city（与市州筛选同一字段）
  // 数据结构：points=作业点数（柱高），persons=作业总人数（标签显示）
  constructionUnitDistribution: Array<{ unit: string; points: number; persons: number }>;
}

/**
 * 历史日期统计缓存项
 */
export interface HistoricalStatsItem {
  date: string;
  stats: StatsData;
  normalizedData: NormalizedStationMeeting[];
}

/**
 * 统计卡片变化数据结构（仅用于左侧两个数字卡片）
 */
export interface StatsChanges {
  // 是否有作业（totalPoints > 0）
  hasWork: boolean;

  // 较上一作业日变化
  prevWorkingDay: {
    date: string | null;  // 上一作业日日期
    points: number;       // 上一作业日作业点数
    persons: number;      // 上一作业日作业人数
    pointsChange: number; // 作业点数变化值
    pointsChangeRate: number; // 作业点数变化率
    personsChange: number;    // 作业人数变化值
    personsChangeRate: number; // 作业人数变化率
  } | null;

  // 较近30个有作业日均值变化
  recent30Days: {
    count: number;        // 实际使用的有作业日数量（可能不足30个）
    avgPoints: number;    // 平均作业点数
    avgPersons: number;   // 平均作业人数
    pointsDeviation: number;  // 作业点数偏离值
    pointsDeviationRate: number; // 作业点数偏离率
    personsDeviation: number;    // 作业人数偏离值
    personsDeviationRate: number; // 作业人数偏离率
  } | null;
}

/**
 * 基于 filteredData 计算统计数据
 */
export function calculateStats(data: NormalizedStationMeeting[]): StatsData {
  // 1. 当日作业点总数 = 合法坐标记录数（即 data.length，因为 data 已经过坐标过滤）
  const totalPoints = data.length;
  
  // 2. 当前作业总人数 = 统计/详情值之和
  const totalPersons = data.reduce((sum, item) => sum + item.personCountDisplay, 0);
  
  // 3. 风险分布（按记录数统计，包含 1-4, unknown）
  // 说明：真实数据中 reAssessmentRiskLevel 取值范围为 1-4 或 null，不存在 0 值
  const riskDistribution: Record<RiskLevel, number> = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    unknown: 0,
  };
  
  data.forEach(item => {
    riskDistribution[item.riskLevel]++;
  });
  
  // 4. 建管单位分布 Top5（按记录数统计，不包含"其他"）
  // 口径说明：建管单位 = buildUnitName = city（与市州筛选同一字段）
  // 统计逻辑：points=作业点数（记录数），persons=作业总人数（人员数之和）
  const unitStatsMap = new Map<string, { points: number; persons: number }>();

  data.forEach(item => {
    // 排除"其他"建管单位，使用 city 字段（即 buildUnitName）
    if (item.city && item.city !== '其他') {
      const current = unitStatsMap.get(item.city) || { points: 0, persons: 0 };
      unitStatsMap.set(item.city, {
        points: current.points + 1,
        persons: current.persons + item.personCountDisplay,
      });
    }
  });

  // 排序并取 Top5（按作业点数排序）
  const constructionUnitDistribution = Array.from(unitStatsMap.entries())
    .map(([unit, stats]) => ({ unit, points: stats.points, persons: stats.persons }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);

  return {
    totalPoints,
    totalPersons,
    riskDistribution,
    constructionUnitDistribution,
  };
}

/**
 * 一致性校验
 * 校验地图点位数量与统计点位数是否一致
 */
export function validateConsistency(
  mapPointCount: number,
  statsTotalPoints: number
): boolean {
  const isConsistent = mapPointCount === statsTotalPoints;
  
  if (!isConsistent) {
    console.warn('[Stats Consistency Warning]', {
      mapPointCount,
      statsTotalPoints,
      difference: mapPointCount - statsTotalPoints,
    });
  } else {
    console.log('[Stats Consistency]', {
      mapPointCount,
      statsTotalPoints,
      status: '一致',
    });
  }
  
  return isConsistent;
}

/**
 * 计算统计卡片变化值（仅用于左侧两个数字卡片）
 * 
 * 算法口径：
 * 1. 较上一作业日：当前日期之前，最近一个作业点总数 > 0 的日期
 * 2. 较近30个有作业日均值：当前日期之前，最近30个作业点总数 > 0 的日期
 * 3. 无作业日（totalPoints = 0）：hasWork = false，不显示变化值
 * 4. 无有效数据日：不参与计算
 * 
 * @param currentStats 当前日期的统计数据
 * @param currentDate 当前日期字符串（YYYY-MM-DD）
 * @param availableDates 可用日期列表（已排序）
 * @param historicalStats 历史日期统计数据映射（date -> StatsData）
 */
export function calculateStatsChanges(
  currentStats: StatsData,
  currentDate: string,
  availableDates: string[],
  historicalStats: Map<string, StatsData>
): StatsChanges {
  const hasWork = currentStats.totalPoints > 0;

  // 如果当前无作业，返回 hasWork = false，变化值为 null
  if (!hasWork) {
    return {
      hasWork: false,
      prevWorkingDay: null,
      recent30Days: null,
    };
  }

  const currentIndex = availableDates.indexOf(currentDate);

  // 1. 查找上一作业日
  let prevWorkingDay: StatsChanges['prevWorkingDay'] = null;
  for (let i = currentIndex - 1; i >= 0; i--) {
    const date = availableDates[i];
    const stats = historicalStats.get(date);
    if (stats && stats.totalPoints > 0) {
      const pointsChange = currentStats.totalPoints - stats.totalPoints;
      const personsChange = currentStats.totalPersons - stats.totalPersons;
      prevWorkingDay = {
        date,
        points: stats.totalPoints,
        persons: stats.totalPersons,
        pointsChange,
        pointsChangeRate: stats.totalPoints !== 0 ? pointsChange / stats.totalPoints : 0,
        personsChange,
        personsChangeRate: stats.totalPersons !== 0 ? personsChange / stats.totalPersons : 0,
      };
      break;
    }
  }

  // 2. 收集近30个有作业日
  const workingDays: { date: string; stats: StatsData }[] = [];
  for (let i = currentIndex - 1; i >= 0 && workingDays.length < 30; i--) {
    const date = availableDates[i];
    const stats = historicalStats.get(date);
    if (stats && stats.totalPoints > 0) {
      workingDays.push({ date, stats });
    }
  }

  // 计算近30个有作业日均值
  let recent30Days: StatsChanges['recent30Days'] = null;
  if (workingDays.length > 0) {
    const totalPoints = workingDays.reduce((sum, d) => sum + d.stats.totalPoints, 0);
    const totalPersons = workingDays.reduce((sum, d) => sum + d.stats.totalPersons, 0);
    const avgPoints = totalPoints / workingDays.length;
    const avgPersons = totalPersons / workingDays.length;

    const pointsDeviation = currentStats.totalPoints - avgPoints;
    const personsDeviation = currentStats.totalPersons - avgPersons;

    recent30Days = {
      count: workingDays.length,
      avgPoints,
      avgPersons,
      pointsDeviation,
      pointsDeviationRate: avgPoints !== 0 ? pointsDeviation / avgPoints : 0,
      personsDeviation,
      personsDeviationRate: avgPersons !== 0 ? personsDeviation / avgPersons : 0,
    };
  }

  return {
    hasWork: true,
    prevWorkingDay,
    recent30Days,
  };
}

/**
 * 格式化变化值为显示字符串
 * @param value 变化值
 * @param rate 变化率（小数）
 * @returns 格式化后的字符串，如 "+56 (+18.5%)"
 */
export function formatChange(value: number, rate: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '' : '';
  const ratePercent = (rate * 100).toFixed(1);
  return `${sign}${value} (${sign}${ratePercent}%)`;
}

/**
 * 获取变化值的颜色类名
 * @param value 变化值
 * @returns Tailwind 颜色类名
 */
export function getChangeColorClass(value: number): string {
  if (value > 0) return 'text-red-500';   // 上升红色
  if (value < 0) return 'text-green-500'; // 下降绿色
  return 'text-gray-400';                 // 持平灰色
}

/**
 * 基于真实历史日期数据计算统计卡片变化值
 *
 * 此函数会：
 * 1. 按需加载历史日期数据
 * 2. 计算真实的变化值（不使用模拟数据）
 * 3. 结果可缓存，避免重复加载
 *
 * @param currentStats 当前日期的统计数据
 * @param currentDate 当前日期字符串（YYYY-MM-DD）
 * @param availableDates 可用日期列表（已排序）
 * @param historicalCache 历史统计数据缓存（LRUCache<date, StatsData>）
 * @returns Promise<StatsChanges> 变化值数据
 */
export async function calculateStatsChangesAsync(
  currentStats: StatsData,
  currentDate: string,
  availableDates: string[],
  historicalCache: LRUCache<string, StatsData>
): Promise<StatsChanges> {
  const hasWork = currentStats.totalPoints > 0;

  // 如果当前无作业，返回 hasWork = false，变化值为 null
  if (!hasWork) {
    return {
      hasWork: false,
      prevWorkingDay: null,
      recent30Days: null,
    };
  }

  const currentIndex = availableDates.indexOf(currentDate);

  // 1. 查找上一作业日并加载其真实数据
  let prevWorkingDay: StatsChanges['prevWorkingDay'] = null;
  for (let i = currentIndex - 1; i >= 0; i--) {
    const date = availableDates[i];

    // 从缓存获取或加载历史数据
    let historyStats = historicalCache.get(date);
    if (!historyStats) {
      try {
        // 动态导入避免循环依赖
        const { loadAndParseByDate } = await import('@/lib/dateDataLoader');
        const result = await loadAndParseByDate(date);
        historyStats = calculateStats(result.normalizedData);
        // 缓存结果
        historicalCache.set(date, historyStats);
      } catch (err) {
        console.warn(`[StatsChanges] 加载历史数据失败: ${date}`, err);
        continue;
      }
    }

    // 检查是否为有作业日
    if (historyStats.totalPoints > 0) {
      const pointsChange = currentStats.totalPoints - historyStats.totalPoints;
      const personsChange = currentStats.totalPersons - historyStats.totalPersons;
      prevWorkingDay = {
        date,
        points: historyStats.totalPoints,
        persons: historyStats.totalPersons,
        pointsChange,
        pointsChangeRate: historyStats.totalPoints !== 0 ? pointsChange / historyStats.totalPoints : 0,
        personsChange,
        personsChangeRate: historyStats.totalPersons !== 0 ? personsChange / historyStats.totalPersons : 0,
      };
      break;
    }
  }

  // 2. 收集近30个有作业日并加载其真实数据
  const workingDays: { date: string; stats: StatsData }[] = [];
  for (let i = currentIndex - 1; i >= 0 && workingDays.length < 30; i--) {
    const date = availableDates[i];

    // 从缓存获取或加载历史数据
    let historyStats = historicalCache.get(date);
    if (!historyStats) {
      try {
        // 动态导入避免循环依赖
        const { loadAndParseByDate } = await import('@/lib/dateDataLoader');
        const result = await loadAndParseByDate(date);
        historyStats = calculateStats(result.normalizedData);
        // 缓存结果
        historicalCache.set(date, historyStats);
      } catch (err) {
        console.warn(`[StatsChanges] 加载历史数据失败: ${date}`, err);
        continue;
      }
    }

    // 检查是否为有作业日
    if (historyStats.totalPoints > 0) {
      workingDays.push({ date, stats: historyStats });
    }
  }

  // 计算近30个有作业日均值
  let recent30Days: StatsChanges['recent30Days'] = null;
  if (workingDays.length > 0) {
    const totalPoints = workingDays.reduce((sum, d) => sum + d.stats.totalPoints, 0);
    const totalPersons = workingDays.reduce((sum, d) => sum + d.stats.totalPersons, 0);
    const avgPoints = totalPoints / workingDays.length;
    const avgPersons = totalPersons / workingDays.length;

    const pointsDeviation = currentStats.totalPoints - avgPoints;
    const personsDeviation = currentStats.totalPersons - avgPersons;

    recent30Days = {
      count: workingDays.length,
      avgPoints,
      avgPersons,
      pointsDeviation,
      pointsDeviationRate: avgPoints !== 0 ? pointsDeviation / avgPoints : 0,
      personsDeviation,
      personsDeviationRate: avgPersons !== 0 ? personsDeviation / avgPersons : 0,
    };
  }

  return {
    hasWork: true,
    prevWorkingDay,
    recent30Days,
  };
}
