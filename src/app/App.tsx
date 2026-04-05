import { FilterPanel } from '@/features/filter/FilterPanel';
import { MapContainer } from '@/features/map/MapContainer';
import { DetailPanel } from '@/features/detail/DetailPanel';
import { StatsPanel } from '@/features/stats/StatsPanel';
import { useDataLoader } from '@/lib/useDataLoader';
import { useAppStore } from '@/store';

function App() {
  const { pageStatus } = useDataLoader();
  const { error } = useAppStore();

  // 渲染页面状态
  const renderPageState = () => {
    switch (pageStatus) {
      case 'idle':
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm">准备加载数据...</p>
            </div>
          </div>
        );

      case 'loading':
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm">正在加载数据...</p>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-red-500">
              <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium">数据加载失败</p>
              <p className="text-xs text-red-400 mt-1">{error || '请检查数据文件是否存在'}</p>
            </div>
          </div>
        );

      case 'empty':
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-sm">暂无有效数据</p>
              <p className="text-xs text-gray-300 mt-1">所有记录坐标均不合法</p>
            </div>
          </div>
        );

      case 'filtered_empty':
        return (
          <>
            {/* 左侧筛选面板 */}
            <aside className="w-64 flex-none">
              <FilterPanel />
            </aside>

            {/* 中央地图区域 - 筛选为空提示 */}
            <main className="flex-1 min-h-0 relative">
              <MapContainer />
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 pointer-events-none">
                <div className="text-center text-gray-400 pointer-events-auto">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="text-sm">筛选无结果</p>
                  <p className="text-xs text-gray-300 mt-1">请调整筛选条件</p>
                </div>
              </div>
            </main>

            {/* 右侧详情面板 */}
            <aside className="w-80 flex-none">
              <DetailPanel />
            </aside>
          </>
        );

      case 'ready':
        return (
          <>
            {/* 左侧筛选面板 */}
            <aside className="w-64 flex-none">
              <FilterPanel />
            </aside>

            {/* 中央地图区域 */}
            <main className="flex-1 min-h-0">
              <MapContainer />
            </main>

            {/* 右侧详情面板 */}
            <aside className="w-80 flex-none">
              <DetailPanel />
            </aside>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full h-screen bg-gray-50 flex flex-col p-4 gap-4">
      {/* 顶部标题 */}
      <header className="flex-none text-center py-2">
        <h1 className="text-2xl font-bold text-gray-800">
          输变电工程数字沙盘系统
        </h1>
        <p className="text-xs text-gray-500 mt-1">当前作业态势监控</p>
      </header>

      {/* 主体内容区 */}
      <div className="flex-1 flex gap-4 min-h-0">
        {renderPageState()}
      </div>

      {/* 底部统计面板 - 在 ready 或 filtered_empty 时显示 */}
      {(pageStatus === 'ready' || pageStatus === 'filtered_empty') && (
        <footer className="h-[360px] flex-none">
          <StatsPanel />
        </footer>
      )}
    </div>
  );
}

export default App;
