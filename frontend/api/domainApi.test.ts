import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchDomainLineSectionDetail,
  fetchDomainProjects,
} from './domainApi';

describe('domainApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetchDomainProjects should unwrap ApiResponse.data', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          code: 0,
          message: 'success',
          data: {
            projects: [
              {
                project_code: 'PRJ-001',
                project_name: '示例工程',
                status: '在建',
                single_project_count: 1,
                bidding_section_count: 1,
                tower_count: 2,
                station_count: 1,
                line_section_count: 3,
                work_point_count: 4,
                latest_work_date: '2026-05-08',
                progress_summary: {
                  count: 1,
                  statuses: ['在建'],
                },
                source_watermark: 'wm',
              },
            ],
            count: 1,
            cached: true,
            stale: false,
            source_watermark: 'wm',
            refreshed_at: '2026-05-09T10:00:00',
          },
          timestamp: '2026-05-09T10:00:00',
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchDomainProjects({ keyword: '示例' });

    expect(result.projects[0].project_code).toBe('PRJ-001');
    expect(result.cached).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetchDomainLineSectionDetail should encode line_section_key', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          code: 0,
          message: 'success',
          data: {
            line_section: null,
            tower_sequence: [],
            matched_towers: [],
            reference_nodes: [],
            missing_nodes: [],
            scope_without_tower: [],
            warnings: [],
            cached: false,
            stale: false,
            source_watermark: null,
            refreshed_at: null,
          },
          timestamp: '2026-05-09T10:00:00',
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await fetchDomainLineSectionDetail('dcp:line_section:一段(测试)');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        '/api/domain/line-sections/dcp%3Aline_section%3A%E4%B8%80%E6%AE%B5(%E6%B5%8B%E8%AF%95)',
      ),
      expect.any(Object),
    );
  });
});
