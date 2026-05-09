import { useEffect, useMemo, useState } from 'react';
import { RISK_COLORS } from '@/constants/layers';
import { LineSectionPanel } from '@/features/lineSection/LineSectionPanel';
import { useAppStore } from '@/store';
import type { RiskLevel, WorkStatus } from '@/types';

const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  working: '作业中',
  paused: '作业暂停',
  finished: '当日作业完工',
  unknown: '未知状态',
};

const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  0: '无风险',
  1: '一级风险',
  2: '二级风险',
  3: '三级风险',
  4: '四级风险',
  unknown: '无风险',
};

type DetailObject =
  | { type: 'workPoint'; data: any }
  | { type: 'tower'; data: any }
  | { type: 'station'; data: any }
  | null;

function getAttributes(entity: unknown): Record<string, unknown> {
  if (typeof entity === 'object' && entity !== null && 'attributes' in entity) {
    const value = (entity as { attributes?: unknown }).attributes;
    if (typeof value === 'object' && value !== null) {
      return value as Record<string, unknown>;
    }
  }
  return {};
}

function text(value: unknown, fallback = '--'): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  return String(value);
}

function statusText(value: string | null | undefined): string {
  return value && value.trim() ? value : '未知';
}

function sequenceLabel(sequence: {
  tower_no?: string | null;
  tower_key?: string | null;
  sequence_index?: number | null;
  node_kind?: string | null;
}) {
  const towerNo = text(sequence.tower_no, '未命名节点');
  const towerKey = sequence.tower_key ? ` (${sequence.tower_key})` : '';
  const index =
    typeof sequence.sequence_index === 'number'
      ? `#${sequence.sequence_index + 1}`
      : '未排序';
  const nodeKind = sequence.node_kind ? ` · ${sequence.node_kind}` : '';
  return `${index} ${towerNo}${towerKey}${nodeKind}`;
}

function InfoRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded bg-gray-50 p-3">
      <div className="mb-1 text-xs text-gray-500">{label}</div>
      <div className="text-sm text-gray-800">{text(value)}</div>
    </div>
  );
}

