import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/store';
import { getNextDate, getPrevDate } from '@/lib/dateDataLoader';

/**
 * 格式化日期用于下拉框显示
 * YYYY-MM-DD -> YYYY年MM月DD日
 */
function formatDateForSelect(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${year}年${month}月${day}日`;
}

/**
 * 时间轴组件
 * 
 * 本轮实现：
 * - 展示当前日期
 * - 上一天 / 下一天按钮（带边界禁用和提示）
 * - 播放 / 暂停按钮（按天自动轮播）
 * - 日期切换时触发数据加载
 * - 错误提示和重试入口
 * 
 * 播放控制：
 * - 使用 setInterval 按日期顺序自动推进
 * - 默认播放速度：1 天/秒（1000ms）
 * - 播放到最后一天自动停止
 * - 播放过程中遵守 loading / error / 边界控制
 * 
 * 本轮不做：
 * - 拖拽时间轴
 * - 按小时切片
 * - 复杂动画
 */

// 播放速度配置（毫秒/天）
const PLAY_SPEED_MS = 1000;

export function Timeline() {
  const {
    currentDate,
    availableDates,
    loadDataByDate,
    error,
    setError,
  } = useAppStore();

  // 播放状态
  const [isPlaying, setIsPlaying] = useState(false);

  // 本地 loading 状态，用于日期切换时显示局部 loading
  // 不再依赖 pageStatus，避免触发整页重渲染
  const [isLoading, setIsLoading] = useState(false);

  // 用于显示边界提示
  const [showBoundaryTip, setShowBoundaryTip] = useState<'prev' | 'next' | null>(null);

  // 使用 ref 存储 interval ID，便于清理
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 检查是否可以切换日期
  const canGoPrev = currentDate && getPrevDate(currentDate, availableDates) !== null;
  const canGoNext = currentDate && getNextDate(currentDate, availableDates) !== null;
  const hasError = error !== null;

  // 清理播放定时器
  const clearPlayInterval = useCallback(() => {
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
  }, []);

  // 停止播放
  const stopPlaying = useCallback(() => {
    setIsPlaying(false);
    clearPlayInterval();
  }, [clearPlayInterval]);

  // 播放到下一天
  const playNextDay = useCallback(async () => {
    if (!currentDate || isLoading) return;
    
    const nextDate = getNextDate(currentDate, availableDates);
    
    if (nextDate) {
      // 有下一天，继续播放
      await loadDataByDate(nextDate, false);
    } else {
      // 已到最后一天，停止播放
      stopPlaying();
    }
  }, [currentDate, availableDates, isLoading, loadDataByDate, stopPlaying]);

  // 播放控制效果
  useEffect(() => {
    if (isPlaying) {
      // 立即播放第一帧（当前日期的下一天）
      playNextDay();
      
      // 设置定时器，按速度自动推进
      playIntervalRef.current = setInterval(() => {
        playNextDay();
      }, PLAY_SPEED_MS);
    } else {
      // 停止播放时清理定时器
      clearPlayInterval();
    }

    // 组件卸载时清理定时器
    return () => {
      clearPlayInterval();
    };
  }, [isPlaying, playNextDay, clearPlayInterval]);

  // 处理播放过程中的错误
  useEffect(() => {
    if (hasError && isPlaying) {
      // 日期切换失败时自动停止播放
      stopPlaying();
    }
  }, [hasError, isPlaying, stopPlaying]);

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 当焦点位于输入框、下拉框、可编辑控件时，不拦截方向键
      const target = e.target as HTMLElement;
      const isInputFocused = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || target.isContentEditable;

      if (isInputFocused) {
        return;
      }

      // 左方向键：上一天
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (canGoPrev && !isLoading && !isPlaying) {
          handlePrevDay();
        }
      }

      // 右方向键：下一天
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (canGoNext && !isLoading && !isPlaying) {
          handleNextDay();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canGoPrev, canGoNext, isLoading, isPlaying]);

  // 切换到上一天
  const handlePrevDay = async () => {
    if (!currentDate || isLoading) return;

    const prevDate = getPrevDate(currentDate, availableDates);
    if (prevDate) {
      setShowBoundaryTip(null);
      setIsLoading(true);
      try {
        await loadDataByDate(prevDate, false);
      } finally {
        setIsLoading(false);
      }
    } else {
      // 显示边界提示
      setShowBoundaryTip('prev');
      setTimeout(() => setShowBoundaryTip(null), 2000);
    }
  };

  // 切换到下一天
  const handleNextDay = async () => {
    if (!currentDate || isLoading) return;

    const nextDate = getNextDate(currentDate, availableDates);
    if (nextDate) {
      setShowBoundaryTip(null);
      setIsLoading(true);
      try {
        await loadDataByDate(nextDate, false);
      } finally {
        setIsLoading(false);
      }
    } else {
      // 显示边界提示
      setShowBoundaryTip('next');
      setTimeout(() => setShowBoundaryTip(null), 2000);
    }
  };

  // 切换播放状态
  const togglePlay = () => {
    if (isLoading) return;
    
    if (isPlaying) {
      // 暂停
      stopPlaying();
    } else {
      // 开始播放
      // 如果当前已是最后一天，无法播放
      if (!canGoNext) {
        setShowBoundaryTip('next');
        setTimeout(() => setShowBoundaryTip(null), 2000);
        return;
      }
      setIsPlaying(true);
    }
  };

  // 重试加载当前日期
  const handleRetry = async () => {
    if (!currentDate || isLoading) return;
    setError(null);
    setIsLoading(true);
    try {
      await loadDataByDate(currentDate, false);
    } finally {
      setIsLoading(false);
    }
  };

  // 计算当前日期在列表中的位置
  const currentIndex = currentDate ? availableDates.indexOf(currentDate) : -1;
  const totalDates = availableDates.length;

  // 处理日期选择
  const handleDateSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedDate = e.target.value;
    if (selectedDate && selectedDate !== currentDate && !isLoading) {
      setIsLoading(true);
      try {
        await loadDataByDate(selectedDate, false);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col items-end">
      {/* 主控制栏 - 固定高度，不受错误提示影响 */}
      <div className="flex items-center gap-3 bg-white rounded-lg px-4 py-2 shadow-sm border border-gray-200 h-[52px]">
        {/* 日期选择下拉框 */}
        <div className="relative">
          <select
            value={currentDate || ''}
            onChange={handleDateSelect}
            disabled={isLoading || isPlaying}
            className={`
              appearance-none px-3 py-1.5 pr-8 rounded text-sm font-medium transition-colors min-w-[140px]
              border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              ${!isLoading && !isPlaying
                ? 'bg-white text-gray-700 hover:border-gray-400 cursor-pointer'
                : 'bg-gray-50 text-gray-400 cursor-not-allowed'
              }
            `}
            title="选择日期"
          >
            {availableDates.map((date) => (
              <option key={date} value={date}>
                {formatDateForSelect(date)}
              </option>
            ))}
          </select>
          {/* 下拉箭头 */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* 分隔线 */}
        <div className="w-px h-6 bg-gray-200" />

        {/* 上一天按钮 */}
        <div className="relative">
          <button
            onClick={handlePrevDay}
            disabled={!canGoPrev || isLoading || isPlaying}
            className={`
              flex items-center gap-1 px-2 py-1.5 rounded text-sm font-medium transition-colors min-w-[72px] justify-center
              ${canGoPrev && !isLoading && !isPlaying
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                : 'bg-gray-50 text-gray-400 cursor-not-allowed'
              }
            `}
            title={canGoPrev ? '切换到上一天' : '已是第一天'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            上一天
          </button>

          {/* 边界提示 - 绝对定位，不占用文档流 */}
          {showBoundaryTip === 'prev' && (
            <div className="absolute top-full left-0 mt-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-50">
              已是第一天
            </div>
          )}
        </div>

        {/* 播放/暂停按钮 - 固定宽度 */}
        <button
          onClick={togglePlay}
          disabled={isLoading}
          className={`
            flex items-center gap-1 px-2 py-1.5 rounded text-sm font-medium transition-colors min-w-[72px] justify-center
            ${isPlaying
              ? 'bg-amber-100 hover:bg-amber-200 text-amber-700'
              : canGoNext && !isLoading
                ? 'bg-green-100 hover:bg-green-200 text-green-700'
                : 'bg-gray-50 text-gray-400 cursor-not-allowed'
            }
          `}
          title={isPlaying ? '暂停播放' : canGoNext ? '开始播放' : '已是最后一天，无法播放'}
        >
          {isPlaying ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              暂停
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              播放
            </>
          )}
        </button>

        {/* 下一天按钮 */}
        <div className="relative">
          <button
            onClick={handleNextDay}
            disabled={!canGoNext || isLoading || isPlaying}
            className={`
              flex items-center gap-1 px-2 py-1.5 rounded text-sm font-medium transition-colors min-w-[72px] justify-center
              ${canGoNext && !isLoading && !isPlaying
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                : 'bg-gray-50 text-gray-400 cursor-not-allowed'
              }
            `}
            title={canGoNext ? '切换到下一天' : '已是最后一天'}
          >
            下一天
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* 边界提示 - 绝对定位，不占用文档流 */}
          {showBoundaryTip === 'next' && (
            <div className="absolute top-full right-0 mt-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-50">
              已是最后一天
            </div>
          )}
        </div>

        {/* 分隔线 */}
        <div className="w-px h-6 bg-gray-200" />

        {/* 日期位置指示器 */}
        <div className="flex items-center gap-1 text-sm text-gray-500 tabular-nums min-w-[60px] justify-center">
          <span>{currentIndex >= 0 ? currentIndex + 1 : '--'}</span>
          <span>/</span>
          <span>{totalDates}</span>
        </div>

        {/* 加载状态指示器 - 固定宽度占位 */}
        <div className="w-[60px] flex items-center justify-center">
          {isLoading ? (
            <div className="flex items-center gap-1.5 text-sm text-blue-600">
              <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
              <span className="text-xs">加载</span>
            </div>
          ) : (
            // 占位元素，保持宽度一致
            <div className="w-4 h-4" />
          )}
        </div>
      </div>

      {/* 错误提示和重试入口 - 绝对定位浮层，不撑开布局 */}
      {hasError && (
        <div className="absolute top-full right-0 mt-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg shadow-lg z-50 flex items-center gap-3">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-red-600">{error}</span>
          <button
            onClick={handleRetry}
            disabled={isLoading}
            className="text-sm text-red-700 hover:text-red-800 font-medium underline disabled:opacity-50 whitespace-nowrap"
          >
            重试
          </button>
        </div>
      )}
    </div>
  );
}
