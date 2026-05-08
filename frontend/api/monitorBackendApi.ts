import { get } from './client';
import type {
  DataHubDatesResponse,
  DataHubMapSummaryResponse,
  DataHubMapSkeletonResponse,
} from './datahubApi';

export interface MonitorBackendEnvelope {
  cached: boolean;
  stale: boolean;
  source_watermark: string | null;
  refreshed_at: string | null;
}

export type MonitorBackendDatesResponse = DataHubDatesResponse & MonitorBackendEnvelope;

export type MonitorBackendMapSummaryResponse = DataHubMapSummaryResponse &
  MonitorBackendEnvelope & {
    date: string | null;
    metadata?: Record<string, unknown>;
    total_points: number;
    data: DataHubMapSummaryResponse['work_points'];
  };

export type MonitorBackendMapSkeletonResponse = DataHubMapSkeletonResponse &
  MonitorBackendEnvelope & {
    metadata?: Record<string, unknown>;
  };

export function fetchMonitorBackendDates(): Promise<MonitorBackendDatesResponse> {
  return get<MonitorBackendDatesResponse>('/api/map/dates');
}

export function fetchMonitorBackendMapSummary(
  date?: string,
): Promise<MonitorBackendMapSummaryResponse> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return get<MonitorBackendMapSummaryResponse>(`/api/map/summary${query}`);
}

let skeletonCache: Promise<MonitorBackendMapSkeletonResponse> | null = null;

export function fetchMonitorBackendMapSkeleton(): Promise<MonitorBackendMapSkeletonResponse> {
  if (!skeletonCache) {
    skeletonCache = get<MonitorBackendMapSkeletonResponse>('/api/map/skeleton');
  }
  return skeletonCache;
}

export function clearMonitorBackendSkeletonCache(): void {
  skeletonCache = null;
}
