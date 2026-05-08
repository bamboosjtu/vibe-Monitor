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
  adaptMapSummary,
  fetchDataHubDates,
  fetchDataHubMapSummary,
  fetchMonitorBackendDates,
  fetchMonitorBackendMapSummary,
  getApiConfig,
  getMapSummary,
  setDataSource as setApiDataSource,
} from '@/api';
import type { DataSourceMode } from '@/api/config';

export interface AppState {
  // 页面状态
  pageStatus: PageStatus;
  setPageStatus: (status: PageStatus) => void;
  
  // 错误信息
  error: string | null;
  setError: (error: string | null) => void;
  
  // 数据层
  rawData: RawDataResponse | null;
  setRawData: (data: RawDataResponse | null) => void;
  
  normalizedData: NormalizedStationMeeting[];
  setNormalizedData: (data: NormalizedStationMeeting[]) => void;
  
  filteredData: NormalizedStationMeeting[];
  
  parseStats: DataParseStats | null;
  setParseStats: (stats: DataParseStats | null) => void;
  
  // 筛选状态
  filters: FilterState;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  
  // 选中项状态
  selectedItem: NormalizedStationMeeting | null;
  setSelectedItem: (item: NormalizedStationMeeting | null) => void;
  clearSelectedItem: () => void;
  
  // M1R2: 统一详情对象（支持 Tower/Station/WorkPoint，已移除 Line）
  selectedObject: { type: 'tower' | 'station' | 'workPoint'; data: any } | null;
  setSelectedObject: (obj: { type: 'tower' | 'station' | 'workPoint'; data: any } | null) => void;
  clearSelectedObject: () => void;
  
  // ========== 时间轴相关状态 (MVP 第二轮新增) ==========
  // 当前日期
  currentDate: string | null;
  setCurrentDate: (date: string) => void;
  
  // 可用日期列表
  availableDates: string[];
  setAvailableDates: (dates: string[]) => void;
  
  // 时间轴播放状态
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  
  // 播放速度（天/秒）
  playSpeed: number;
  setPlaySpeed: (speed: number) => void;
  
  // 数据加载流程
  startLoading: () => void;
  loadSuccess: (params: {
    rawData: RawDataResponse;
    normalizedData: NormalizedStationMeeting[];
    stats: DataParseStats;
    date?: string;
  }) => void;
  loadError: (error: string, preserveData?: boolean) => void;
  resetData: () => void;
  
  // 按日期加载数据
  loadDataByDate: (date: string, isInitialLoad?: boolean) => Promise<void>;
  
  // ========== M0: API 数据源支持 ==========
  // API 数据加载（从后端 API 获取）
  loadFromApi: () => Promise<void>;
  // DataHub 数据加载（从 DataHub sandbox API 获取）
  loadFromDataHub: () => Promise<void>;
  // 数据源类型
  dataSource: DataSourceMode;
  setDataSource: (source: DataSourceMode) => void;
  
