import { create } from 'zustand';
import type {
  PageStatus,
  RawDataResponse,
  NormalizedStationMeeting,
  DataParseStats,
  FilterState,
} from '@/types';
import { applyFilters, DEFAULT_FILTER_STATE } from '@/lib/filter';
import {
  adaptDataHubMapSummary,
  adaptDataHubWorkPoint,
  adaptMapSummary,
  fetchMonitorBackendDates,
  fetchMonitorBackendMapSummary,
  getSummaryDate,
  getSummaryWorkPoints,
  getApiConfig,
  getMapSummary,
  setDataSource as setApiDataSource,
} from '@/api';
import { normalizeDataSource, type DataSourceMode } from '@/api/config';
import {
  fetchDomainLineSectionDetail,
  fetchDomainLineSections,
  fetchDomainProject,
  fetchDomainProjectMap,
  fetchDomainProjects,
  fetchDomainProjectStatus,
  type MonitorLineSectionDetailResponse,
  type MonitorLineSectionIndexItem,
  type MonitorProjectDetailResponse,
  type MonitorProjectIndexItem,
  type MonitorProjectMapResponse,
  type MonitorProjectStatusItem,
} from '@/api/domainApi';

type SelectedObject = { type: 'tower' | 'station' | 'workPoint'; data: any } | null;
type ProjectStatusFilter = 'all' | 'unknown' | string;
type SelectedProjectDetail = MonitorProjectDetailResponse & { status: string | null };

interface DerivedFilterState {
  normalizedData: NormalizedStationMeeting[];
  filters: FilterState;
  selectedProjectCode: string | null;
  selectedProjectMapNormalized: NormalizedStationMeeting[] | null;
  selectedProjectStatus: ProjectStatusFilter;
  projectStatusList: MonitorProjectStatusItem[];
  projectListRaw: MonitorProjectIndexItem[];
}

function normalizeProjectStatus(status: string | null | undefined): string {
  return status && status.trim() ? status : 'unknown';
}

function getProjectStatusCodeSet(
  selectedProjectStatus: ProjectStatusFilter,
  projectStatusList: MonitorProjectStatusItem[],
  projectListRaw: MonitorProjectIndexItem[],
): Set<string> | null {
  if (selectedProjectStatus === 'all') {
    return null;
  }

  const items =
    projectStatusList.length > 0
      ? projectStatusList.map(item => ({
          project_code: item.project_code,
          status: item.status,
        }))
      : projectListRaw.map(item => ({
          project_code: item.project_code,
          status: item.status,
        }));

  return new Set(
    items
      .filter(item => normalizeProjectStatus(item.status) === selectedProjectStatus)
      .map(item => item.project_code)
      .filter((value): value is string => Boolean(value)),
  );
}

function getWorkPointSource(state: DerivedFilterState): NormalizedStationMeeting[] {
  if (state.selectedProjectCode && state.selectedProjectMapNormalized) {
    return state.selectedProjectMapNormalized;
  }
  return state.normalizedData;
}

function computeFilteredData(state: DerivedFilterState): NormalizedStationMeeting[] {
  const allowedProjectCodes = getProjectStatusCodeSet(
    state.selectedProjectStatus,
    state.projectStatusList,
    state.projectListRaw,
  );

  const domainFiltered = getWorkPointSource(state).filter(item => {
    if (state.selectedProjectCode) {
      if (!item.projectCode) {
        return false;
      }
      if (item.projectCode !== state.selectedProjectCode) {
        return false;
      }
    }

    if (allowedProjectCodes) {
      if (!item.projectCode) {
        return false;
      }
      if (!allowedProjectCodes.has(item.projectCode)) {
        return false;
      }
    }

    return true;
  });

  return applyFilters(domainFiltered, state.filters);
}

function resolvePageStatus(
  normalizedData: NormalizedStationMeeting[],
  filteredData: NormalizedStationMeeting[],
): PageStatus {
  if (normalizedData.length === 0) {
    return 'empty';
  }
  if (filteredData.length === 0) {
    return 'filtered_empty';
  }
  return 'ready';
}

function filterProjectListByStatus(
  projects: MonitorProjectIndexItem[],
  selectedProjectStatus: ProjectStatusFilter,
): MonitorProjectIndexItem[] {
  if (selectedProjectStatus === 'all') {
    return projects;
  }
  return projects.filter(
    project => normalizeProjectStatus(project.status) === selectedProjectStatus,
  );
}

