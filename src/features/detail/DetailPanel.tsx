import { RISK_COLORS } from '@/constants/layers';
import { useAppStore } from '@/store';
import type { RiskLevel, WorkStatus } from '@/types';

const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  working: '作业中',
  paused: '作业暂停',
  finished: '当日作业完工',
  unknown: '未知状态',
};

const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  1: '一级风险',
  2: '二级风险',
  3: '三级风险',
  4: '四级风险',
  unknown: '未知风险',
};

export function DetailPanel() {
  const { selectedItem, clearSelectedItem } = useAppStore();

  // 空值显示处理
  const formatValue = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined || value === '') {
      return '--';
    }
    return String(value);
  };

  if (!selectedItem) {
    return (
      <div className="panel p-4 h-full flex flex-col">
        <h2 className="panel-title">详情信息</h2>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <p className="text-sm text-gray-500">点击地图上的点位查看详情</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="panel-title mb-0">详情信息</h2>
        <button
          onClick={clearSelectedItem}
          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100"
        >
          关闭
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        {/* 工程名称 */}
        <div className="bg-gray-50 rounded p-3">
          <div className="text-xs text-gray-500 mb-1">工程名称</div>
          <div className="text-sm font-medium text-gray-800">
            {formatValue(selectedItem.projectName)}
          </div>
        </div>

        {/* 作业票信息 */}
        <div className="bg-gray-50 rounded p-3">
          <div className="text-xs text-gray-500 mb-1">作业票号</div>
          <div className="text-sm text-gray-800">
            {formatValue(selectedItem.ticketNo)}
          </div>
          <div className="text-xs text-gray-500 mt-2 mb-1">作业票名称</div>
          <div className="text-sm text-gray-800">
            {formatValue(selectedItem.ticketName)}
          </div>
        </div>

        {/* 风险等级 */}
        <div className="bg-gray-50 rounded p-3">
          <div className="text-xs text-gray-500 mb-1">风险等级</div>
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: RISK_COLORS[selectedItem.riskLevel] }}
            />
            <span className="text-sm font-medium text-gray-800">
              {RISK_LEVEL_LABELS[selectedItem.riskLevel]}
            </span>
          </div>
        </div>

        {/* 作业状态 */}
        <div className="bg-gray-50 rounded p-3">
          <div className="text-xs text-gray-500 mb-1">作业状态</div>
          <div className="text-sm text-gray-800">
            {WORK_STATUS_LABELS[selectedItem.workStatus]}
          </div>
        </div>

        {/* 位置信息 */}
        <div className="bg-gray-50 rounded p-3">
          <div className="text-xs text-gray-500 mb-1">所属市州</div>
          <div className="text-sm text-gray-800">
            {formatValue(selectedItem.city)}
          </div>
          <div className="text-xs text-gray-500 mt-2 mb-1">详细地址</div>
          <div className="text-sm text-gray-800">
            {formatValue(selectedItem.address)}
          </div>
        </div>

        {/* 人员信息 */}
        <div className="bg-gray-50 rounded p-3">
          <div className="text-xs text-gray-500 mb-1">当前作业人数</div>
          <div className="text-sm font-medium text-gray-800">
            {formatValue(selectedItem.personCountDisplay)} 人
          </div>
          <div className="text-xs text-gray-500 mt-2 mb-1">工作负责人</div>
          <div className="text-sm text-gray-800">
            {formatValue(selectedItem.leaderName)}
          </div>
        </div>

        {/* 电压等级 */}
        <div className="bg-gray-50 rounded p-3">
          <div className="text-xs text-gray-500 mb-1">电压等级</div>
          <div className="text-sm text-gray-800">
            {formatValue(selectedItem.voltageLevelName)}
          </div>
        </div>

        {/* 单位信息 */}
        <div className="bg-gray-50 rounded p-3">
          <div className="text-xs text-gray-500 mb-1">施工单位</div>
          <div className="text-sm text-gray-800">
            {formatValue(selectedItem.constructionUnit)}
          </div>
          <div className="text-xs text-gray-500 mt-2 mb-1">监理单位</div>
          <div className="text-sm text-gray-800">
            {formatValue(selectedItem.supervisionUnit)}
          </div>
        </div>

        {/* 作业内容 */}
        <div className="bg-gray-50 rounded p-3">
          <div className="text-xs text-gray-500 mb-1">作业内容</div>
          <div className="text-sm text-gray-800">
            {formatValue(selectedItem.workProcedure)}
          </div>
          <div className="text-xs text-gray-500 mt-2 mb-1">作业地点</div>
          <div className="text-sm text-gray-800">
            {formatValue(selectedItem.workSiteName)}
          </div>
        </div>

        {/* 时间信息 */}
        <div className="bg-gray-50 rounded p-3">
          <div className="text-xs text-gray-500 mb-1">作业日期</div>
          <div className="text-sm text-gray-800">
            {formatValue(selectedItem.workDate)}
          </div>
          <div className="text-xs text-gray-500 mt-2 mb-1">开始时间</div>
          <div className="text-sm text-gray-800">
            {formatValue(selectedItem.workStartTime)}
          </div>
        </div>
      </div>
    </div>
  );
}
