import { CITIES, VOLTAGE_LEVELS } from '@/constants';
import { RISK_COLORS } from '@/constants/layers';
import { useAppStore } from '@/store';
import { toggleArrayValue } from '@/lib/filter';
import type { WorkStatus, VoltageLevelCode } from '@/types';

const WORK_STATUS_OPTIONS: { value: WorkStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'working', label: '作业中' },
  { value: 'paused', label: '作业暂停' },
  { value: 'finished', label: '当日作业完工' },
];

// 风险等级筛选项：仅 1-4 级（冻结需求）
// unknown 记录仍保留在数据中，但不可通过筛选面板单独筛选
const RISK_LEVEL_OPTIONS: { value: 1 | 2 | 3 | 4; label: string; color: string }[] = [
  { value: 1, label: '一级风险', color: RISK_COLORS[1] },
  { value: 2, label: '二级风险', color: RISK_COLORS[2] },
  { value: 3, label: '三级风险', color: RISK_COLORS[3] },
  { value: 4, label: '四级风险', color: RISK_COLORS[4] },
];

export function FilterPanel() {
  const { filters, setFilters, resetFilters, filteredData, normalizedData } = useAppStore();

  const handleWorkStatusChange = (value: WorkStatus | 'all') => {
    setFilters({ workStatus: value });
  };

  const handleRiskLevelToggle = (value: 1 | 2 | 3 | 4) => {
    setFilters({
      riskLevels: toggleArrayValue(filters.riskLevels, value),
    });
  };

  const handleCityToggle = (city: string) => {
    setFilters({
      cities: toggleArrayValue(filters.cities, city),
    });
  };

  const handleVoltageLevelToggle = (level: VoltageLevelCode) => {
    setFilters({
      voltageLevels: toggleArrayValue(filters.voltageLevels, level),
    });
  };

  return (
    <div className="panel p-4 h-full flex flex-col">
      <h2 className="panel-title">筛选条件</h2>

      {/* 筛选结果统计 */}
      <div className="mb-4 text-xs text-gray-500">
        显示 {filteredData.length} / {normalizedData.length} 条记录
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto">
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

        {/* 市州筛选 - 多选 */}
        <div className="space-y-2">
          <label className="text-xs text-gray-500 font-medium">市州</label>
          <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-100 rounded p-1">
            {CITIES.map((city) => (
              <label
                key={city}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={filters.cities.includes(city)}
                  onChange={() => handleCityToggle(city)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{city}</span>
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
                  checked={filters.voltageLevels.includes(level as VoltageLevelCode)}
                  onChange={() => handleVoltageLevelToggle(level as VoltageLevelCode)}
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
    </div>
  );
}
