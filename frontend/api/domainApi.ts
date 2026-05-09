import { get } from './client';

export interface MonitorBackendDomainEnvelope {
  cached: boolean;
  stale: boolean;
  source_watermark: string | null;
  refreshed_at: string | null;
}

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
  project: Record<string, unknown> | null;
  single_projects: Record<string, unknown>[];
  bidding_sections: Record<string, unknown>[];
  towers: Record<string, unknown>[];
  stations: Record<string, unknown>[];
  line_sections: Record<string, unknown>[];
  work_points: Record<string, unknown>[];
  project_progress: Record<string, unknown>[];
  counts: Record<string, unknown>;
  warnings: string[];
  source_watermark: string | null;
}

export interface MonitorLineSectionIndexResponse extends MonitorBackendDomainEnvelope {
  line_sections: Record<string, unknown>[];
  count: number;
}

export interface MonitorYearProgressResponse extends MonitorBackendDomainEnvelope {
  items: Record<string, unknown>[];
  count: number;
}

export function fetchDomainProjects(params?: {
  keyword?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<MonitorProjectIndexResponse> {
  const query = new URLSearchParams();
  if (params?.keyword) query.set('keyword', params.keyword);
  if (params?.status) query.set('status', params.status);
  if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
  if (typeof params?.offset === 'number') query.set('offset', String(params.offset));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return get<MonitorProjectIndexResponse>(`/api/domain/projects${suffix}`);
}

export function fetchDomainProject(
  projectCode: string,
  params?: {
    date?: string;
    include_work_points?: boolean;
    include_towers?: boolean;
    include_stations?: boolean;
    include_line_sections?: boolean;
  },
): Promise<MonitorProjectDetailResponse> {
  const query = new URLSearchParams();
  if (params?.date) query.set('date', params.date);
  if (typeof params?.include_work_points === 'boolean') {
    query.set('include_work_points', String(params.include_work_points));
  }
  if (typeof params?.include_towers === 'boolean') {
    query.set('include_towers', String(params.include_towers));
  }
  if (typeof params?.include_stations === 'boolean') {
    query.set('include_stations', String(params.include_stations));
  }
  if (typeof params?.include_line_sections === 'boolean') {
    query.set('include_line_sections', String(params.include_line_sections));
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return get<MonitorProjectDetailResponse>(
    `/api/domain/projects/${encodeURIComponent(projectCode)}${suffix}`,
  );
}

export function fetchDomainLineSections(params?: {
  project_code?: string;
  single_project_code?: string;
  bidding_section_code?: string;
  limit?: number;
  offset?: number;
}): Promise<MonitorLineSectionIndexResponse> {
  const query = new URLSearchParams();
  if (params?.project_code) query.set('project_code', params.project_code);
  if (params?.single_project_code) {
    query.set('single_project_code', params.single_project_code);
  }
  if (params?.bidding_section_code) {
    query.set('bidding_section_code', params.bidding_section_code);
  }
  if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
  if (typeof params?.offset === 'number') query.set('offset', String(params.offset));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return get<MonitorLineSectionIndexResponse>(`/api/domain/line-sections${suffix}`);
}

export function fetchDomainYearProgress(params?: {
  project_code?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<MonitorYearProgressResponse> {
  const query = new URLSearchParams();
  if (params?.project_code) query.set('project_code', params.project_code);
  if (params?.status) query.set('status', params.status);
  if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
  if (typeof params?.offset === 'number') query.set('offset', String(params.offset));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return get<MonitorYearProgressResponse>(`/api/domain/year-progress${suffix}`);
}
