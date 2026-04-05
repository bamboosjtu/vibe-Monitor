import type { NormalizedStationMeeting, FilterState } from '@/types';

/**
 * 默认筛选状态
 */
export const DEFAULT_FILTER_STATE: FilterState = {
  workStatus: 'all',
  riskLevels: [],
  cities: [],
  voltageLevels: [],
};

/**
 * 判断筛选是否激活（有任何非默认条件）
 */
export function isFilterActive(filters: FilterState): boolean {
  return (
    filters.workStatus !== 'all' ||
    filters.riskLevels.length > 0 ||
    filters.cities.length > 0 ||
    filters.voltageLevels.length > 0
  );
}

/**
 * 单条记录是否匹配筛选条件
 */
function matchesFilters(record: NormalizedStationMeeting, filters: FilterState): boolean {
  // 1. 作业状态筛选
  if (filters.workStatus !== 'all') {
    // 特殊处理：未知状态仅在"全部"下显示
    if (record.workStatus === 'unknown') {
      return false;
    }
    if (record.workStatus !== filters.workStatus) {
      return false;
    }
  }

  // 2. 风险等级筛选（多选）
  if (filters.riskLevels.length > 0) {
    if (!filters.riskLevels.includes(record.riskLevel)) {
      return false;
    }
  }

  // 3. 市州筛选（多选）
  if (filters.cities.length > 0) {
    if (!filters.cities.includes(record.city)) {
      return false;
    }
  }

  // 4. 电压等级筛选（多选）
  // 注意：filters.voltageLevels 存储的是显示名称（如 '35kV'），不是编码
  if (filters.voltageLevels.length > 0) {
    if (!filters.voltageLevels.includes(record.voltageLevelName)) {
      return false;
    }
  }

  return true;
}

/**
 * 执行筛选
 */
export function applyFilters(
  data: NormalizedStationMeeting[],
  filters: FilterState
): NormalizedStationMeeting[] {
  // 如果没有激活的筛选条件，返回全部数据
  if (!isFilterActive(filters)) {
    return data;
  }

  return data.filter(record => matchesFilters(record, filters));
}

/**
 * 切换多选值
 */
export function toggleArrayValue<T>(array: T[], value: T): T[] {
  if (array.includes(value)) {
    return array.filter(v => v !== value);
  }
  return [...array, value];
}
