import { get } from './client';
import type {
  DataHubDatesResponse,
  DataHubWorkPoint,
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
    summary?: Record<string, unknown>;
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
  return get<MonitorBackendMapSummaryResponse>(`/api/map/summary${query}`).then(
    normalizeMonitorBackendMapSummary,
  );
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

export function getSummaryWorkPoints(
  summary: Partial<DataHubMapSummaryResponse> & {
    work_points?: DataHubWorkPoint[];
    data?: DataHubWorkPoint[];
  },
): DataHubWorkPoint[] {
  if (Array.isArray(summary.work_points)) {
    return summary.work_points;
  }
  if (Array.isArray(summary.data)) {
    return summary.data;
  }
  return [];
}

export function getSummaryDate(
  summary: Partial<DataHubMapSummaryResponse> & { date?: string | null },
  fallbackDate?: string | null,
): string | null {
  return summary.meta?.date ?? summary.date ?? fallbackDate ?? null;
}

export function normalizeMonitorBackendMapSummary(
  summary: MonitorBackendMapSummaryResponse,
): MonitorBackendMapSummaryResponse {
  const workPoints = getSummaryWorkPoints(summary);
  const resolvedDate = getSummaryDate(summary);
  const meta = summary.meta ?? {
    date: resolvedDate,
    limit: typeof summary.summary?.limit === 'number' ? summary.summary.limit : 10000,
    work_points_count:
      typeof summary.summary?.work_points_count === 'number'
        ? summary.summary.work_points_count
        : workPoints.length,
    truncated:
      typeof summary.summary?.truncated === 'boolean'
        ? summary.summary.truncated
        : false,
  };
  return {
    ...summary,
    date: resolvedDate,
    meta,
    work_points: workPoints,
    total_points: summary.total_points ?? workPoints.length,
  };
}
