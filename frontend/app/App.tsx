import { FilterPanel } from '@/features/filter/FilterPanel';
import { MapContainer } from '@/features/map/MapContainer';
import { DetailPanel } from '@/features/detail/DetailPanel';
import { StatsPanel } from '@/features/stats/StatsPanel';
import { Timeline } from '@/features/timeline/Timeline';
import { useDataLoader } from '@/lib/useDataLoader';
import { useAppStore } from '@/store';

function App() {
  const { pageStatus, isInitialLoading } = useDataLoader();
  const { error } = useAppStore();

  // 首屏初始化 loading 状态 - 显示全屏 loading
  if (pageStatus === 'idle' || (pageStatus === 'loading' && isInitialLoading)) {
    return (
      <div className="w-full h-screen bg-gray-50 flex flex-col p-4 gap-4">
        {/* 顶部标题 */}
        <header className="flex-none flex items-center justify-center py-2">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800">
              输变电工程数字沙盘系统
            </h1>
            <p className="text-xs text-gray-500 mt-1">当前作业态势监控</p>
          </div>
        </header>

        {/* 全屏 loading */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">{pageStatus === 'idle' ? '准备加载数据...' : '正在加载数据...'}</p>
          </div>
        </div>
      </div>
    );
  }

  // 首屏初始化错误状态
  if (pageStatus === 'error' && isInitialLoading) {
    return (
      <div className="w-full h-screen bg-gray-50 flex flex-col p-4 gap-4">
        {/* 顶部标题 */}
        <header className="flex-none flex items-center justify-center py-2">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800">
              输变电工程数字沙盘系统
            </h1>
            <p className="text-xs text-gray-500 mt-1">当前作业态势监控</p>
          </div>
        </header>

        {/* 全屏错误 */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-red-500">
            <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium">数据加载失败</p>
            <p className="text-xs text-red-400 mt-1">{error || '请检查数据文件是否存在'}</p>
          </div>
        </div>
      </div>
    );
  }

  // 正常状态：ready / filtered_empty / empty
  // 这些状态保持 UI 骨架不动，只更新内容和显示局部遮罩
  // 注意：日期切换时 pageStatus 保持 'ready'，不再变为 'loading'，避免整页重渲染
  const isEmpty = pageStatus === 'empty';
  const isFilteredEmpty = pageStatus === 'filtered_empty';

  return (
    <div className="w-full h-screen bg-gray-50 flex flex-col p-4 gap-4">
      {/* 顶部标题 + 时间轴 */}
      <header className="flex-none flex items-center justify-between py-2">
        <div className="flex-1" />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">
            输变电工程数字沙盘系统
          </h1>
          <p className="text-xs text-gray-500 mt-1">当前作业态势监控</p>
        </div>
        <div className="flex-1 flex justify-end">
          <Timeline />
        </div>
      </header>

      {/* 主体内容区 - 始终保持渲染，不受状态变化影响 */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* 左侧筛选面板 */}
        <aside className="w-64 flex-none">
          <FilterPanel />
        </aside>

        {/* 中央地图区域 */}
        <main className="flex-1 min-h-0 relative">
          <MapContainer />
          
          {/* 空数据提示覆盖层 */}
          {isEmpty && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 pointer-events-none z-10">
              <div className="text-center text-gray-400 pointer-events-auto">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="text-sm">暂无有效数据</p>
                <p className="text-xs text-gray-300 mt-1">所有记录坐标均不合法</p>
              </div>
            </div>
          )}

          {/* 筛选为空提示覆盖层 */}
          {isFilteredEmpty && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 pointer-events-none z-10">
              <div className="text-center text-gray-400 pointer-events-auto">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-sm">筛选无结果</p>
                <p className="text-xs text-gray-300 mt-1">请调整筛选条件</p>
              </div>
            </div>
          )}


        </main>

        {/* 右侧详情面板 */}
        <aside className="w-80 flex-none">
          <DetailPanel />
        </aside>
      </div>

      {/* 底部统计面板 */}
      <footer className="h-[360px] flex-none">
        <StatsPanel />
      </footer>
    </div>
  );
}

export default App;
