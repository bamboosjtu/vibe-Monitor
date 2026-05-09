import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/store';

const PROJECT_STATUS_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: '在建', label: '在建' },
  { value: '待建', label: '待建' },
  { value: '投产', label: '投产' },
  { value: 'unknown', label: '未知' },
] as const;

function statusLabel(value: string | null | undefined): string {
  return value && value.trim() ? value : '未知';
}

export function ProjectSelector() {
  const {
    dataSource,
    projectSearchKeyword,
    projectList,
    projectListLoading,
    projectListError,
    selectedProjectCode,
    selectedProjectStatus,
    projectStatusLoading,
    projectStatusError,
    loadDomainProjects,
    selectProject,
    clearSelectedProject,
    loadProjectStatus,
    setSelectedProjectStatus,
  } = useAppStore();
  const [keyword, setKeyword] = useState(projectSearchKeyword);

  const domainEnabled = dataSource === 'monitor_backend' || dataSource === 'datahub';

  useEffect(() => {
    setKeyword(projectSearchKeyword);
  }, [projectSearchKeyword]);

  useEffect(() => {
    if (!domainEnabled) {
      return;
    }
    void loadProjectStatus();
    void loadDomainProjects(projectSearchKeyword);
  }, [domainEnabled, loadDomainProjects, loadProjectStatus, projectSearchKeyword]);

  useEffect(() => {
    if (!domainEnabled) {
      return;
    }
    const handle = window.setTimeout(() => {
      void loadDomainProjects(keyword.trim());
    }, 250);
    return () => window.clearTimeout(handle);
  }, [domainEnabled, keyword, loadDomainProjects]);

  const projectStatusSummary = useMemo(() => {
    if (projectStatusLoading) {
      return '状态加载中...';
    }
    if (projectStatusError) {
      return '状态数据不可用';
    }
    return `项目 ${projectList.length} 个`;
  }, [projectList.length, projectStatusError, projectStatusLoading]);

  if (!domainEnabled) {
    return (
      <div className="mb-4 rounded border border-dashed border-gray-300 bg-gray-50 p-3">
        <div className="text-xs font-medium text-gray-600">项目筛选</div>
        <div className="mt-1 text-xs text-gray-500">
          当前模式未启用 Monitor backend 项目域能力。
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-gray-700">项目筛选</div>
          <div className="text-[11px] text-gray-500">{projectStatusSummary}</div>
        </div>
        {selectedProjectCode ? (
          <button
            type="button"
            onClick={clearSelectedProject}
            className="rounded border border-gray-300 px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-50"
          >
            清空项目
          </button>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        <input
          value={keyword}
          onChange={event => setKeyword(event.target.value)}
          placeholder="搜索项目名称或编码"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
        />

        <select
          value={selectedProjectStatus}
          onChange={event => setSelectedProjectStatus(event.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
        >
          {PROJECT_STATUS_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {projectStatusError ? (
        <div className="mt-2 rounded bg-yellow-50 px-2 py-1 text-[11px] text-yellow-700">
          {projectStatusError}
        </div>
      ) : null}

      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
        {projectListLoading ? (
          <div className="rounded bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
            正在加载项目列表...
          </div>
        ) : null}

        {!projectListLoading && projectListError ? (
          <div className="rounded bg-red-50 px-3 py-3 text-sm text-red-600">
            {projectListError}
          </div>
        ) : null}

        {!projectListLoading && !projectListError && projectList.length === 0 ? (
          <div className="rounded bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
            没有匹配的项目
          </div>
        ) : null}

        {!projectListLoading &&
          !projectListError &&
          projectList.map(project => {
            const active = project.project_code === selectedProjectCode;
            return (
              <button
                key={`${project.project_code ?? 'missing'}:${project.project_name ?? ''}`}
                type="button"
                onClick={() => {
                  if (project.project_code) {
                    void selectProject(project.project_code);
                  }
                }}
                disabled={!project.project_code}
                className={`w-full rounded border px-3 py-2 text-left transition ${
                  active
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                } ${project.project_code ? '' : 'cursor-not-allowed opacity-60'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-800">
                      {project.project_name || '未命名项目'}
                    </div>
                    <div className="mt-0.5 text-[11px] text-gray-500">
                      {project.project_code || '缺少项目编码'}
                    </div>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] ${
                      active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {statusLabel(project.status)}
                  </span>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-gray-600">
                  <div>杆塔 {project.tower_count}</div>
                  <div>变电站 {project.station_count}</div>
                  <div>区段 {project.line_section_count}</div>
                  <div>作业点 {project.work_point_count}</div>
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );
}
