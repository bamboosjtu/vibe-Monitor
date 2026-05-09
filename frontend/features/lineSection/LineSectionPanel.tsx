import { useAppStore } from '@/store';

function statusStyles(status: 'ok' | 'warning' | 'reference') {
  if (status === 'warning') {
    return 'bg-amber-100 text-amber-800';
  }
  if (status === 'reference') {
    return 'bg-blue-100 text-blue-800';
  }
  return 'bg-emerald-100 text-emerald-800';
}

export function LineSectionPanel() {
  const {
    selectedProjectCode,
    lineSections,
    lineSectionsLoading,
    lineSectionsError,
    selectedLineSectionKey,
    selectLineSection,
  } = useAppStore();

  if (!selectedProjectCode) {
    return (
      <div className="rounded border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-sm text-gray-500">
        请先选择项目。
      </div>
    );
  }

  if (lineSectionsLoading) {
    return (
      <div className="rounded bg-gray-50 px-3 py-4 text-sm text-gray-500">
        正在加载区段列表...
      </div>
    );
  }

  if (lineSectionsError) {
    return (
      <div className="rounded bg-red-50 px-3 py-4 text-sm text-red-600">
        {lineSectionsError}
      </div>
    );
  }

  if (lineSections.length === 0) {
    return (
      <div className="rounded bg-gray-50 px-3 py-4 text-sm text-gray-500">
        当前项目暂无区段数据。
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {lineSections.map(item => {
        const active = item.line_section_key === selectedLineSectionKey;
        return (
          <button
            key={item.line_section_key}
            type="button"
            onClick={() => void selectLineSection(item.line_section_key)}
            className={`w-full rounded border px-3 py-2 text-left transition ${
              active
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-gray-800">
                  {item.line_section_name || item.line_section_key}
                </div>
                <div className="mt-0.5 text-[11px] text-gray-500">
                  {item.line_section_key}
                </div>
              </div>
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-medium ${statusStyles(
                  item.status,
                )}`}
              >
                {item.status}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-gray-600">
              <div>序列 {item.tower_sequence_count}</div>
              <div>匹配塔 {item.matched_tower_count}</div>
              <div>参考点 {item.reference_node_count}</div>
              <div>缺失塔 {item.missing_physical_count}</div>
              <div>空作用域 {item.scope_without_tower_count}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
