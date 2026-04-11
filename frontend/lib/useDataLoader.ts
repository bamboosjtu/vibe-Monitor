import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store';
import { loadAndParseByDate, loadDateManifest, getLatestDate } from './dateDataLoader';

/**
 * 数据加载 Hook
 * 
 * MVP 第二轮更新：
 * - 支持按日期加载数据
 * - 从 index.json 动态加载可用日期列表
 * - 默认加载最新日期（而非第一个日期）
 * - 与 time轴状态联动
 * - 区分首屏初始化和日期切换加载
 * 
 * M0-lite 更新：
 * - 支持 API 数据源切换（mock/api/local）
 * - 默认仍为 local 模式（不破坏现有页面）
 */
export function useDataLoader() {
  const { 
    pageStatus, 
    startLoading, 
    loadSuccess, 
    loadError,
    availableDates,
    setAvailableDates,
    currentDate,
    setCurrentDate,
    dataSource,
    loadFromApi,
  } = useAppStore();

  // 用于区分首屏初始化和日期切换
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const hasInitialized = useRef(false);

  // 初始加载：根据数据源决定加载方式
  useEffect(() => {
    // 只在初始状态时加载数据
    if (pageStatus !== 'idle') {
      return;
    }

    // 防止重复初始化
    if (hasInitialized.current) {
      return;
    }
    hasInitialized.current = true;

    const loadInitialData = async () => {
      setIsInitialLoading(true);
      startLoading();

      try {
        // M0: 根据数据源决定加载方式
        if (dataSource === 'api') {
          // 从 API 加载数据
          await loadFromApi();
          setIsInitialLoading(false);
          return;
        }

        // local 模式（默认）：从本地 JSON 加载
        const manifest = await loadDateManifest();
        const dates = manifest.dates;
        
        setAvailableDates(dates);

        if (dates.length === 0) {
          throw new Error('日期清单为空，没有可用的数据日期');
        }

        // 默认加载最新日期（而非第一个日期）
        const latestDate = getLatestDate(dates);
        if (!latestDate) {
          throw new Error('无法确定最新日期');
        }
        
        const result = await loadAndParseByDate(latestDate);
        
        setCurrentDate(latestDate);
        loadSuccess({
          rawData: result.rawData,
          normalizedData: result.normalizedData,
          stats: result.stats,
          date: result.date,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '未知错误';
        loadError(errorMessage);
        console.error('[Data Load Error]', err);
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadInitialData();
  }, [pageStatus, startLoading, loadSuccess, loadError, setAvailableDates, setCurrentDate, dataSource, loadFromApi]);

  return { 
    pageStatus,
    isInitialLoading,
    currentDate,
    availableDates,
  };
}
