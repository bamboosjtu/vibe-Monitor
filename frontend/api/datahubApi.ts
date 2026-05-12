import { get } from './client';

export interface DataHubDatesResponse {
  dates: string[];
  latest_date: string | null;
  count: number;
}

export interface DataHubWorkPoint {
  id: string;
  project_name: string | null;
  project_code?: string | null;
  longitude: number;
  latitude: number;
  person_count: number | null;
  risk_level: string | number | null;
  work_status: string | null;
  voltage_level: string | null;
  city: string | null;
  work_date: string | null;
}

export interface DataHubMapSummaryResponse {
  meta: {
    date: string | null;
    limit: number;
    work_points_count: number;
    truncated: boolean;
  };
  work_points: DataHubWorkPoint[];
}

export interface DataHubTower {
  id: string;
  tower_id?: string | null;
  project_code?: string | null;
  single_project_code?: string | null;
  bidding_section_code?: string | null;
  tower_no?: string | null;
  upstream_tower_no?: string | null;
  longitude: number;
  latitude: number;
  tower_type?: string | null;
  tower_full_height?: string | number | null;
  nominal_height?: string | number | null;
}

export interface DataHubStation {
  id: string;
  project_code?: string | null;
  single_project_code?: string | null;
  longitude: number;
  latitude: number;
}

export interface DataHubMapSkeletonResponse {
  meta?: {
    limit: number;
    stations_count: number;
    towers_count: number;
    truncated: boolean;
  };
  stations: DataHubStation[];
  towers: DataHubTower[];
  lines: [];
}

let skeletonCache: Promise<DataHubMapSkeletonResponse> | null = null;

export function fetchDataHubDates(): Promise<DataHubDatesResponse> {
  return get<DataHubDatesResponse>('/api/map/dates');
}

export const fetchSandboxDates = fetchDataHubDates;

export function fetchDataHubMapSummary(
  date?: string
): Promise<DataHubMapSummaryResponse> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return get<DataHubMapSummaryResponse>(`/api/map/summary${query}`);
}

export const fetchSandboxSummary = fetchDataHubMapSummary;

export function fetchDataHubMapSkeleton(): Promise<DataHubMapSkeletonResponse> {
  if (!skeletonCache) {
    skeletonCache = get<DataHubMapSkeletonResponse>('/api/map/skeleton');
  }
  return skeletonCache;
}

export const fetchSandboxSkeleton = fetchDataHubMapSkeleton;

export function clearDataHubSkeletonCache(): void {
  skeletonCache = null;
}