function resolveProjectStatus(
  projectCode: string,
  projectStatusList: MonitorProjectStatusItem[],
  projectListRaw: MonitorProjectIndexItem[],
): string | null {
  const statusItem = projectStatusList.find(item => item.project_code === projectCode);
  if (statusItem) {
    return statusItem.status ?? null;
  }
  const projectItem = projectListRaw.find(item => item.project_code === projectCode);
  return projectItem?.status ?? null;
}

export interface AppState {
  pageStatus: PageStatus;
  setPageStatus: (status: PageStatus) => void;

  error: string | null;
  setError: (error: string | null) => void;

  rawData: RawDataResponse | null;
  setRawData: (data: RawDataResponse | null) => void;

  normalizedData: NormalizedStationMeeting[];
  setNormalizedData: (data: NormalizedStationMeeting[]) => void;

  filteredData: NormalizedStationMeeting[];

  parseStats: DataParseStats | null;
  setParseStats: (stats: DataParseStats | null) => void;

  filters: FilterState;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;

  selectedItem: NormalizedStationMeeting | null;
  setSelectedItem: (item: NormalizedStationMeeting | null) => void;
  clearSelectedItem: () => void;

  selectedObject: SelectedObject;
  setSelectedObject: (obj: SelectedObject) => void;
  clearSelectedObject: () => void;

  currentDate: string | null;
  setCurrentDate: (date: string) => void;

  availableDates: string[];
  setAvailableDates: (dates: string[]) => void;

  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;

  playSpeed: number;
  setPlaySpeed: (speed: number) => void;

  startLoading: () => void;
  loadSuccess: (params: {
    rawData: RawDataResponse;
    normalizedData: NormalizedStationMeeting[];
    stats: DataParseStats;
    date?: string;
  }) => void;
  loadError: (error: string, preserveData?: boolean) => void;
  resetData: () => void;

  loadDataByDate: (date: string, isInitialLoad?: boolean) => Promise<void>;
  loadFromApi: () => Promise<void>;
  loadFromDataHub: () => Promise<void>;
  dataSource: DataSourceMode;
  setDataSource: (source: DataSourceMode) => void;

  layerVisibility: {
    tower: boolean;
    workPoint: boolean;
    station: boolean;
  };
  setLayerVisibility: (layer: keyof AppState['layerVisibility'], visible: boolean) => void;

  projectSearchKeyword: string;
  projectListRaw: MonitorProjectIndexItem[];
  projectList: MonitorProjectIndexItem[];
  projectListLoading: boolean;
  projectListError: string | null;
  selectedProjectCode: string | null;
  selectedProject: SelectedProjectDetail | null;
  selectedProjectLoading: boolean;
  selectedProjectError: string | null;
  selectedProjectMap: MonitorProjectMapResponse | null;
  selectedProjectMapNormalized: NormalizedStationMeeting[] | null;
  lineSections: MonitorLineSectionIndexItem[];
  lineSectionsLoading: boolean;
  lineSectionsError: string | null;
  selectedLineSectionKey: string | null;
  selectedLineSection: MonitorLineSectionDetailResponse | null;
  selectedLineSectionLoading: boolean;
  selectedLineSectionError: string | null;
  projectStatusList: MonitorProjectStatusItem[];
  projectStatusLoading: boolean;
  projectStatusError: string | null;
  selectedProjectStatus: ProjectStatusFilter;

  loadDomainProjects: (keyword?: string) => Promise<void>;
  selectProject: (projectCode: string) => Promise<void>;
  clearSelectedProject: () => void;
  loadProjectDetail: (projectCode: string) => Promise<void>;
  loadProjectMap: (projectCode: string) => Promise<void>;
  loadProjectLineSections: (projectCode: string) => Promise<void>;
  selectLineSection: (lineSectionKey: string) => Promise<void>;
  clearSelectedLineSection: () => void;
  loadProjectStatus: () => Promise<void>;
  setSelectedProjectStatus: (status: ProjectStatusFilter) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  pageStatus: 'idle',
  setPageStatus: status => set({ pageStatus: status }),

  error: null,
  setError: error => set({ error }),

  rawData: null,
  setRawData: data => set({ rawData: data }),