  // ========== M1R2: 图层显隐控制（已移除 line）==========
  layerVisibility: {
    tower: boolean;
    workPoint: boolean;
    station: boolean;
  };
  setLayerVisibility: (layer: keyof AppState['layerVisibility'], visible: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  pageStatus: 'idle',
  setPageStatus: (status) => set({ pageStatus: status }),
  
  error: null,
  setError: (error) => set({ error }),
  
  rawData: null,
  setRawData: (data) => set({ rawData: data }),
  
  normalizedData: [],
  setNormalizedData: (data) => {
    const { filters } = get();
    const filteredData = applyFilters(data, filters);
    set({ 
      normalizedData: data, 
      filteredData,
      pageStatus: filteredData.length === 0 ? 'empty' : 'ready',
    });
  },
  
  filteredData: [],
  
  parseStats: null,
  setParseStats: (stats) => set({ parseStats: stats }),
  
  filters: DEFAULT_FILTER_STATE,
  setFilters: (newFilters) => {
    const { normalizedData, filters, selectedItem } = get();
    const updatedFilters = { ...filters, ...newFilters };
    const filteredData = applyFilters(normalizedData, updatedFilters);
    
    // 检查选中项是否仍在筛选结果中
    const selectedStillVisible = selectedItem 
      ? filteredData.some(item => item.id === selectedItem.id)
      : false;
    
    set({
      filters: updatedFilters,
      filteredData,
      pageStatus: filteredData.length === 0 ? 'filtered_empty' : 'ready',
      selectedItem: selectedStillVisible ? selectedItem : null,
    });
  },
  resetFilters: () => {
    const { normalizedData } = get();
    set({
      filters: DEFAULT_FILTER_STATE,
      filteredData: normalizedData,
      pageStatus: normalizedData.length === 0 ? 'empty' : 'ready',
    });
  },
  
  selectedItem: null,
  setSelectedItem: (item) => set({ selectedItem: item }),
  clearSelectedItem: () => set({ selectedItem: null }),
  
  // M1 Round2: 统一详情对象
  selectedObject: null,
  setSelectedObject: (obj) => set({ selectedObject: obj }),
  clearSelectedObject: () => set({ selectedObject: null }),
  
  // ========== 时间轴相关状态实现 ==========
  currentDate: null,
  setCurrentDate: (date) => set({ currentDate: date }),
  
  availableDates: [],
  setAvailableDates: (dates) => set({ availableDates: dates }),
  
  isPlaying: false,
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  
  playSpeed: 1,
  setPlaySpeed: (speed) => set({ playSpeed: speed }),
  
  startLoading: () => set({ 
    pageStatus: 'loading', 
    error: null 
  }),
  
  loadSuccess: ({ rawData, normalizedData, stats, date }) => {
    const { filters, selectedItem } = get();
    const filteredData = applyFilters(normalizedData, filters);
    const pageStatus = filteredData.length === 0 
      ? (normalizedData.length === 0 ? 'empty' : 'filtered_empty') 
      : 'ready';
    
    // 检查选中项是否在新日期的数据中仍然存在
    const selectedStillExists = selectedItem 
      ? normalizedData.some(item => item.id === selectedItem.id)
      : false;
    
    set({
      pageStatus,
      rawData,
      normalizedData,
      filteredData,
      parseStats: stats,
      currentDate: date || get().currentDate,
      // 若选中项在新日期不存在，则清空选中态
      selectedItem: selectedStillExists ? selectedItem : null,
      error: null,
    });
  },
  
  loadError: (errorMessage, preserveData = false) => {
    if (preserveData) {
      // 保留当前数据，仅显示错误（用于日期切换失败场景）
      set({
        pageStatus: 'ready', // 保持 ready 状态，让用户可以继续操作
        error: errorMessage, // 显示错误信息
      });
    } else {
      // 完全重置（用于初始加载失败场景）
      set({
        pageStatus: 'error',
        error: errorMessage,
        rawData: null,
        normalizedData: [],
        filteredData: [],
        parseStats: null,
        selectedItem: null,
      });
    }
  },
  
  resetData: () => set({
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
  }),
  
  // 按日期加载数据
  loadDataByDate: async (date: string, isInitialLoad = false) => {
    const { dataSource, loadSuccess, loadError } = get();

    // 日期切换时不再设置全局 loading 状态，避免触发整页重渲染
    // 改为在 Timeline 组件中通过 isLoading 状态显示局部 loading
    // 保持 pageStatus 为 'ready'，确保 UI 骨架不闪

    try {
      if (dataSource === 'datahub' || dataSource === 'monitor_backend') {
        const remoteSummary = dataSource === 'monitor_backend'
          ? await fetchMonitorBackendMapSummary(date)
          : await fetchDataHubMapSummary(date);
        const normalizedData = adaptDataHubMapSummary(remoteSummary);

        loadSuccess({
          rawData: null as any,
          normalizedData,
          stats: {
            totalRawRecords: remoteSummary.work_points.length,
            validCoordinateRecords: normalizedData.length,
            filteredRecords: remoteSummary.work_points.length - normalizedData.length,
            filterReasons: {
              emptyCoordinates: 0,
              invalidCoordinates: remoteSummary.work_points.length - normalizedData.length,
              outOfBounds: 0,
              zeroCoordinates: 0,
            },
          },
          date: remoteSummary.meta.date ?? date,
        });
        return;
      }

      // 动态导入避免循环依赖
      const { loadAndParseByDate } = await import('@/lib/dateDataLoader');
      const result = await loadAndParseByDate(date);

      loadSuccess({
        rawData: result.rawData,
        normalizedData: result.normalizedData,
        stats: result.stats,
        date: result.date,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      // 如果是初始加载失败，完全重置；如果是日期切换失败，保留当前数据
      loadError(errorMessage, !isInitialLoad);
      console.error('[Date Load Error]', err);
    }
  },
  
  // ========== API 数据源支持 ==========
  dataSource: getApiConfig().source,
  setDataSource: (source) => {
    setApiDataSource(source);
    set({ dataSource: source });
  },
  
  loadFromApi: async () => {
    const { loadSuccess, loadError, startLoading, setAvailableDates, setCurrentDate } = get();
    
    startLoading();
    
    try {
      // M1R2: 同时加载日期清单和地图数据
      const [{ loadDateManifest }, summary] = await Promise.all([
        import('@/lib/dateDataLoader'),
        getMapSummary(),
      ]);
      
      // 加载日期清单
      const manifest = await loadDateManifest();
      setAvailableDates(manifest.dates);
      
      // 使用最新日期作为当前日期
      const latestDate = manifest.dates[manifest.dates.length - 1] || null;
      if (latestDate) {
        setCurrentDate(latestDate);
      }
      
      // 转换为前端数据格式
      const normalizedData = adaptMapSummary(summary.data);
      
      // 调用 loadSuccess 更新 store
      loadSuccess({
        rawData: null as any, // API 模式无原始数据
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
      const remoteDates =
        get().dataSource === 'monitor_backend'
          ? await fetchMonitorBackendDates()
          : await fetchDataHubDates();
      const remoteSummaryFetcher =
        get().dataSource === 'monitor_backend'
          ? fetchMonitorBackendMapSummary
          : fetchDataHubMapSummary;
      const dates = [...remoteDates.dates].sort();
      setAvailableDates(dates);

      const selectedDate = remoteDates.latest_date ?? dates[dates.length - 1] ?? null;
      if (selectedDate) {
        setCurrentDate(selectedDate);
      }

      const summary = await remoteSummaryFetcher(selectedDate ?? undefined);
      const normalizedData = adaptDataHubMapSummary(summary);

      loadSuccess({
        rawData: null as any,
        normalizedData,
        stats: {
          totalRawRecords: summary.work_points.length,
          validCoordinateRecords: normalizedData.length,
          filteredRecords: summary.work_points.length - normalizedData.length,
          filterReasons: {
            emptyCoordinates: 0,
            invalidCoordinates: summary.work_points.length - normalizedData.length,
            outOfBounds: 0,
            zeroCoordinates: 0,
          },
        },
        date: summary.meta.date ?? selectedDate ?? undefined,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'DataHub 数据加载失败';
      loadError(errorMessage);
      console.error('[DataHub Load Error]', err);
    }
  },
  
  // ========== M1R2: 图层显隐控制（已移除 line）==========
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
}));
