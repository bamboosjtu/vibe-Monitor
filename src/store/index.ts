import { create } from 'zustand';
import type { 
  PageStatus, 
  RawDataResponse, 
  NormalizedStationMeeting, 
  DataParseStats,
  FilterState,
} from '@/types';
import { applyFilters, DEFAULT_FILTER_STATE } from '@/lib/filter';

interface AppState {
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
  
  // 数据加载流程
  startLoading: () => void;
  loadSuccess: (params: {
    rawData: RawDataResponse;
    normalizedData: NormalizedStationMeeting[];
    stats: DataParseStats;
  }) => void;
  loadError: (error: string) => void;
  resetData: () => void;
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
  
  startLoading: () => set({ 
    pageStatus: 'loading', 
    error: null 
  }),
  
  loadSuccess: ({ rawData, normalizedData, stats }) => {
    const { filters } = get();
    const filteredData = applyFilters(normalizedData, filters);
    const pageStatus = filteredData.length === 0 
      ? (normalizedData.length === 0 ? 'empty' : 'filtered_empty') 
      : 'ready';
    
    set({
      pageStatus,
      rawData,
      normalizedData,
      filteredData,
      parseStats: stats,
      error: null,
    });
  },
  
  loadError: (errorMessage) => set({
    pageStatus: 'error',
    error: errorMessage,
    rawData: null,
    normalizedData: [],
    filteredData: [],
    parseStats: null,
    selectedItem: null,
  }),
  
  resetData: () => set({
    pageStatus: 'idle',
    error: null,
    rawData: null,
    normalizedData: [],
    filteredData: [],
    parseStats: null,
    filters: DEFAULT_FILTER_STATE,
    selectedItem: null,
  }),
}));
