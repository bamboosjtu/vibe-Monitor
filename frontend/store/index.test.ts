import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAppStore } from './index';
import type { RawDataResponse, DataParseStats } from '@/types';
import { setDataSource as setApiDataSource } from '@/api/config';
import {
  fetchDomainLineSectionDetail,
  fetchDomainLineSections,
  fetchDomainProject,
  fetchDomainProjectMap,
  fetchDomainProjectStatus,
} from '@/api/domainApi';

vi.mock('@/api/domainApi', () => ({
  fetchDomainProjects: vi.fn(),
  fetchDomainProject: vi.fn(),
  fetchDomainProjectMap: vi.fn(),
  fetchDomainLineSections: vi.fn(),
  fetchDomainLineSectionDetail: vi.fn(),
  fetchDomainProjectStatus: vi.fn(),
}));

describe('App Store', () => {
  beforeEach(() => {
    setApiDataSource('local');
    vi.unstubAllGlobals();
    // 重置 store 状态
    useAppStore.setState({
      pageStatus: 'idle',
      rawData: null,
      normalizedData: [],
      filteredData: [],
      selectedItem: null,
      filters: {
        workStatus: 'all',
        riskLevels: [],
        cities: [],
        voltageLevels: [],
      },
      parseStats: null,
      currentDate: null,
      availableDates: [],
      isPlaying: false,
      playSpeed: 1,
      error: null,
      dataSource: 'local',
      projectSearchKeyword: '',
      projectListRaw: [],
      projectList: [],
      projectListLoading: false,
      projectListError: null,
      selectedProjectCode: null,
      selectedProject: null,
      selectedProjectLoading: false,
      selectedProjectError: null,
      selectedProjectMap: null,
      selectedProjectMapNormalized: null,
      lineSections: [],
      lineSectionsLoading: false,
      lineSectionsError: null,
      selectedLineSectionKey: null,
      selectedLineSection: null,
      selectedLineSectionLoading: false,
      selectedLineSectionError: null,
      projectStatusList: [],
      projectStatusLoading: false,
      projectStatusError: null,
      selectedProjectStatus: 'all',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useAppStore.getState();

      expect(state.pageStatus).toBe('idle');
      expect(state.currentDate).toBeNull();
      expect(state.availableDates).toEqual([]);
      expect(state.normalizedData).toEqual([]);
      expect(state.filteredData).toEqual([]);
      expect(state.selectedItem).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  describe('startLoading', () => {
    it('should set pageStatus to loading', () => {
      const { startLoading } = useAppStore.getState();

      startLoading();

      const state = useAppStore.getState();
      expect(state.pageStatus).toBe('loading');
    });

    it('should preserve existing data when loading', () => {
      const { startLoading, loadSuccess } = useAppStore.getState();

      // 先加载一些数据
      const mockRawData: RawDataResponse = {
        http_status: 200,
        summary: { total: 0, list_length: 0 },
        list: [],
        date: '2026-04-01',
      };

      const mockStats: DataParseStats = {
        totalRawRecords: 0,
        validCoordinateRecords: 0,
        filteredRecords: 0,
        filterReasons: {
          emptyCoordinates: 0,
          invalidCoordinates: 0,
          outOfBounds: 0,
          zeroCoordinates: 0,
        },
      };

      loadSuccess({
        rawData: mockRawData,
        normalizedData: [],
        stats: mockStats,
        date: '2026-04-01',
      });

      // 开始新的加载
      startLoading();

      const state = useAppStore.getState();
      // 数据应该保留，只有状态改变
      expect(state.normalizedData).toEqual([]);
      expect(state.pageStatus).toBe('loading');
    });
  });

  describe('setAvailableDates', () => {
    it('should set available dates', () => {
      const { setAvailableDates } = useAppStore.getState();
      const dates = ['2026-04-01', '2026-04-02', '2026-04-03'];

      setAvailableDates(dates);

      const state = useAppStore.getState();
      expect(state.availableDates).toEqual(dates);
    });
  });

  describe('setCurrentDate', () => {
    it('should set current date', () => {
      const { setCurrentDate } = useAppStore.getState();

      setCurrentDate('2026-04-05');

      const state = useAppStore.getState();
      expect(state.currentDate).toBe('2026-04-05');
    });
  });

  describe('filters', () => {
    it('should update filters correctly', () => {
      const { setFilters } = useAppStore.getState();

      setFilters({ workStatus: 'working' });

      const state = useAppStore.getState();
      expect(state.filters.workStatus).toBe('working');
      // 其他筛选条件应保持默认值
      expect(state.filters.cities).toBeDefined();
      expect(state.filters.voltageLevels).toBeDefined();
    });

    it('should reset filters to default', () => {
      const { setFilters, resetFilters } = useAppStore.getState();

      // 先设置一些筛选条件
      setFilters({ workStatus: 'working', riskLevels: [1] });

      // 重置筛选
      resetFilters();

      const state = useAppStore.getState();
      expect(state.filters).toEqual({
        workStatus: 'all',
        riskLevels: [],
        cities: [],
        voltageLevels: [],
      });
    });
  });

  describe('selectedItem', () => {
    it('should select an item', () => {
      const { setSelectedItem } = useAppStore.getState();
      const mockItem = {
        id: '1',
        projectName: 'Test Project',
        longitude: 112.5,
        latitude: 28.2,
      };

      setSelectedItem(mockItem as any);

      const state = useAppStore.getState();
      expect(state.selectedItem).toEqual(mockItem);
    });

    it('should clear selected item', () => {
      const { setSelectedItem, clearSelectedItem } = useAppStore.getState();
      const mockItem = { id: '1', projectName: 'Test' };

      setSelectedItem(mockItem as any);
      clearSelectedItem();

      const state = useAppStore.getState();
      expect(state.selectedItem).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should set error message', () => {
      const { loadError } = useAppStore.getState();

      loadError('Failed to load data');

      const state = useAppStore.getState();
      expect(state.error).toBe('Failed to load data');
      expect(state.pageStatus).toBe('error');
    });

    it('should clear error', () => {
      const { loadError, setError } = useAppStore.getState();

      loadError('Error');
      setError(null);

      const state = useAppStore.getState();
      expect(state.error).toBeNull();
    });
  });

  describe('monitor backend mode', () => {
    it('should load dates and latest work points from Monitor backend', async () => {
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/map/dates')) {
          return new Response(JSON.stringify({
            code: 0,
            message: 'success',
            data: {
              dates: ['2026-05-03', '2026-05-04'],
              latest_date: '2026-05-04',
              count: 2,
            },
          }));
        }
        if (url.endsWith('/api/map/summary?date=2026-05-04')) {
          return new Response(JSON.stringify({
            code: 0,
            message: 'success',
            data: {
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
                },
              ],
            },
          }));
        }
        throw new Error(`unexpected url: ${url}`);
      });
      vi.stubGlobal('fetch', fetchMock);

      const { setDataSource, loadFromDataHub } = useAppStore.getState();
      setDataSource('monitor_backend');
      await loadFromDataHub();

      const state = useAppStore.getState();
      expect(state.availableDates).toEqual(['2026-05-03', '2026-05-04']);
      expect(state.currentDate).toBe('2026-05-04');
      expect(state.normalizedData).toHaveLength(1);
      expect(state.normalizedData[0].projectName).toBe('湖南作业点');
      expect(state.normalizedData[0].riskLevel).toBe(2);
      expect('raw' in state.normalizedData[0]).toBe(false);
    });

    it('should reload work points for selected Monitor backend date', async () => {
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/map/summary?date=2026-05-03')) {
          return new Response(JSON.stringify({
            code: 0,
            message: 'success',
            data: {
              meta: {
                date: '2026-05-03',
                limit: 10000,
                work_points_count: 1,
                truncated: false,
              },
              work_points: [
                {
                  id: 'dcp:work_point:2026-05-03:meeting-002',
                  project_name: '三号作业点',
                  longitude: 112.91,
                  latitude: 28.21,
                  person_count: 8,
                  risk_level: '3',
                  work_status: 'paused',
                  voltage_level: '220kV',
                  city: '株洲',
                  work_date: '2026-05-03',
                },
              ],
            },
          }));
        }
        throw new Error(`unexpected url: ${url}`);
      });
      vi.stubGlobal('fetch', fetchMock);

      const { setDataSource, loadDataByDate } = useAppStore.getState();
      setDataSource('monitor_backend');
      await loadDataByDate('2026-05-03');

      const state = useAppStore.getState();
      expect(state.currentDate).toBe('2026-05-03');
      expect(state.normalizedData[0].projectName).toBe('三号作业点');
      expect(state.normalizedData[0].riskLevel).toBe(3);
    });
  });

  describe('monitor backend mode', () => {
    it('should load dates and latest work points from monitor backend without meta', async () => {
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/map/dates')) {
          return new Response(JSON.stringify({
            code: 0,
            message: 'success',
            data: {
              dates: ['2026-05-03', '2026-05-04'],
              latest_date: '2026-05-04',
              count: 2,
              cached: true,
              stale: false,
              source_watermark: 'wm-dates',
              refreshed_at: '2026-05-08T08:00:00',
            },
          }));
        }
        if (url.endsWith('/api/map/summary?date=2026-05-04')) {
          return new Response(JSON.stringify({
            code: 0,
            message: 'success',
            data: {
              date: '2026-05-04',
              summary: {
                date: '2026-05-04',
                limit: 10000,
                work_points_count: 1,
                truncated: false,
              },
              work_points: [
                {
                  id: 'dcp:work_point:2026-05-04:meeting-003',
                  project_name: '缓存作业点',
                  longitude: 112.95,
                  latitude: 28.25,
                  person_count: 6,
                  risk_level: '4',
                  work_status: 'finished',
                  voltage_level: '110kV',
                  city: '湘潭',
                  work_date: '2026-05-04',
                },
              ],
              total_points: 1,
              data: [],
              cached: true,
              stale: false,
              source_watermark: 'wm-summary',
              refreshed_at: '2026-05-08T08:00:01',
            },
          }));
        }
        throw new Error(`unexpected url: ${url}`);
      });
      vi.stubGlobal('fetch', fetchMock);

      const { setDataSource, loadFromDataHub } = useAppStore.getState();
      setDataSource('monitor_backend');
      await loadFromDataHub();

      const state = useAppStore.getState();
      expect(state.availableDates).toEqual(['2026-05-03', '2026-05-04']);
      expect(state.currentDate).toBe('2026-05-04');
      expect(state.normalizedData).toHaveLength(1);
      expect(state.filteredData).toHaveLength(1);
      expect(state.parseStats?.totalRawRecords).toBe(1);
      expect(state.normalizedData[0].projectName).toBe('缓存作业点');
      expect(state.normalizedData[0].riskLevel).toBe(4);
    });
  });

  describe('domain project workflow', () => {
    it('selectProject should update selectedProjectCode and load detail/map/line sections', async () => {
      vi.mocked(fetchDomainProject).mockResolvedValue({
        project: {
          attributes: {
            project_code: 'PRJ-001',
            project_name: '示例工程',
          },
        },
        single_projects: [],
        bidding_sections: [],
        towers: [],
        stations: [],
        line_sections: [],
        work_points: [],
        project_progress: [],
        counts: {},
        latest_work_date: '2026-05-08',
        progress_summary: {
          count: 1,
          statuses: ['在建'],
        },
        warnings: [],
        cached: true,
        stale: false,
        source_watermark: 'wm-detail',
        refreshed_at: '2026-05-09T10:00:00',
      } as any);
      vi.mocked(fetchDomainProjectMap).mockResolvedValue({
        project: null,
        towers: [],
        stations: [],
        line_sections: [],
        work_points: [
          {
            id: 'dcp:work_point:2026-05-08:meeting-001',
            project_name: '示例工程',
            project_code: 'PRJ-001',
            longitude: 112.93,
            latitude: 28.22,
            person_count: 6,
            risk_level: '2',
            work_status: 'working',
            voltage_level: '500kV',
            city: '长沙',
            work_date: '2026-05-08',
          },
        ],
        counts: {},
        latest_work_date: '2026-05-08',
        progress_summary: {
          count: 1,
          statuses: ['在建'],
        },
        warnings: [],
        cached: true,
        stale: false,
        source_watermark: 'wm-map',
        refreshed_at: '2026-05-09T10:00:00',
      } as any);
      vi.mocked(fetchDomainLineSections).mockResolvedValue({
        line_sections: [
          {
            line_section_key: 'LS-001',
            line_section_name: '一区段',
            project_code: 'PRJ-001',
            single_project_code: 'SP-001',
            bidding_section_code: 'BS-001',
            tower_sequence_count: 2,
            matched_tower_count: 1,
            reference_node_count: 1,
            missing_physical_count: 0,
            scope_without_tower_count: 0,
            status: 'reference',
            source_watermark: 'wm-line',
          },
        ],
        count: 1,
        cached: true,
        stale: false,
        source_watermark: 'wm-line',
        refreshed_at: '2026-05-09T10:00:00',
      } as any);

      useAppStore.setState({
        normalizedData: [
          {
            id: 'global-1',
            projectName: '全局工程',
            projectCode: 'PRJ-999',
            ticketId: '',
            ticketNo: '',
            ticketName: '',
            address: '',
            longitude: 112.5,
            latitude: 28.2,
            city: '长沙',
            personCount: 1,
            personCountDisplay: 1,
            leaderName: '',
            riskLevel: 1,
            workStatus: 'working',
            voltageLevel: 'unknown',
            voltageLevelName: '未知',
            constructionUnit: '',
            supervisionUnit: '',
            workProcedure: '',
            workSiteName: '',
            workDate: '2026-05-08',
            workStartTime: '',
          },
        ],
      });

      await useAppStore.getState().selectProject('PRJ-001');

      const state = useAppStore.getState();
      const selectedProjectAttributes = (state.selectedProject?.project as any)?.attributes ?? {};
      expect(state.selectedProjectCode).toBe('PRJ-001');
      expect(selectedProjectAttributes.project_code).toBe('PRJ-001');
      expect(state.selectedProjectMap?.work_points).toHaveLength(1);
      expect(state.lineSections[0].line_section_key).toBe('LS-001');
      expect(state.filteredData[0].projectCode).toBe('PRJ-001');
    });

    it('clearSelectedProject should clear selected project and line section state', () => {
      useAppStore.setState({
        selectedProjectCode: 'PRJ-001',
        selectedProject: { project: null } as any,
        selectedProjectMap: { work_points: [] } as any,
        selectedProjectMapNormalized: [],
        selectedLineSectionKey: 'LS-001',
        selectedLineSection: { line_section: null } as any,
      });

      useAppStore.getState().clearSelectedProject();

      const state = useAppStore.getState();
      expect(state.selectedProjectCode).toBeNull();
      expect(state.selectedProject).toBeNull();
      expect(state.selectedLineSectionKey).toBeNull();
      expect(state.selectedLineSection).toBeNull();
    });

    it('project status filter should filter work points by project_code', () => {
      useAppStore.setState({
        normalizedData: [
          {
            id: 'p1',
            projectName: '工程一',
            projectCode: 'PRJ-001',
            ticketId: '',
            ticketNo: '',
            ticketName: '',
            address: '',
            longitude: 112.5,
            latitude: 28.2,
            city: '长沙',
            personCount: 5,
            personCountDisplay: 5,
            leaderName: '',
            riskLevel: 1,
            workStatus: 'working',
            voltageLevel: 'unknown',
            voltageLevelName: '未知',
            constructionUnit: '',
            supervisionUnit: '',
            workProcedure: '',
            workSiteName: '',
            workDate: '2026-05-08',
            workStartTime: '',
          },
          {
            id: 'p2',
            projectName: '工程二',
            projectCode: 'PRJ-002',
            ticketId: '',
            ticketNo: '',
            ticketName: '',
            address: '',
            longitude: 112.6,
            latitude: 28.3,
            city: '株洲',
            personCount: 4,
            personCountDisplay: 4,
            leaderName: '',
            riskLevel: 2,
            workStatus: 'working',
            voltageLevel: 'unknown',
            voltageLevelName: '未知',
            constructionUnit: '',
            supervisionUnit: '',
            workProcedure: '',
            workSiteName: '',
            workDate: '2026-05-08',
            workStartTime: '',
          },
        ],
        projectStatusList: [
          {
            project_code: 'PRJ-001',
            project_name: '工程一',
            status: '在建',
            progress_summary: null,
            source_watermark: null,
          },
          {
            project_code: 'PRJ-002',
            project_name: '工程二',
            status: '投产',
            progress_summary: null,
            source_watermark: null,
          },
        ],
      });

      useAppStore.getState().setSelectedProjectStatus('在建');

      const state = useAppStore.getState();
      expect(state.filteredData).toHaveLength(1);
      expect(state.filteredData[0].projectCode).toBe('PRJ-001');
    });

    it('selectedProjectCode should persist after switching date', async () => {
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/map/summary?date=2026-05-03')) {
          return new Response(
            JSON.stringify({
              code: 0,
              message: 'success',
              data: {
                meta: {
                  date: '2026-05-03',
                  limit: 10000,
                  work_points_count: 1,
                  truncated: false,
                },
                work_points: [
                  {
                    id: 'dcp:work_point:2026-05-03:meeting-010',
                    project_name: '示例工程',
                    project_code: 'PRJ-001',
                    longitude: 112.91,
                    latitude: 28.21,
                    person_count: 8,
                    risk_level: '3',
                    work_status: 'paused',
                    voltage_level: '220kV',
                    city: '株洲',
                    work_date: '2026-05-03',
                  },
                ],
              },
            }),
          );
        }
        throw new Error(`unexpected url: ${url}`);
      });
      vi.stubGlobal('fetch', fetchMock);
      vi.mocked(fetchDomainProject).mockResolvedValue({
        project: { attributes: { project_code: 'PRJ-001' } },
        single_projects: [],
        bidding_sections: [],
        towers: [],
        stations: [],
        line_sections: [],
        work_points: [],
        project_progress: [],
        counts: {},
        latest_work_date: '2026-05-03',
        progress_summary: {
          count: 1,
          statuses: ['在建'],
        },
        warnings: [],
        cached: true,
        stale: false,
        source_watermark: 'wm',
        refreshed_at: '2026-05-09T10:00:00',
      } as any);
      vi.mocked(fetchDomainProjectMap).mockResolvedValue({
        project: null,
        towers: [],
        stations: [],
        line_sections: [],
        work_points: [],
        counts: {},
        latest_work_date: '2026-05-03',
        progress_summary: {
          count: 1,
          statuses: ['在建'],
        },
        warnings: [],
        cached: true,
        stale: false,
        source_watermark: 'wm',
        refreshed_at: '2026-05-09T10:00:00',
      } as any);

      useAppStore.setState({
        dataSource: 'monitor_backend',
        selectedProjectCode: 'PRJ-001',
      });

      await useAppStore.getState().loadDataByDate('2026-05-03');

      expect(useAppStore.getState().selectedProjectCode).toBe('PRJ-001');
    });

    it('selectLineSection should load selected line section detail', async () => {
      vi.mocked(fetchDomainLineSectionDetail).mockResolvedValue({
        line_section: {
          attributes: {
            line_section_name: '一区段',
          },
        },
        tower_sequence: [],
        matched_towers: [],
        reference_nodes: [],
        missing_nodes: [],
        scope_without_tower: [],
        warnings: [],
        cached: true,
        stale: false,
        source_watermark: 'wm',
        refreshed_at: '2026-05-09T10:00:00',
      } as any);

      await useAppStore.getState().selectLineSection('LS-001');

      const lineSectionAttributes =
        (useAppStore.getState().selectedLineSection?.line_section as any)?.attributes ?? {};
      expect(useAppStore.getState().selectedLineSectionKey).toBe('LS-001');
      expect(lineSectionAttributes.line_section_name).toBe('一区段');
    });

    it('loadProjectStatus should populate project status list', async () => {
      vi.mocked(fetchDomainProjectStatus).mockResolvedValue({
        items: [
          {
            project_code: 'PRJ-001',
            project_name: '示例工程',
            status: '在建',
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
      } as any);

      await useAppStore.getState().loadProjectStatus();

      expect(useAppStore.getState().projectStatusList[0]?.status).toBe('在建');
    });
  });
});
