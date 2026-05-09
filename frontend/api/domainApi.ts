import { MONITOR_BACKEND_URL, getApiConfig } from './config';

export interface MonitorBackendDomainEnvelope {
  cached: boolean;
  stale: boolean;
  source_watermark: string | null;
  refreshed_at: string | null;
}

interface MonitorBackendApiResponse<T> {
  code: number;
  message: string;
  data: T;
  timestamp: string;
}

type DomainEntity = Record<string, unknown>;

export interface MonitorProjectIndexItem {
  project_code: string | null;
  project_name: string | null;
  status: string | null;
  single_project_count: number;
  bidding_section_count: number;
  tower_count: number;
  station_count: number;
  line_section_count: number;
  work_point_count: number;
  latest_work_date: string | null;
  progress_summary: {
    count: number;
    statuses: string[];
  };
  source_watermark: string | null;
}

export interface MonitorProjectIndexResponse extends MonitorBackendDomainEnvelope {
  projects: MonitorProjectIndexItem[];
  count: number;
  filters?: Record<string, unknown>;
}

export interface MonitorProjectDetailResponse extends MonitorBackendDomainEnvelope {
  project: DomainEntity | null;
  single_projects: DomainEntity[];
  bidding_sections: DomainEntity[];
  towers: DomainEntity[];
  stations: DomainEntity[];
  line_sections: DomainEntity[];
  work_points: DomainEntity[];
  project_progress: DomainEntity[];
  counts: Record<string, unknown>;
  latest_work_date: string | null;
  progress_summary: {
    count: number;
    statuses: string[];
  };
  warnings: string[];
}

export interface MonitorProjectMapResponse extends MonitorBackendDomainEnvelope {
  project: DomainEntity | null;
  towers: DomainEntity[];
  stations: DomainEntity[];
  work_points: DomainEntity[];
  line_sections: DomainEntity[];
  counts: Record<string, unknown>;
  latest_work_date: string | null;
  progress_summary: {
    count: number;
    statuses: string[];
  };
  warnings: string[];
}

export interface MonitorLineSectionIndexItem {
  line_section_key: string;
  line_section_name: string | null;
  project_code: string | null;
  single_project_code: string | null;
  bidding_section_code: string | null;
  tower_sequence_count: number;
  matched_tower_count: number;
  reference_node_count: number;
  missing_physical_count: number;
  scope_without_tower_count: number;
  status: 'ok' | 'warning' | 'reference';
  source_watermark: string | null;
}

export interface MonitorLineSectionIndexResponse extends MonitorBackendDomainEnvelope {
  line_sections: MonitorLineSectionIndexItem[];
  count: number;
}

export interface MonitorLineSectionSequenceItem {
  tower_key: string | null;
  tower_no: string | null;
  sequence_index: number | null;
  node_kind: string | null;
  matched: boolean;
}

export interface MonitorLineSectionDetailResponse extends MonitorBackendDomainEnvelope {
  line_section: DomainEntity | null;
  tower_sequence: MonitorLineSectionSequenceItem[];
  matched_towers: DomainEntity[];
  reference_nodes: MonitorLineSectionSequenceItem[];
  missing_nodes: MonitorLineSectionSequenceItem[];
  scope_without_tower: MonitorLineSectionSequenceItem[];
  warnings: string[];
}

export interface MonitorYearProgressItem {
  project_code: string | null;
  project_name: string | null;
  status: string | null;
  progress_payload: Record<string, unknown> | null;
  source_watermark: string | null;
}

export interface MonitorYearProgressResponse extends MonitorBackendDomainEnvelope {
  items: MonitorYearProgressItem[];
  count: number;
}

export interface MonitorProjectStatusItem {
  project_code: string | null;
  project_name: string | null;
  status: string | null;
  progress_summary: {
    count: number;
    statuses: string[];
  } | null;
  source_watermark: string | null;
}

export interface MonitorProjectStatusResponse extends MonitorBackendDomainEnvelope {
  items: MonitorProjectStatusItem[];
  count: number;
}

type Primitive = string | number | boolean;
type QueryParams = Record<string, Primitive | null | undefined>;

function buildQuery(params?: QueryParams): string {
  const query = new URLSearchParams();
  if (!params) {
    return '';
  }
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      query.set(key, String(value));
    }
  });
  const text = query.toString();
  return text ? `?${text}` : '';
}

function isApiEnvelope<T>(payload: unknown): payload is MonitorBackendApiResponse<T> {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'code' in payload &&
    'data' in payload
  );
}

async function fetchMonitorBackendDomain<T>(path: string, params?: QueryParams): Promise<T> {
  const url = `${MONITOR_BACKEND_URL}${path}${buildQuery(params)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(getApiConfig().timeout),
  });

  if (!response.ok) {
    throw new Error(`请求失败: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  if (isApiEnvelope<T>(payload)) {
    if (payload.code !== 0) {
      throw new Error(payload.message || '未知错误');
    }
    return payload.data;
  }
  return payload as T;
}

export function fetchDomainProjects(params?: {
  keyword?: string;
  status?: string;
  limit?: number;
  offset?: number;
  force?: boolean;
}): Promise<MonitorProjectIndexResponse> {
  return fetchMonitorBackendDomain<MonitorProjectIndexResponse>('/api/domain/projects', params);
}

export function fetchDomainProject(
  projectCode: string,
  params?: {
    date?: string;
    include_work_points?: boolean;
    include_towers?: boolean;
    include_stations?: boolean;
    include_line_sections?: boolean;
    force?: boolean;
  },
): Promise<MonitorProjectDetailResponse> {
  return fetchMonitorBackendDomain<MonitorProjectDetailResponse>(
    `/api/domain/projects/${encodeURIComponent(projectCode)}`,
    params,
  );
}

export function fetchDomainProjectMap(
  projectCode: string,
  params?: {
    date?: string;
    force?: boolean;
  },
): Promise<MonitorProjectMapResponse> {
  return fetchMonitorBackendDomain<MonitorProjectMapResponse>(
    `/api/domain/projects/${encodeURIComponent(projectCode)}/map`,
    params,
  );
}

export function fetchDomainLineSections(params?: {
  project_code?: string;
  single_project_code?: string;
  bidding_section_code?: string;
  limit?: number;
  offset?: number;
  force?: boolean;
}): Promise<MonitorLineSectionIndexResponse> {
  return fetchMonitorBackendDomain<MonitorLineSectionIndexResponse>(
    '/api/domain/line-sections',
    params,
  );
}

export function fetchDomainLineSectionDetail(
  lineSectionKey: string,
  params?: {
    force?: boolean;
  },
): Promise<MonitorLineSectionDetailResponse> {
  return fetchMonitorBackendDomain<MonitorLineSectionDetailResponse>(
    `/api/domain/line-sections/${encodeURIComponent(lineSectionKey)}`,
    params,
  );
}

export function fetchDomainYearProgress(params?: {
  project_code?: string;
  status?: string;
  limit?: number;
  offset?: number;
  force?: boolean;
}): Promise<MonitorYearProgressResponse> {
  return fetchMonitorBackendDomain<MonitorYearProgressResponse>(
    '/api/domain/year-progress',
    params,
  );
}

export function fetchDomainProjectStatus(params?: {
  force?: boolean;
}): Promise<MonitorProjectStatusResponse> {
  return fetchMonitorBackendDomain<MonitorProjectStatusResponse>(
    '/api/domain/project-status',
    params,
  );
}
