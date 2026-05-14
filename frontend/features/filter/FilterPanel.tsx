import { useEffect, useState } from 'react';
import { VOLTAGE_LEVELS } from '@/constants';
import { RISK_COLORS } from '@/constants/layers';
import { useAppStore } from '@/store';
import { toggleArrayValue } from '@/lib/filter';
import { getBootstrap } from '@/api/mapApi';
import { ProjectSelector } from '@/features/project/ProjectSelector';
import type { WorkStatus } from '@/types';

const WORK_STATUS_OPTIONS: { value: WorkStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'working', label: '作业中' },
  { value: 'paused', label: '作业暂停' },
  { value: 'finished', label: '当日作业完工' },
];

// 风险等级筛选项：1-4 级 + 无风险
// 业务语义：一级(1)=最高风险(红)，四级(4)=较低风险(蓝)，无风险=绿色
// 说明：真实数据中 reAssessmentRiskLevel 为 null 或非法值时，统一展示为"无风险"
// 展示口径合并：底层数据中的 unknown 在 UI 上统一显示为"无风险"
const RISK_LEVEL_OPTIONS: { value: 1 | 2 | 3 | 4 | 'unknown'; label: string; color: string }[] = [
  { value: 1, label: '一级风险', color: RISK_COLORS[1] },
  { value: 2, label: '二级风险', color: RISK_COLORS[2] },
  { value: 3, label: '三级风险', color: RISK_COLORS[3] },
  { value: 4, label: '四级风险', color: RISK_COLORS[4] },
  { value: 'unknown', label: '无风险', color: RISK_COLORS['unknown'] },
];

// M1R2: 图层控制 - 已移除线路层，只保留 Tower/WorkPoint/Station
type LayerKey = 'tower' | 'workPoint' | 'station';

const LAYER_OPTIONS: { key: LayerKey; label: string; color: string }[] = [
  { key: 'tower', label: '杆塔', color: '#1e293b' },
  { key: 'workPoint', label: '作业点', color: '#ef4444' },
  { key: 'station', label: '变电站', color: '#f59e0b' },
];

export function FilterPanel() {
  const {
    filters,
    setFilters,
    resetFilters,
    filteredData,
    normalizedData,
    layerVisibility,
    setLayerVisibility,
    dataSource,
    selectedProjectCode,
  } = useAppStore();
  
  // M1 Round2: 获取 unresolved 统计
  const [unresolvedCount, setUnresolvedCount] = useState<number | null>(null);
  
  useEffect(() => {
    if (dataSource === 'monitor_backend') {
      setUnresolvedCount(null);
      return;
    }

    getBootstrap().then(data => {
      setUnresolvedCount(data.unresolved_year_progress_count ?? null);
    }).catch(() => {
      setUnresolvedCount(null);
    });
  }, [dataSource]);

  const handleWorkStatusChange = (value: WorkStatus | 'all') => {
    setFilters({ workStatus: value });
  };

  const handleRiskLevelToggle = (value: 1 | 2 | 3 | 4 | 'unknown') => {
    setFilters({
      riskLevels: toggleArrayValue(filters.riskLevels, value),
    });
  };

  const handleVoltageLevelToggle = (level: string) => {
    setFilters({
      voltageLevels: toggleArrayValue(filters.voltageLevels, level),
    });
  };

  return (
    <div className="panel p-4 h-full flex flex-col">
      <h2 className="panel-title">筛选条件</h2>

      {/* M1 Round2: unresolved 统计 */}
      {unresolvedCount !== null && unresolvedCount > 0 && (
        <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
          <div className="text-xs text-yellow-700">
            <span className="font-medium">未解析项目: {unresolvedCount}</span>
            <span className="block text-yellow-600 mt-0.5">年度目标数据待映射</span>
          </div>
        </div>
      )}

      {/* 筛选结果统计 */}
      <div className="mb-4 text-xs text-gray-500">
        显示 {filteredData.length} / {normalizedData.length} 条记录
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto">
        <ProjectSelector />

        {selectedProjectCode && normalizedData.some(item => !item.projectCode) ? (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            部分对象缺少项目编码，未纳入项目过滤。
          </div>
        ) : null}

        {/* 作业状态筛选 - 单选 */}
        <div className="space-y-2">
          <label className="text-xs text-gray-500 font-medium">作业状态</label>
          <div className="space-y-1">
            {WORK_STATUS_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="radio"
                  name="workStatus"
                  value={option.value}
                  checked={filters.workStatus === option.value}
                  onChange={() => handleWorkStatusChange(option.value)}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 风险等级筛选 - 多选 */}
        <div className="space-y-2">
          <label className="text-xs text-gray-500 font-medium">风险等级</label>
          <div className="space-y-1">
            {RISK_LEVEL_OPTIONS.map((option) => (
              <label
                key={String(option.value)}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={filters.riskLevels.includes(option.value)}
                  onChange={() => handleRiskLevelToggle(option.value)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: option.color }}
                />
                <span className="text-sm text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 电压等级筛选 - 多选 */}
        <div className="space-y-2">
          <label className="text-xs text-gray-500 font-medium">电压等级</label>
          <div className="space-y-1">
            {VOLTAGE_LEVELS.map((level) => (
              <label
                key={level}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={filters.voltageLevels.includes(level)}
                  onChange={() => handleVoltageLevelToggle(level)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{level}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* 重置按钮 */}
      <button
        onClick={resetFilters}
        className="mt-4 w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded text-sm transition-colors"
      >
        重置筛选
      </button>

      {/* M1 Round2: 图层显隐控制 */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <label className="text-xs text-gray-500 font-medium mb-2 block">图层控制</label>
        <div className="space-y-2">
          {LAYER_OPTIONS.map((option) => (
            <label
              key={option.key}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={layerVisibility[option.key]}
                onChange={(e) => setLayerVisibility(option.key, e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: option.color }}
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
