import type { NormalizedStationMeeting, RiskLevel } from '@/types';

/**
 * 统计数据结构
 */
export interface StatsData {
  // 当日作业点总数（合法坐标记录数）
  totalPoints: number;
  
  // 当前作业总人数（统计/详情值之和）
  totalPersons: number;
  
  // 风险分布（按记录数统计，包含 unknown）
  riskDistribution: Record<RiskLevel | 'unknown', number>;
  
  // 市州分布 Top5（按记录数统计，不包含"其他"）
  cityDistribution: Array<{ city: string; count: number }>;
}

/**
 * 基于 filteredData 计算统计数据
 */
export function calculateStats(data: NormalizedStationMeeting[]): StatsData {
  // 1. 当日作业点总数 = 合法坐标记录数（即 data.length，因为 data 已经过坐标过滤）
  const totalPoints = data.length;
  
  // 2. 当前作业总人数 = 统计/详情值之和
  const totalPersons = data.reduce((sum, item) => sum + item.personCountDisplay, 0);
  
  // 3. 风险分布（按记录数统计，包含 unknown）
  const riskDistribution: Record<RiskLevel | 'unknown', number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    unknown: 0,
  };
  
  data.forEach(item => {
    riskDistribution[item.riskLevel]++;
  });
  
  // 4. 市州分布 Top5（按记录数统计，不包含"其他"）
  const cityCountMap = new Map<string, number>();
  
  data.forEach(item => {
    // 排除"其他"市州
    if (item.city && item.city !== '其他') {
      cityCountMap.set(item.city, (cityCountMap.get(item.city) || 0) + 1);
    }
  });
  
  // 排序并取 Top5
  const cityDistribution = Array.from(cityCountMap.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  return {
    totalPoints,
    totalPersons,
    riskDistribution,
    cityDistribution,
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
