/**
 * 地图相关 API
 * 
 * 封装地图摘要、bootstrap 等接口
 */

import { get } from './client';
import { uploadFile } from './client';
import { adaptDataHubSkeleton } from './adapter';
import { getApiConfig } from './config';
import { fetchDataHubMapSkeleton } from './datahubApi';
import { fetchMonitorBackendMapSkeleton } from './monitorBackendApi';

// ==================== 数据类型定义 ====================

/** 地图摘要项 */
export interface MapSummaryItem {
  id: string;
  project_name: string | null;
  longitude: number | null;
  latitude: number | null;
  risk_level: number | null;
  person_count: number | null;
  work_status: string | null;
  city: string | null;
}

/** 地图摘要响应 */
export interface MapSummaryResponse {
  total_points: number;
  data: MapSummaryItem[];
}

/** Bootstrap 信息（M0 第二轮统一结构） */
export interface BootstrapInfo {
  app_name: string;
  app_version: string;
  db_initialized: boolean;
  has_year_progress_data: boolean;
  has_tower_data: boolean;
  has_meeting_data: boolean;
  latest_import_time: string | null;
  total_import_batches: number;
  /** 未解析的 year_progress 记录数（M0 已知限制） */
  unresolved_year_progress_count?: number;
}

/** 导入结果（M0 第二轮统一结构） */
export interface ImportResult {
  batch_no: string;
  data_type: string;
  total_count: number;
  success_count: number;
  failed_count: number;
  skipped_count: number;
  unresolved_count: number;
  status: string;
  error_log: string | null;
}

// ==================== API 方法 ====================

/**
 * 获取系统启动信息
 */
export function getBootstrap(): Promise<BootstrapInfo> {
  return get<BootstrapInfo>('/api/bootstrap');
}

/**
 * 获取地图摘要
 */
export function getMapSummary(): Promise<MapSummaryResponse> {
  return get<MapSummaryResponse>('/api/map/summary');
}

/**
 * 导入年度目标数据
 */
export function importYearProgress(file: File): Promise<ImportResult> {
  return uploadFile<ImportResult>('/api/import/year-progress', file);
}

/**
 * 导入杆塔数据
 */
export function importTowers(file: File): Promise<ImportResult> {
  return uploadFile<ImportResult>('/api/import/towers', file);
}

/**
 * 导入 meetlist 数据
 */
export function importMeetings(file: File): Promise<ImportResult> {
  return uploadFile<ImportResult>('/api/import/meetings', file);
}

// ==================== M1 骨架地图 API ====================

/** 线路骨架项 */
export interface SkeletonLine {
  single_project_code: string;
  tower_count: number;
  coords: [number, number][];
  voltage_level: string | null;
}

/** 杆塔骨架项 */
export interface SkeletonTower {
  id: string;
  project_code: string | null;
  single_project_code: string;
  tower_no: string;
  longitude: number;
  latitude: number;
  tower_sequence_no: number | null;
}

/** 变电站骨架项（M1 Round2 新增） */
export interface SkeletonStation {
  id: string;
  project_code: string | null;
  single_project_code: string;
  name: string;
  prj_code: string | null;
  longitude: number;
  latitude: number;
}

/** 骨架地图响应 */
export interface SkeletonResponse {
  lines: SkeletonLine[];
  towers: SkeletonTower[];
  stations: SkeletonStation[];
}

/**
 * 获取骨架地图数据
 */
export function getSkeleton(): Promise<SkeletonResponse> {
  if (getApiConfig().source === 'datahub') {
    return fetchDataHubMapSkeleton().then(adaptDataHubSkeleton);
  }
  if (getApiConfig().source === 'monitor_backend') {
    return fetchMonitorBackendMapSkeleton().then(adaptDataHubSkeleton);
  }
  return get<SkeletonResponse>('/api/map/skeleton');
}
