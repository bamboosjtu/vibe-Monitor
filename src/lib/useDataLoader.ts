import { useEffect } from 'react';
import { useAppStore } from '@/store';
import { loadDataFile, parseAndNormalizeData } from './dataParser';

const DATA_URL = '/data/20260401.json';

export function useDataLoader() {
  const { 
    pageStatus, 
    startLoading, 
    loadSuccess, 
    loadError 
  } = useAppStore();

  useEffect(() => {
    // 只在初始状态时加载数据
    if (pageStatus !== 'idle') {
      return;
    }

    const loadData = async () => {
      startLoading();

      try {
        // 1. 加载原始数据
        const rawData = await loadDataFile(DATA_URL);

        // 2. 清洗归一化
        const { records, stats } = parseAndNormalizeData(rawData);

        // 3. 更新状态
        loadSuccess({
          rawData,
          normalizedData: records,
          stats,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '未知错误';
        loadError(errorMessage);
        console.error('[Data Load Error]', err);
      }
    };

    loadData();
  }, [pageStatus, startLoading, loadSuccess, loadError]);

  return { pageStatus };
}
