interface TooltipInfo {
  calculationPeriod: string;
  noWorkDates: string;
}

interface InfoTooltipProps {
  title: string;
  tooltipInfo: TooltipInfo;
}

export function InfoTooltip({ title, tooltipInfo }: InfoTooltipProps) {
  return (
    <div className="group relative inline-flex items-center justify-center w-4 h-4 ml-1 cursor-help">
      <span className="text-[10px] text-gray-400 border border-gray-300 rounded-full w-4 h-4 flex items-center justify-center hover:text-gray-600 hover:border-gray-400 transition-colors">
        ?
      </span>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <div className="text-xs text-gray-600 space-y-1">
          <div className="font-medium text-gray-800 mb-2">{title}</div>
          <div>较上日：较上一作业日</div>
          <div>较上月：较前 30 作业日均值</div>
          {tooltipInfo.calculationPeriod && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="text-gray-500">计算时间段：{tooltipInfo.calculationPeriod}</div>
            </div>
          )}
          <div className="mt-1">
            <div className="text-gray-500">无作业日期：{tooltipInfo.noWorkDates || '无'}</div>
          </div>
        </div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-white"></div>
      </div>
    </div>
  );
}
