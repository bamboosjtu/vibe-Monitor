import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBootstrap } from '@/api/mapApi';
import { useAppStore } from '@/store';
import { FilterPanel } from './FilterPanel';

vi.mock('@/api/mapApi', () => ({
  getBootstrap: vi.fn(),
}));

vi.mock('@/store', () => ({
  useAppStore: vi.fn(),
}));

function mockStore(dataSource: 'local' | 'legacy-api' | 'datahub' | 'monitor_backend' = 'local') {
  vi.mocked(useAppStore).mockReturnValue({
    filters: {
      workStatus: 'all',
      riskLevels: [],
      cities: [],
      voltageLevels: [],
    },
    setFilters: vi.fn(),
    resetFilters: vi.fn(),
    filteredData: [],
    normalizedData: [],
    layerVisibility: {
      tower: true,
      workPoint: true,
      station: true,
    },
    setLayerVisibility: vi.fn(),
    dataSource,
  } as any);
}

describe('FilterPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should skip legacy backend bootstrap in datahub mode', () => {
    mockStore('datahub');

    render(<FilterPanel />);

    expect(getBootstrap).not.toHaveBeenCalled();
  });

  it('should skip legacy backend bootstrap in monitor backend mode', () => {
    mockStore('monitor_backend');

    render(<FilterPanel />);

    expect(getBootstrap).not.toHaveBeenCalled();
  });

  it('should keep legacy backend bootstrap in local/api modes', () => {
    vi.mocked(getBootstrap).mockResolvedValue({} as any);
    mockStore('local');

    render(<FilterPanel />);

    expect(getBootstrap).toHaveBeenCalledTimes(1);
  });
});
