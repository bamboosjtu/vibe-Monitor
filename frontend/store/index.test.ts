import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './index';
import type { RawDataResponse, DataParseStats } from '@/types';

describe('App Store', () => {
  beforeEach(() => {
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
    });
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
});