  normalizedData: [],
  setNormalizedData: data =>
    set(state => {
      const filteredData = computeFilteredData({
        normalizedData: data,
        filters: state.filters,
        selectedProjectCode: state.selectedProjectCode,
        selectedProjectMapNormalized: state.selectedProjectMapNormalized,
        selectedProjectStatus: state.selectedProjectStatus,
        projectStatusList: state.projectStatusList,
        projectListRaw: state.projectListRaw,
      });
      return {
        normalizedData: data,
        filteredData,
        pageStatus: resolvePageStatus(data, filteredData),
      };
    }),

  filteredData: [],

  parseStats: null,
  setParseStats: stats => set({ parseStats: stats }),

  filters: DEFAULT_FILTER_STATE,
  setFilters: newFilters =>
    set(state => {
      const filters = { ...state.filters, ...newFilters };
      const filteredData = computeFilteredData({
        normalizedData: state.normalizedData,
        filters,
        selectedProjectCode: state.selectedProjectCode,
        selectedProjectMapNormalized: state.selectedProjectMapNormalized,
        selectedProjectStatus: state.selectedProjectStatus,
        projectStatusList: state.projectStatusList,
        projectListRaw: state.projectListRaw,
      });
      const selectedStillVisible = state.selectedItem
        ? filteredData.some(item => item.id === state.selectedItem?.id)
        : false;

      return {
        filters,
        filteredData,
        pageStatus: resolvePageStatus(state.normalizedData, filteredData),
        selectedItem: selectedStillVisible ? state.selectedItem : null,
      };
    }),
  resetFilters: () =>
    set(state => {
      const filteredData = computeFilteredData({
        normalizedData: state.normalizedData,
        filters: DEFAULT_FILTER_STATE,
        selectedProjectCode: state.selectedProjectCode,
        selectedProjectMapNormalized: state.selectedProjectMapNormalized,
        selectedProjectStatus: state.selectedProjectStatus,
        projectStatusList: state.projectStatusList,
        projectListRaw: state.projectListRaw,
      });
      return {
        filters: DEFAULT_FILTER_STATE,
        filteredData,
        pageStatus: resolvePageStatus(state.normalizedData, filteredData),
      };
    }),

  selectedItem: null,
  setSelectedItem: item => set({ selectedItem: item }),
  clearSelectedItem: () => set({ selectedItem: null }),

  selectedObject: null,
  setSelectedObject: obj => set({ selectedObject: obj }),
  clearSelectedObject: () => set({ selectedObject: null }),

  currentDate: null,
  setCurrentDate: date => set({ currentDate: date }),

  availableDates: [],
  setAvailableDates: dates => set({ availableDates: dates }),

  isPlaying: false,
  setIsPlaying: playing => set({ isPlaying: playing }),

  playSpeed: 1,
  setPlaySpeed: speed => set({ playSpeed: speed }),

  startLoading: () => set({ pageStatus: 'loading', error: null }),

  loadSuccess: ({ rawData, normalizedData, stats, date }) =>
    set(state => {
      const filteredData = computeFilteredData({
        normalizedData,
        filters: state.filters,
        selectedProjectCode: state.selectedProjectCode,
        selectedProjectMapNormalized: state.selectedProjectMapNormalized,
        selectedProjectStatus: state.selectedProjectStatus,
        projectStatusList: state.projectStatusList,
        projectListRaw: state.projectListRaw,
      });
      const selectedStillVisible = state.selectedItem
        ? filteredData.some(item => item.id === state.selectedItem?.id)
        : false;

      return {
        pageStatus: resolvePageStatus(normalizedData, filteredData),
        rawData,
        normalizedData,
        filteredData,
        parseStats: stats,
        currentDate: date || state.currentDate,
        selectedItem: selectedStillVisible ? state.selectedItem : null,
        error: null,
      };
    }),

  loadError: (errorMessage, preserveData = false) => {
    if (preserveData) {
      set({
        pageStatus: 'ready',
        error: errorMessage,
      });
      return;
    }

    set({
      pageStatus: 'error',
      error: errorMessage,
      rawData: null,
      normalizedData: [],
      filteredData: [],
      parseStats: null,
      selectedItem: null,
    });
  },

  resetData: () =>
    set({
      pageStatus: 'idle',
      error: null,
      rawData: null,
      normalizedData: [],
      filteredData: [],
      parseStats: null,
      filters: DEFAULT_FILTER_STATE,
      selectedItem: null,
      currentDate: null,
      isPlaying: false,
      selectedProjectCode: null,
      selectedProject: null,
      selectedProjectError: null,
      selectedProjectMap: null,
      selectedProjectMapNormalized: null,
      lineSections: [],
      lineSectionsError: null,
      selectedLineSectionKey: null,
      selectedLineSection: null,
      selectedLineSectionError: null,
    }),

