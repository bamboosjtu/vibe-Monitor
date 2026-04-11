/**
 * API 数据适配器
 * 
 * 将后端 API 返回的数据格式转换为前端现有组件需要的格式
 */

import type { NormalizedStationMeeting } from '@/types';
import type { MapSummaryItem } from '@/api/mapApi';

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
    riskLevel: item.risk_level as any ?? 'unknown',
    workStatus: item.work_status as any ?? 'unknown',
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
