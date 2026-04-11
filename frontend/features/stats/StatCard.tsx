import { getChangeColorClass } from '@/lib/stats';
import { InfoTooltip } from './InfoTooltip';

interface TooltipInfo {
  calculationPeriod: string;
  noWorkDates: string;
}

interface StatCardProps {
  title: string;
  value: number;
  trendRef: React.RefObject<HTMLDivElement>;
  prevDayChange: number;
  prevDayRate: number;
  monthChange: number;
  monthRate: number;
  hasPrevDay: boolean;
  hasMonthData: boolean;
  isLoading: boolean;
  hasWork: boolean;
  tooltipInfo: TooltipInfo;
}

export function StatCard({
  title,
  value,
  trendRef,
  prevDayChange,
  prevDayRate,
  monthChange,
  monthRate,
  hasPrevDay,
  hasMonthData,
  isLoading,
  hasWork,
  tooltipInfo,
}: StatCardProps) {

  // 格式化数值（取整）
  const formatNumber = (val: number): string => Math.round(val).toString();

  // 格式化变化值（绝对值取整，百分比 1 位小数）
  const formatChangeValue = (val: number, rate: number): string => {
    const sign = val > 0 ? '+' : val < 0 ? '' : '';
    const absValue = Math.abs(Math.round(val));
    const ratePercent = (rate * 100).toFixed(1);
    return `${sign}${absValue}（${sign}${ratePercent}%）`;
  };

  // 趋势图更新逻辑已移到父组件 StatsPanel 中统一处理
  // 这里只负责渲染容器

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm flex flex-col h-full">
      {/* 顶部：标题 + ? - 固定高度 */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <span className="text-xs text-gray-500 font-medium">{title}</span>
        <InfoTooltip title={title} tooltipInfo={tooltipInfo} />
      </div>

      {/* 主内容区：左信息块 + 右趋势图，整体垂直居中 */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        {/* 左右两块组成一个整体组 */}
        <div className="flex items-center gap-8">
          {/* 左侧信息块：主数字 + 变化信息 - 统一左对齐 */}
          <div className="flex flex-col items-start">
            {/* 主数字 */}
            <span className="text-5xl font-bold text-gray-800 tracking-tight leading-none mb-3">
              {formatNumber(value)}
            </span>
            {/* 变化信息 - 左对齐 */}
            <div className="space-y-1.5">
              {isLoading ? (
                <div className="text-xs text-gray-400">加载中...</div>
              ) : hasWork ? (
                <>
                  {/* 较上日 */}
                  {hasPrevDay ? (
                    <div className={`flex items-center text-xs ${getChangeColorClass(prevDayChange)}`}>
                      <span className="text-gray-500 w-10 shrink-0">较上日</span>
                      <span className="font-medium">{formatChangeValue(prevDayChange, prevDayRate)}</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-xs text-gray-400">
                      <span className="w-10 shrink-0">较上日</span>
                      <span>首个作业日</span>
                    </div>
                  )}
                  {/* 较上月 */}
                  {hasMonthData ? (
                    <div className={`flex items-center text-xs ${getChangeColorClass(monthChange)}`}>
                      <span className="text-gray-500 w-10 shrink-0">较上月</span>
                      <span className="font-medium">{formatChangeValue(monthChange, monthRate)}</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-xs text-gray-400">
                      <span className="w-10 shrink-0">较上月</span>
                      <span>历史数据不足</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs text-gray-400">今日无作业</div>
              )}
            </div>
          </div>

          {/* 右侧趋势图 - 独立图形块，右对齐 */}
          <div 
            ref={trendRef} 
            className="flex-shrink-0"
            style={{ width: '192px', height: '56px' }}
          />
        </div>
      </div>
    </div>
  );
}