  loadDataByDate: async (date: string, isInitialLoad = false) => {
    const { dataSource, loadSuccess, loadError } = get();

    try {
      let resolvedDate = date;

      if (dataSource === 'monitor_backend') {
        const remoteSummary = await fetchMonitorBackendMapSummary(date);
        const workPoints = getSummaryWorkPoints(remoteSummary);
        const normalizedData = adaptDataHubMapSummary(remoteSummary);
        resolvedDate = getSummaryDate(remoteSummary, date) ?? date;

        loadSuccess({
          rawData: null as any,
          normalizedData,
          stats: {
            totalRawRecords: workPoints.length,
            validCoordinateRecords: normalizedData.length,
            filteredRecords: workPoints.length - normalizedData.length,
            filterReasons: {
              emptyCoordinates: 0,
              invalidCoordinates: workPoints.length - normalizedData.length,
              outOfBounds: 0,
              zeroCoordinates: 0,
            },
          },
          date: resolvedDate,
        });
      } else {
        const { loadAndParseByDate } = await import('@/lib/dateDataLoader');
        const result = await loadAndParseByDate(date);
        resolvedDate = result.date || date;

        loadSuccess({
          rawData: result.rawData,
          normalizedData: result.normalizedData,
          stats: result.stats,
          date: result.date,
        });
      }

      if (get().selectedProjectCode) {
        const projectCode = get().selectedProjectCode!;
        await Promise.allSettled([
          get().loadProjectDetail(projectCode),
          get().loadProjectMap(projectCode),
        ]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      loadError(errorMessage, !isInitialLoad);
      console.error('[Date Load Error]', err);
    }
  },

  dataSource: getApiConfig().source,
  setDataSource: source => {
    const normalizedSource = normalizeDataSource(source);
    setApiDataSource(normalizedSource);
    set({ dataSource: normalizedSource });
  },

  loadFromApi: async () => {
    const { loadSuccess, loadError, startLoading, setAvailableDates, setCurrentDate } = get();

    startLoading();

    try {
      const [{ loadDateManifest }, summary] = await Promise.all([
        import('@/lib/dateDataLoader'),
        getMapSummary(),
      ]);

      const manifest = await loadDateManifest();
      setAvailableDates(manifest.dates);

      const latestDate = manifest.dates[manifest.dates.length - 1] || null;
      if (latestDate) {
        setCurrentDate(latestDate);
      }

      const normalizedData = adaptMapSummary(summary.data);

      loadSuccess({
        rawData: null as any,
        normalizedData,
        stats: {
          totalRawRecords: normalizedData.length,
          validCoordinateRecords: normalizedData.length,
          filteredRecords: 0,
          filterReasons: {
            emptyCoordinates: 0,
            invalidCoordinates: 0,
            outOfBounds: 0,
            zeroCoordinates: 0,
          },
        },
        date: latestDate ?? undefined,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'API 数据加载失败';
      loadError(errorMessage);
      console.error('[API Load Error]', err);
    }
  },

  loadFromDataHub: async () => {
    const { loadSuccess, loadError, startLoading, setAvailableDates, setCurrentDate } = get();

    startLoading();

    try {
      const remoteDates = await fetchMonitorBackendDates();
      const remoteSummaryFetcher = fetchMonitorBackendMapSummary;
      const dates = [...remoteDates.dates].sort();
      setAvailableDates(dates);

      const selectedDate = remoteDates.latest_date ?? dates[dates.length - 1] ?? null;
      if (selectedDate) {
        setCurrentDate(selectedDate);
      }

      const summary = await remoteSummaryFetcher(selectedDate ?? undefined);
      const workPoints = getSummaryWorkPoints(summary);
      const normalizedData = adaptDataHubMapSummary(summary);

      loadSuccess({
        rawData: null as any,
        normalizedData,
        stats: {
          totalRawRecords: workPoints.length,
          validCoordinateRecords: normalizedData.length,
          filteredRecords: workPoints.length - normalizedData.length,
          filterReasons: {
            emptyCoordinates: 0,
            invalidCoordinates: workPoints.length - normalizedData.length,
            outOfBounds: 0,
            zeroCoordinates: 0,
          },
        },
        date: getSummaryDate(summary, selectedDate) ?? undefined,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'DataHub 数据加载失败';
      loadError(errorMessage);
      console.error('[DataHub Load Error]', err);
    }
  },

  layerVisibility: {
    tower: true,
    workPoint: true,
    station: true,
  },
  setLayerVisibility: (layer, visible) => {
    const { layerVisibility } = get();
    set({
      layerVisibility: {
        ...layerVisibility,
        [layer]: visible,
      },
    });
  },

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

  loadDomainProjects: async keyword => {
    const resolvedKeyword = keyword ?? get().projectSearchKeyword;
    set({
      projectListLoading: true,
      projectListError: null,
      projectSearchKeyword: resolvedKeyword,
    });

    try {
      const response = await fetchDomainProjects({
        keyword: resolvedKeyword || undefined,
        limit: 100,
        offset: 0,
      });
      set(state => ({
        projectListRaw: response.projects,
        projectList: filterProjectListByStatus(
          response.projects,
          state.selectedProjectStatus,
        ),
        projectListLoading: false,
        projectListError: null,
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '项目列表加载失败';
      set({
        projectListLoading: false,
        projectListError: errorMessage,
      });
    }
  },

  selectProject: async projectCode => {
    set(state => {
      const filteredData = computeFilteredData({
        normalizedData: state.normalizedData,
        filters: state.filters,
        selectedProjectCode: projectCode,
        selectedProjectMapNormalized: null,
        selectedProjectStatus: state.selectedProjectStatus,
        projectStatusList: state.projectStatusList,
        projectListRaw: state.projectListRaw,
      });
      return {
        selectedProjectCode: projectCode,
        selectedProject: null,
        selectedProjectLoading: true,
        selectedProjectError: null,
        selectedProjectMap: null,
        selectedProjectMapNormalized: null,
        lineSections: [],
        lineSectionsLoading: true,
        lineSectionsError: null,
        selectedLineSectionKey: null,
        selectedLineSection: null,
        selectedLineSectionLoading: false,
        selectedLineSectionError: null,
        selectedItem: null,
        selectedObject: null,
        filteredData,
        pageStatus: resolvePageStatus(state.normalizedData, filteredData),
      };
    });

    await Promise.allSettled([
      get().loadProjectDetail(projectCode),
      get().loadProjectMap(projectCode),
      get().loadProjectLineSections(projectCode),
    ]);
  },

  clearSelectedProject: () =>
    set(state => {
      const filteredData = computeFilteredData({
        normalizedData: state.normalizedData,
        filters: state.filters,
        selectedProjectCode: null,
        selectedProjectMapNormalized: null,
        selectedProjectStatus: state.selectedProjectStatus,
        projectStatusList: state.projectStatusList,
        projectListRaw: state.projectListRaw,
      });
      return {
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
        selectedItem: null,
        selectedObject: null,
        filteredData,
        pageStatus: resolvePageStatus(state.normalizedData, filteredData),
      };
    }),

  loadProjectDetail: async projectCode => {
    set({
      selectedProjectLoading: true,
      selectedProjectError: null,
    });

    try {
      const response = await fetchDomainProject(projectCode, {
        date: get().currentDate || undefined,
        include_work_points: true,
        include_towers: true,
        include_stations: true,
        include_line_sections: true,
      });

      if (get().selectedProjectCode !== projectCode) {
        return;
      }

      set(state => ({
        selectedProject: {
          ...response,
          status: resolveProjectStatus(
            projectCode,
            state.projectStatusList,
            state.projectListRaw,
          ),
        },
        selectedProjectLoading: false,
        selectedProjectError: null,
      }));
    } catch (err) {
      if (get().selectedProjectCode !== projectCode) {
        return;
      }
      set({
        selectedProjectLoading: false,
        selectedProjectError:
          err instanceof Error ? err.message : '项目详情加载失败',
      });
    }
  },

  loadProjectMap: async projectCode => {
    try {
      const response = await fetchDomainProjectMap(projectCode, {
        date: get().currentDate || undefined,
      });

      if (get().selectedProjectCode !== projectCode) {
        return;
      }

      const normalizedWorkPoints = response.work_points
        .map(item => adaptDataHubWorkPoint(item as any))
        .filter(
          item => Number.isFinite(item.longitude) && Number.isFinite(item.latitude),
        );

      set(state => {
        const filteredData = computeFilteredData({
          normalizedData: state.normalizedData,
          filters: state.filters,
          selectedProjectCode: state.selectedProjectCode,
          selectedProjectMapNormalized: normalizedWorkPoints,
          selectedProjectStatus: state.selectedProjectStatus,
          projectStatusList: state.projectStatusList,
          projectListRaw: state.projectListRaw,
        });
        return {
          selectedProjectMap: response,
          selectedProjectMapNormalized: normalizedWorkPoints,
          filteredData,
          pageStatus: resolvePageStatus(state.normalizedData, filteredData),
        };
      });
    } catch (err) {
      if (get().selectedProjectCode !== projectCode) {
        return;
      }
      set({
        selectedProjectError:
          err instanceof Error ? err.message : '项目地图数据加载失败',
      });
    }
  },

  loadProjectLineSections: async projectCode => {
    set({
      lineSectionsLoading: true,
      lineSectionsError: null,
    });

    try {
      const response = await fetchDomainLineSections({
        project_code: projectCode,
        limit: 100,
        offset: 0,
      });

      if (get().selectedProjectCode !== projectCode) {
        return;
      }

      set({
        lineSections: response.line_sections,
        lineSectionsLoading: false,
        lineSectionsError: null,
      });
    } catch (err) {
      if (get().selectedProjectCode !== projectCode) {
        return;
      }
      set({
        lineSectionsLoading: false,
        lineSectionsError:
          err instanceof Error ? err.message : '区段列表加载失败',
      });
    }
  },

  selectLineSection: async lineSectionKey => {
    set({
      selectedLineSectionKey: lineSectionKey,
      selectedLineSectionLoading: true,
      selectedLineSectionError: null,
      selectedLineSection: null,
      selectedItem: null,
      selectedObject: null,
    });

    try {
      const response = await fetchDomainLineSectionDetail(lineSectionKey);

      if (get().selectedLineSectionKey !== lineSectionKey) {
        return;
      }

      set({
        selectedLineSection: response,
        selectedLineSectionLoading: false,
        selectedLineSectionError: null,
      });
    } catch (err) {
      if (get().selectedLineSectionKey !== lineSectionKey) {
        return;
      }
      set({
        selectedLineSectionLoading: false,
        selectedLineSectionError:
          err instanceof Error ? err.message : '区段详情加载失败',
      });
    }
  },

  clearSelectedLineSection: () =>
    set({
      selectedLineSectionKey: null,
      selectedLineSection: null,
      selectedLineSectionLoading: false,
      selectedLineSectionError: null,
    }),

  loadProjectStatus: async () => {
    set({
      projectStatusLoading: true,
      projectStatusError: null,
    });

    try {
      const response = await fetchDomainProjectStatus();
      set(state => {
        const filteredData = computeFilteredData({
          normalizedData: state.normalizedData,
          filters: state.filters,
          selectedProjectCode: state.selectedProjectCode,
          selectedProjectMapNormalized: state.selectedProjectMapNormalized,
          selectedProjectStatus: state.selectedProjectStatus,
          projectStatusList: response.items,
          projectListRaw: state.projectListRaw,
        });

        return {
          projectStatusList: response.items,
          projectStatusLoading: false,
          projectStatusError: null,
          projectList: filterProjectListByStatus(
            state.projectListRaw,
            state.selectedProjectStatus,
          ),
          selectedProject: state.selectedProject
            ? {
                ...state.selectedProject,
                status: resolveProjectStatus(
                  state.selectedProjectCode ?? '',
                  response.items,
                  state.projectListRaw,
                ),
              }
            : null,
          filteredData,
          pageStatus: resolvePageStatus(state.normalizedData, filteredData),
        };
      });
    } catch (err) {
      set({
        projectStatusLoading: false,
        projectStatusError:
          err instanceof Error ? err.message : '项目状态加载失败',
      });
    }
  },

  setSelectedProjectStatus: status =>
    set(state => {
      const filteredData = computeFilteredData({
        normalizedData: state.normalizedData,
        filters: state.filters,
        selectedProjectCode: state.selectedProjectCode,
        selectedProjectMapNormalized: state.selectedProjectMapNormalized,
        selectedProjectStatus: status,
        projectStatusList: state.projectStatusList,
        projectListRaw: state.projectListRaw,
      });
      return {
        selectedProjectStatus: status,
        projectList: filterProjectListByStatus(state.projectListRaw, status),
        filteredData,
        pageStatus: resolvePageStatus(state.normalizedData, filteredData),
      };
    }),
}));
