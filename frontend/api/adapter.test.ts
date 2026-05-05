import { describe, expect, it } from 'vitest';
import { adaptDataHubMapSummary, adaptDataHubSkeleton } from './adapter';

describe('DataHub adapter', () => {
  it('should map DataHub work points into Monitor map data without raw fields', () => {
    const records = adaptDataHubMapSummary({
      meta: {
        date: '2026-05-04',
        limit: 10000,
        work_points_count: 1,
        truncated: false,
      },
      work_points: [
        {
          id: 'dcp:work_point:2026-05-04:meeting-001',
          project_name: '湖南作业点',
          longitude: 112.93,
          latitude: 28.22,
          person_count: 12,
          risk_level: '2',
          work_status: 'working',
          voltage_level: '500kV',
          city: '长沙',
          work_date: '2026-05-04',
          raw: { should_not_leak: true },
        } as any,
      ],
    });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: 'dcp:work_point:2026-05-04:meeting-001',
      projectName: '湖南作业点',
      longitude: 112.93,
      latitude: 28.22,
      personCount: 12,
      riskLevel: 2,
      workStatus: 'working',
      voltageLevelName: '500kV',
      city: '长沙',
      workDate: '2026-05-04',
    });
    expect('raw' in records[0]).toBe(false);
  });

  it('should map DataHub towers and stations into skeleton layers without raw fields', () => {
    const skeleton = adaptDataHubSkeleton({
      meta: {
        limit: 10000,
        stations_count: 1,
        towers_count: 1,
        truncated: false,
      },
      lines: [],
      towers: [
        {
          id: 'dcp:tower:TW-001',
          tower_id: 'TW-001',
          single_project_code: 'SP-001',
          bidding_section_code: 'BD-001',
          tower_no: 'N101',
          upstream_tower_no: 'N100',
          longitude: 112.94,
          latitude: 28.23,
          tower_type: 'linear',
          tower_full_height: '66.5',
          nominal_height: '54',
          raw: { should_not_leak: true },
        } as any,
      ],
      stations: [
        {
          id: 'dcp:station:SP-001',
          project_code: 'PRJ-001',
          single_project_code: 'SP-001',
          longitude: 112.92,
          latitude: 28.21,
          raw: { should_not_leak: true },
        } as any,
      ],
    });

    expect(skeleton.lines).toEqual([]);
    expect(skeleton.towers).toEqual([
      {
        id: 'dcp:tower:TW-001',
        single_project_code: 'SP-001',
        tower_no: 'N101',
        longitude: 112.94,
        latitude: 28.23,
        tower_sequence_no: null,
      },
    ]);
    expect(skeleton.stations).toEqual([
      {
        id: 'dcp:station:SP-001',
        single_project_code: 'SP-001',
        name: 'SP-001',
        prj_code: 'PRJ-001',
        longitude: 112.92,
        latitude: 28.21,
      },
    ]);
    expect('raw' in skeleton.towers[0]).toBe(false);
    expect('raw' in skeleton.stations[0]).toBe(false);
  });
});
