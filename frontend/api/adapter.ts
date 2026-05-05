/**
 * API 数据适配器
 * 
 * 将后端 API 返回的数据格式转换为前端现有组件需要的格式
 */

import type { NormalizedStationMeeting } from '@/types';
import type { RiskLevel, WorkStatus, VoltageLevelCode } from '@/types';
import type { MapSummaryItem, SkeletonResponse } from '@/api/mapApi';
import type {
  DataHubMapSkeletonResponse,
  DataHubMapSummaryResponse,
  DataHubWorkPoint,
} from '@/api/datahubApi';

function normalizeRiskLevel(value: string | number | null): RiskLevel {
  if (value === 1 || value === 2 || value === 3 || value === 4) {
    return value;
  }
  if (value === '1' || value === '2' || value === '3' || value === '4') {
    return Number(value) as RiskLevel;
  }
  return 'unknown';
}

function normalizeWorkStatus(value: string | null): WorkStatus {
  if (value === 'working' || value === 'paused' || value === 'finished') {
    return value;
  }
  return 'unknown';
}

function normalizeVoltageLevel(value: string | null): {
  code: VoltageLevelCode;
  name: string;
} {
  if (!value) {
    return { code: 'unknown', name: '未知' };
  }
  return { code: 'unknown', name: value };
}

/**
 * 将地图摘要项转换为 NormalizedStationMeeting
 */
export function adaptMapSummaryItem(item: MapSummaryItem): Partial<NormalizedStationMeeting> {
  return {
    id: item.id,
    projectName: item.project_name ?? '--',
    longitude: item.longitude ?? 0,
    latitude: item.latitude ?? 0,
    personCount: item.person_count ?? 0,
    personCountDisplay: item.person_count ?? 0,
    riskLevel: normalizeRiskLevel(item.risk_level),
    workStatus: normalizeWorkStatus(item.work_status),
    city: item.city ?? '其他',
    address: '',
    voltageLevel: 'unknown',
    voltageLevelName: '未知',
    ticketId: '',
    ticketNo: '',
    ticketName: '',
    leaderName: '',
    constructionUnit: '',
    supervisionUnit: '',
    workProcedure: '',
    workSiteName: '',
    workDate: '',
    workStartTime: '',
    projectCode: null,
  };
}

/**
 * 将地图摘要列表转换为 NormalizedStationMeeting 数组
 */
export function adaptMapSummary(items: MapSummaryItem[]): NormalizedStationMeeting[] {
  return items
    .filter(item => item.longitude && item.latitude) // 过滤有效坐标
    .map(item => adaptMapSummaryItem(item) as NormalizedStationMeeting);
}

export function adaptDataHubWorkPoint(item: DataHubWorkPoint): NormalizedStationMeeting {
  const voltageLevel = normalizeVoltageLevel(item.voltage_level);
  return {
    id: item.id,
    projectName: item.project_name ?? '--',
    projectCode: null,
    ticketId: '',
    ticketNo: '',
    ticketName: '',
    address: '',
    longitude: item.longitude,
    latitude: item.latitude,
    city: item.city ?? '其他',
    personCount: item.person_count ?? 0,
    personCountDisplay: item.person_count ?? 0,
    leaderName: '',
    riskLevel: normalizeRiskLevel(item.risk_level),
    workStatus: normalizeWorkStatus(item.work_status),
    voltageLevel: voltageLevel.code,
    voltageLevelName: voltageLevel.name,
    constructionUnit: '',
    supervisionUnit: '',
    workProcedure: '',
    workSiteName: '',
    workDate: item.work_date ?? '',
    workStartTime: '',
  };
}

export function adaptDataHubMapSummary(
  summary: DataHubMapSummaryResponse
): NormalizedStationMeeting[] {
  return summary.work_points
    .filter(item => Number.isFinite(item.longitude) && Number.isFinite(item.latitude))
    .map(adaptDataHubWorkPoint);
}

export function adaptDataHubSkeleton(
  skeleton: DataHubMapSkeletonResponse
): SkeletonResponse {
  return {
    lines: [],
    towers: skeleton.towers
      .filter(tower => Number.isFinite(tower.longitude) && Number.isFinite(tower.latitude))
      .map(tower => ({
        id: tower.id,
        single_project_code: tower.single_project_code ?? '',
        tower_no: tower.tower_no ?? '',
        longitude: tower.longitude,
        latitude: tower.latitude,
        tower_sequence_no: null,
      })),
    stations: skeleton.stations
      .filter(station => Number.isFinite(station.longitude) && Number.isFinite(station.latitude))
      .map(station => ({
        id: station.id,
        single_project_code: station.single_project_code ?? '',
        name: station.single_project_code ?? station.id,
        prj_code: station.project_code ?? null,
        longitude: station.longitude,
        latitude: station.latitude,
      })),
  };
}