function SectionList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: Array<{
    tower_no?: string | null;
    tower_key?: string | null;
    sequence_index?: number | null;
    node_kind?: string | null;
  }>;
  emptyText: string;
}) {
  return (
    <div className="rounded border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-3 py-2 text-xs font-medium text-gray-600">
        {title}
      </div>
      <div className="space-y-2 p-3">
        {items.length === 0 ? (
          <div className="text-xs text-gray-400">{emptyText}</div>
        ) : (
          items.map(item => (
            <div
              key={`${item.tower_key ?? 'node'}:${item.sequence_index ?? 'na'}:${item.tower_no ?? ''}`}
              className="rounded bg-gray-50 px-3 py-2 text-xs text-gray-700"
            >
              {sequenceLabel(item)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function DetailPanel() {
  const {
    selectedItem,
    clearSelectedItem,
    selectedObject,
    clearSelectedObject,
    selectedProject,
    selectedProjectCode,
    selectedProjectLoading,
    selectedProjectError,
    clearSelectedProject,
    selectedLineSection,
    selectedLineSectionKey,
    selectedLineSectionLoading,
    selectedLineSectionError,
    clearSelectedLineSection,
    lineSections,
  } = useAppStore();
  const [tab, setTab] = useState<'overview' | 'line-sections'>('overview');

  useEffect(() => {
    setTab('overview');
  }, [selectedProjectCode, selectedLineSectionKey]);

  const displayObject: DetailObject =
    selectedObject || (selectedItem ? { type: 'workPoint', data: selectedItem } : null);

  const selectedLineSectionIndexItem = useMemo(
    () =>
      lineSections.find(item => item.line_section_key === selectedLineSectionKey) ?? null,
    [lineSections, selectedLineSectionKey],
  );

  const handleClose = () => {
    if (displayObject) {
      clearSelectedItem();
      clearSelectedObject?.();
      return;
    }
    if (selectedLineSectionKey) {
      clearSelectedLineSection();
      return;
    }
    if (selectedProjectCode) {
      clearSelectedProject();
    }
  };

  if (!displayObject && !selectedProjectCode && !selectedLineSectionKey) {
    return (
      <div className="panel p-4 h-full flex flex-col">
        <h2 className="panel-title">详情信息</h2>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <p className="text-sm text-gray-500">点击地图对象或选择项目查看详情</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel p-4 h-full flex flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="panel-title mb-0">详情信息</h2>
        <button
          onClick={handleClose}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          关闭
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        {displayObject ? (
          <ObjectDetail type={displayObject.type} data={displayObject.data} />
        ) : null}

        {!displayObject && selectedLineSectionKey ? (
          <LineSectionDetail
            selectedLineSection={selectedLineSection}
            selectedLineSectionError={selectedLineSectionError}
            selectedLineSectionLoading={selectedLineSectionLoading}
            selectedLineSectionIndexItem={selectedLineSectionIndexItem}
          />
        ) : null}

        {!displayObject && !selectedLineSectionKey ? (
          <ProjectDetail
            tab={tab}
            setTab={setTab}
            selectedProject={selectedProject}
            selectedProjectCode={selectedProjectCode}
            selectedProjectLoading={selectedProjectLoading}
            selectedProjectError={selectedProjectError}
          />
        ) : null}
      </div>
    </div>
  );
}

function ObjectDetail({ type, data }: { type: 'workPoint' | 'tower' | 'station'; data: any }) {
  return (
    <>
      <div className="rounded bg-blue-50 p-2">
        <span className="text-xs font-medium text-blue-600">
          {type === 'tower' && '杆塔'}
          {type === 'station' && '变电站'}
          {type === 'workPoint' && '作业点'}
        </span>
      </div>

      {type === 'tower' ? (
        <>
          <InfoRow label="杆塔编号" value={data.tower_no || data.towerNo} />
          <InfoRow label="所属线路" value={data.single_project_code || data.singleProjectCode} />
          <InfoRow label="项目编码" value={data.project_code || data.projectCode} />
          <InfoRow label="坐标" value={`${text(data.longitude)}, ${text(data.latitude)}`} />
        </>
      ) : null}

      {type === 'station' ? (
        <>
          <InfoRow label="变电站名称" value={data.name || data.single_project_code} />
          <InfoRow label="项目编码" value={data.project_code || data.prj_code || data.prjCode} />
          <InfoRow label="坐标" value={`${text(data.longitude)}, ${text(data.latitude)}`} />
        </>
      ) : null}

      {type === 'workPoint' ? (
        <>
          <InfoRow label="工程名称" value={data.projectName} />
          <div className="rounded bg-gray-50 p-3">
            <div className="mb-1 text-xs text-gray-500">风险等级</div>
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: RISK_COLORS[data.riskLevel as RiskLevel] }}
              />
              <span className="text-sm">
                {RISK_LEVEL_LABELS[data.riskLevel as RiskLevel]}
              </span>
            </div>
          </div>
          <InfoRow label="作业人数" value={`${data.personCountDisplay ?? data.personCount ?? 0} 人`} />
          <InfoRow
            label="作业状态"
            value={WORK_STATUS_LABELS[data.workStatus as WorkStatus]}
          />
          <InfoRow
            label="电压等级"
            value={data.voltageLevelName ?? data.voltageLevel ?? '--'}
          />
          <InfoRow label="市州" value={data.city} />
          <InfoRow label="作业地点" value={data.address} />
          <InfoRow label="施工单位" value={data.constructionUnit} />
          <InfoRow label="监理单位" value={data.supervisionUnit} />
          <InfoRow label="工作负责人" value={data.leaderName} />
          <InfoRow label="作业内容" value={data.workProcedure} />
          <InfoRow label="作业票号" value={data.ticketNo} />
          <InfoRow label="作业日期" value={`${text(data.workDate)} ${text(data.workStartTime, '')}`} />
          <div
            className={
              data.projectCode
                ? 'rounded bg-green-50 p-3'
                : 'rounded bg-yellow-50 p-3'
            }
          >
            <div
              className={`mb-1 text-xs ${
                data.projectCode ? 'text-green-600' : 'text-yellow-600'
              }`}
            >
              项目编码
            </div>
            <div className="text-sm font-mono">
              {data.projectCode ?? data.singleProjectCode ?? 'N/A'}
            </div>
            <div
              className={`mt-1 text-xs ${
                data.projectCode ? 'text-green-500' : 'text-yellow-500'
              }`}
            >
              {data.projectCode ? '已解析' : '未解析 (unresolved)'}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

function ProjectDetail({
  tab,
  setTab,
  selectedProject,
  selectedProjectCode,
  selectedProjectLoading,
  selectedProjectError,
}: {
  tab: 'overview' | 'line-sections';
  setTab: (tab: 'overview' | 'line-sections') => void;
  selectedProject: any;
  selectedProjectCode: string | null;
  selectedProjectLoading: boolean;
  selectedProjectError: string | null;
}) {
  if (selectedProjectLoading) {
    return (
      <div className="rounded bg-gray-50 px-3 py-4 text-sm text-gray-500">
        正在加载项目详情...
      </div>
    );
  }

  if (selectedProjectError) {
    return (
      <div className="rounded bg-red-50 px-3 py-4 text-sm text-red-600">
        {selectedProjectError}
      </div>
    );
  }

  if (!selectedProject || !selectedProjectCode) {
    return (
      <div className="rounded bg-gray-50 px-3 py-4 text-sm text-gray-500">
        尚未选择项目。
      </div>
    );
  }

  const projectAttributes = getAttributes(selectedProject.project);
  const counts = selectedProject.counts ?? {};
  const warnings = Array.isArray(selectedProject.warnings) ? selectedProject.warnings : [];

  return (
    <>
      <div className="rounded bg-blue-50 p-2">
        <span className="text-xs font-medium text-blue-600">项目</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setTab('overview')}
          className={`rounded px-3 py-2 text-sm transition ${
            tab === 'overview'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          项目概览
        </button>
        <button
          type="button"
          onClick={() => setTab('line-sections')}
          className={`rounded px-3 py-2 text-sm transition ${
            tab === 'line-sections'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          查看区段
        </button>
      </div>

      {tab === 'overview' ? (
        <>
          <InfoRow label="项目名称" value={projectAttributes.project_name} />
          <InfoRow label="项目编码" value={projectAttributes.project_code ?? selectedProjectCode} />
          <InfoRow label="项目状态" value={statusText(selectedProject.status)} />
          <InfoRow label="单项工程数" value={counts.single_project_count} />
          <InfoRow label="标段数" value={counts.bidding_section_count} />
          <InfoRow label="杆塔数" value={counts.tower_count} />
          <InfoRow label="变电站数" value={counts.station_count} />
          <InfoRow label="区段数" value={counts.line_section_count} />
          <InfoRow label="作业点数" value={counts.work_point_count} />
          <InfoRow label="最近作业日期" value={selectedProject.latest_work_date} />
          <InfoRow
            label="进度摘要"
            value={
              selectedProject.progress_summary?.statuses?.length
                ? `${selectedProject.progress_summary.statuses.join(' / ')} (${selectedProject.progress_summary.count})`
                : '暂无年度进度数据'
            }
          />
          <div className="rounded bg-gray-50 p-3">
            <div className="mb-2 text-xs text-gray-500">告警/提示</div>
            {warnings.length === 0 ? (
              <div className="text-sm text-gray-500">暂无告警</div>
            ) : (
              <div className="space-y-2">
                {warnings.map((warning: string) => (
                  <div
                    key={warning}
                    className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-700"
                  >
                    {warning}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <LineSectionPanel />
      )}
    </>
  );
}

function LineSectionDetail({
  selectedLineSection,
  selectedLineSectionError,
  selectedLineSectionLoading,
  selectedLineSectionIndexItem,
}: {
  selectedLineSection: any;
  selectedLineSectionError: string | null;
  selectedLineSectionLoading: boolean;
  selectedLineSectionIndexItem: any;
}) {
  if (selectedLineSectionLoading) {
    return (
      <div className="rounded bg-gray-50 px-3 py-4 text-sm text-gray-500">
        正在加载区段详情...
      </div>
    );
  }

  if (selectedLineSectionError) {
    return (
      <div className="rounded bg-red-50 px-3 py-4 text-sm text-red-600">
        {selectedLineSectionError}
      </div>
    );
  }

  if (!selectedLineSection) {
    return (
      <div className="rounded bg-gray-50 px-3 py-4 text-sm text-gray-500">
        尚未选择区段。
      </div>
    );
  }

  const attrs = getAttributes(selectedLineSection.line_section);
  const warnings = Array.isArray(selectedLineSection.warnings)
    ? selectedLineSection.warnings
    : [];
  const status = selectedLineSectionIndexItem?.status ?? 'ok';

  return (
    <>
      <div className="rounded bg-blue-50 p-2">
        <span className="text-xs font-medium text-blue-600">区段</span>
      </div>

      <InfoRow
        label="区段名称"
        value={attrs.line_section_name ?? selectedLineSectionIndexItem?.line_section_name}
      />
      <InfoRow label="项目编码" value={attrs.project_code ?? selectedLineSectionIndexItem?.project_code} />
      <InfoRow
        label="单项工程编码"
        value={attrs.single_project_code ?? selectedLineSectionIndexItem?.single_project_code}
      />
      <InfoRow
        label="标段编码"
        value={attrs.bidding_section_code ?? selectedLineSectionIndexItem?.bidding_section_code}
      />
      <InfoRow label="状态" value={status} />
      <InfoRow
        label="序列节点数"
        value={
          selectedLineSectionIndexItem?.tower_sequence_count ??
          selectedLineSection.tower_sequence?.length
        }
      />
      <InfoRow
        label="匹配杆塔数"
        value={
          selectedLineSectionIndexItem?.matched_tower_count ??
          selectedLineSection.matched_towers?.length
        }
      />
      <InfoRow
        label="参考节点数"
        value={
          selectedLineSectionIndexItem?.reference_node_count ??
          selectedLineSection.reference_nodes?.length
        }
      />
      <InfoRow
        label="缺失物理塔数"
        value={
          selectedLineSectionIndexItem?.missing_physical_count ??
          selectedLineSection.missing_nodes?.length
        }
      />
      <InfoRow
        label="空作用域节点数"
        value={
          selectedLineSectionIndexItem?.scope_without_tower_count ??
          selectedLineSection.scope_without_tower?.length
        }
      />

      {warnings.length > 0 ? (
        <div className="rounded bg-amber-50 p-3">
          <div className="mb-2 text-xs text-amber-700">提示</div>
          <div className="space-y-2">
            {warnings.map((warning: string) => (
              <div key={warning} className="text-sm text-amber-700">
                {warning}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <SectionList
        title="matched_towers"
        items={selectedLineSection.matched_towers.map((item: any, index: number) => {
          const itemAttrs = getAttributes(item);
          return {
            tower_no: text(itemAttrs.tower_no, item.entity_key),
            tower_key: item.entity_key as string | null,
            sequence_index: index,
            node_kind: 'physical_tower',
          };
        })}
        emptyText="当前区段没有已匹配杆塔。"
      />
      <SectionList
        title="reference_nodes"
        items={selectedLineSection.reference_nodes}
        emptyText="当前区段没有参考节点。"
      />
      <SectionList
        title="missing_nodes"
        items={selectedLineSection.missing_nodes}
        emptyText="当前区段没有缺失节点。"
      />
      <SectionList
        title="scope_without_tower"
        items={selectedLineSection.scope_without_tower}
        emptyText="当前区段没有空作用域节点。"
      />
    </>
  );
}
