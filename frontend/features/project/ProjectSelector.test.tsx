import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '@/store';
import { ProjectSelector } from './ProjectSelector';

vi.mock('@/store', () => ({
  useAppStore: vi.fn(),
}));

function mockStore(overrides?: Record<string, unknown>) {
  vi.mocked(useAppStore).mockReturnValue({
    dataSource: 'monitor_backend',
    projectSearchKeyword: '',
    projectList: [
      {
        project_code: 'PRJ-001',
        project_name: '示例工程',
        tower_count: 2,
        station_count: 1,
        line_section_count: 3,
        work_point_count: 4,
        status: '在建',
      },
    ],
    projectListLoading: false,
    projectListError: null,
    selectedProjectCode: null,
    selectedProjectStatus: 'all',
    projectStatusLoading: false,
    projectStatusError: null,
    loadDomainProjects: vi.fn(),
    selectProject: vi.fn(async () => {}),
    clearSelectedProject: vi.fn(),
    loadProjectStatus: vi.fn(async () => {}),
    setSelectedProjectStatus: vi.fn(),
    ...overrides,
  } as any);
}

describe('ProjectSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders project list and triggers selectProject on click', async () => {
    const selectProject = vi.fn(async () => {});
    mockStore({ selectProject });

    render(<ProjectSelector />);

    fireEvent.click(screen.getByRole('button', { name: /示例工程/i }));

    expect(selectProject).toHaveBeenCalledWith('PRJ-001');
  });

  it('triggers clearSelectedProject when clear button is clicked', () => {
    const clearSelectedProject = vi.fn();
    mockStore({
      selectedProjectCode: 'PRJ-001',
      clearSelectedProject,
    });

    render(<ProjectSelector />);

    fireEvent.click(screen.getByRole('button', { name: '清空项目' }));

    expect(clearSelectedProject).toHaveBeenCalledTimes(1);
  });
});
