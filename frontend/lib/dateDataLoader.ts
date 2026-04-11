import type { RawDataResponse } from '@/types';
import { loadDataFile, parseAndNormalizeData } from './dataParser';

/**
 * 数据文件路径构建
 * 格式: /data/daily_meeting/meeting_YYYYMMDD_all.json
 */
export function buildDataUrl(date: string): string {
  // date 格式: YYYY-MM-DD 或 YYYYMMDD
  const normalizedDate = date.replace(/-/g, '');
  return `/data/daily_meeting/meeting_${normalizedDate}_all.json`;
}

/**
 * 从文件名解析日期
 * 格式: meeting_YYYYMMDD_all.json -> YYYY-MM-DD
 */
export function parseDateFromFilename(filename: string): string | null {
  const match = filename.match(/meeting_(\d{8})_all\.json/);
  if (match) {
    const digits = match[1];
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return null;
}

/**
 * 日期清单 manifest 类型
 */
export interface DateManifest {
  dates: string[];
  meta?: {
    description?: string;
    format?: string;
    lastUpdated?: string;
  };
}

/**
 * 从 daily_meeting/index.json 加载日期清单
 * 这是主要的日期发现机制，替代硬编码 PREDEFINED_DATES
 */
export async function loadDateManifest(): Promise<DateManifest> {
  const response = await fetch('/data/daily_meeting/index.json');
  
  if (!response.ok) {
    throw new Error(`无法加载日期清单: ${response.status} ${response.statusText}`);
  }
  
  const manifest = await response.json();
  
  if (!manifest.dates || !Array.isArray(manifest.dates)) {
    throw new Error('日期清单格式错误: 缺少 dates 数组');
  }
  
  // 验证日期格式并排序
  const validDates = manifest.dates
    .filter((date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();
  
  return {
    dates: validDates,
    meta: manifest.meta,
  };
}

/**
 * 预定义日期列表（备选方案）
 * 当 index.json 加载失败时作为 fallback
 * @deprecated 请使用 loadDateManifest() 替代
 */
export const PREDEFINED_DATES: string[] = [
  '2026-04-07',
  '2026-04-08',
  '2026-04-09',
  '2026-04-10',
];

/**
 * 获取可用日期列表
 * 
 * 注意：此函数现在主要用于兼容旧代码，返回的是硬编码的备选日期。
 * 新的初始化流程应该：
 * 1. 调用 loadDateManifest() 加载 manifest
 * 2. 使用 manifest.dates 作为 availableDates
 * 
 * @deprecated 请使用 loadDateManifest() 替代
 */
export function getAvailableDates(): string[] {
  // 返回硬编码列表作为 fallback
  // 实际使用时应在 useDataLoader 中调用 loadDateManifest()
  return [...PREDEFINED_DATES];
}

/**
 * 检查日期是否有数据
 * 注意：此函数需要配合 manifest 使用
 */
export function hasDataForDate(date: string, availableDates: string[]): boolean {
  return availableDates.includes(date);
}

/**
 * 获取下一个有数据的日期
 */
export function getNextDate(currentDate: string, dates: string[]): string | null {
  const currentIndex = dates.indexOf(currentDate);
  if (currentIndex === -1 || currentIndex >= dates.length - 1) {
    return null;
  }
  return dates[currentIndex + 1];
}

/**
 * 获取上一个有数据的日期
 */
export function getPrevDate(currentDate: string, dates: string[]): string | null {
  const currentIndex = dates.indexOf(currentDate);
  if (currentIndex <= 0) {
    return null;
  }
  return dates[currentIndex - 1];
}

/**
 * 获取最新日期（用于默认加载）
 */
export function getLatestDate(dates: string[]): string | null {
  if (dates.length === 0) return null;
  // 假设 dates 已按升序排列，取最后一个
  return dates[dates.length - 1];
}

/**
 * 按日期加载数据
 * 这是核心的数据加载函数，供时间轴使用
 */
export async function loadDataByDate(date: string): Promise<{
  rawData: RawDataResponse;
  date: string;
}> {
  const url = buildDataUrl(date);
  const rawData = await loadDataFile(url);

  // 验证数据日期与请求日期一致（如果数据中有日期字段）
  if (rawData.date && rawData.date !== date) {
    console.warn(`[DateDataLoader] 数据日期不匹配: 请求=${date}, 实际=${rawData.date}`);
  }

  return { rawData, date };
}

/**
 * 完整的日期数据加载流程
 * 包括加载、解析、归一化
 */
export async function loadAndParseByDate(date: string): Promise<{
  rawData: RawDataResponse;
  normalizedData: ReturnType<typeof parseAndNormalizeData>['records'];
  stats: ReturnType<typeof parseAndNormalizeData>['stats'];
  date: string;
}> {
  const { rawData } = await loadDataByDate(date);
  const { records, stats } = parseAndNormalizeData(rawData);

  return {
    rawData,
    normalizedData: records,
    stats,
    date,
  };
}
