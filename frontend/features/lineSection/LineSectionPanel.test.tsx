import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '@/store';
import { LineSectionPanel } from './LineSectionPanel';

vi.mock('@/store', () => ({
  useAppStore: vi.fn(),
}));

function mockStore(overrides?: Record<string, unknown>) {
  vi.mocked(useAppStore).mockReturnValue({
    selectedProjectCode: 'PRJ-001',
    lineSections: [
      {
        line_section_key: 'LS-OK',
        line_section_name: '区段一',
        tower_sequence_count: 2,
        matched_tower_count: 2,
        reference_node_count: 0,
        missing_physical_count: 0,
        scope_without_tower_count: 0,
        status: 'ok',
      },
      {
        line_section_key: 'LS-WARN',
        line_section_name: '区段二',
        tower_sequence_count: 3,
        matched_tower_count: 1,
        reference_node_count: 0,
        missing_physical_count: 1,
        scope_without_tower_count: 0,
        status: 'warning',
      },
      {
        line_section_key: 'LS-REF',
        line_section_name: '区段三',
        tower_sequence_count: 3,
        matched_tower_count: 1,
        reference_node_count: 1,
        missing_physical_count: 0,
        scope_without_tower_count: 0,
        status: 'reference',
      },
    ],
    lineSectionsLoading: false,
    lineSectionsError: null,
    selectedLineSectionKey: null,
    selectLineSection: vi.fn(async () => {}),
    ...overrides,
  } as any);
}

describe('LineSectionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders ok/warning/reference statuses', () => {
    mockStore();

    render(<LineSectionPanel />);

    expect(screen.getByText('ok')).toBeInTheDocument();
    expect(screen.getByText('warning')).toBeInTheDocument();
    expect(screen.getByText('reference')).toBeInTheDocument();
  });

  it('triggers selectLineSection on click', () => {
    const selectLineSection = vi.fn(async () => {});
    mockStore({ selectLineSection });

    render(<LineSectionPanel />);

    fireEvent.click(screen.getByRole('button', { name: /区段二/i }));

    expect(selectLineSection).toHaveBeenCalledWith('LS-WARN');
  });
});
