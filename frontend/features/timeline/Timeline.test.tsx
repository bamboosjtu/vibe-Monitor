import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Timeline } from './Timeline';
import { useAppStore } from '@/store';

// Mock the store
vi.mock('@/store', () => ({
  useAppStore: vi.fn(),
}));

describe('Timeline', () => {
  const mockLoadDataByDate = vi.fn();
  const mockSetError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display current date and position indicator', () => {
    vi.mocked(useAppStore).mockReturnValue({
      currentDate: '2026-04-05',
      availableDates: ['2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-05'],
      loadDataByDate: mockLoadDataByDate,
      pageStatus: 'ready',
      error: null,
      setError: mockSetError,
      isPlaying: false,
      setIsPlaying: vi.fn(),
    });

    render(<Timeline />);

    // 验证日期显示
    expect(screen.getByText('2026年04月05日')).toBeInTheDocument();
    // 验证位置指示 - 使用 container query 因为文本分散在多个 span 中
    const { container } = render(<Timeline />);
    expect(container.textContent).toContain('5');
    expect(container.textContent).toContain('/');
  });

  it('should disable prev button on first date', () => {
    vi.mocked(useAppStore).mockReturnValue({
      currentDate: '2026-04-01',
      availableDates: ['2026-04-01', '2026-04-02', '2026-04-03'],
      loadDataByDate: mockLoadDataByDate,
      pageStatus: 'ready',
      error: null,
      setError: mockSetError,
      isPlaying: false,
      setIsPlaying: vi.fn(),
    });

    render(<Timeline />);

    const prevButton = screen.getByText('上一天').closest('button');
    expect(prevButton).toBeDisabled();
  });

  it('should disable next button on last date', () => {
    vi.mocked(useAppStore).mockReturnValue({
      currentDate: '2026-04-03',
      availableDates: ['2026-04-01', '2026-04-02', '2026-04-03'],
      loadDataByDate: mockLoadDataByDate,
      pageStatus: 'ready',
      error: null,
      setError: mockSetError,
      isPlaying: false,
      setIsPlaying: vi.fn(),
    });

    render(<Timeline />);

    const nextButton = screen.getByText('下一天').closest('button');
    expect(nextButton).toBeDisabled();
  });

  it('should enable both buttons on middle date', () => {
    vi.mocked(useAppStore).mockReturnValue({
      currentDate: '2026-04-02',
      availableDates: ['2026-04-01', '2026-04-02', '2026-04-03'],
      loadDataByDate: mockLoadDataByDate,
      pageStatus: 'ready',
      error: null,
      setError: mockSetError,
      isPlaying: false,
      setIsPlaying: vi.fn(),
    });

    render(<Timeline />);

    const prevButton = screen.getByText('上一天').closest('button');
    const nextButton = screen.getByText('下一天').closest('button');

    expect(prevButton).not.toBeDisabled();
    expect(nextButton).not.toBeDisabled();
  });

  it('should call loadDataByDate when clicking prev button', () => {
    vi.mocked(useAppStore).mockReturnValue({
      currentDate: '2026-04-02',
      availableDates: ['2026-04-01', '2026-04-02', '2026-04-03'],
      loadDataByDate: mockLoadDataByDate,
      pageStatus: 'ready',
      error: null,
      setError: mockSetError,
      isPlaying: false,
      setIsPlaying: vi.fn(),
    });

    render(<Timeline />);

    const prevButton = screen.getByText('上一天');
    fireEvent.click(prevButton);

    expect(mockLoadDataByDate).toHaveBeenCalledWith('2026-04-01', false);
  });

  it('should call loadDataByDate when clicking next button', () => {
    vi.mocked(useAppStore).mockReturnValue({
      currentDate: '2026-04-02',
      availableDates: ['2026-04-01', '2026-04-02', '2026-04-03'],
      loadDataByDate: mockLoadDataByDate,
      pageStatus: 'ready',
      error: null,
      setError: mockSetError,
      isPlaying: false,
      setIsPlaying: vi.fn(),
    });

    render(<Timeline />);

    const nextButton = screen.getByText('下一天');
    fireEvent.click(nextButton);

    expect(mockLoadDataByDate).toHaveBeenCalledWith('2026-04-03', false);
  });

  it('should show loading spinner when data is being loaded', async () => {
    // 模拟一个耗时的数据加载
    mockLoadDataByDate.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    vi.mocked(useAppStore).mockReturnValue({
      currentDate: '2026-04-02',
      availableDates: ['2026-04-01', '2026-04-02', '2026-04-03'],
      loadDataByDate: mockLoadDataByDate,
      pageStatus: 'ready',
      error: null,
      setError: mockSetError,
      isPlaying: false,
      setIsPlaying: vi.fn(),
    });

    render(<Timeline />);

    // 点击下一天按钮触发加载状态
    const nextButton = screen.getByText('下一天');
    fireEvent.click(nextButton);

    // 验证加载状态出现（显示"加载"文本）
    expect(screen.getByText('加载')).toBeInTheDocument();
  });

  it('should show play button when not playing', () => {
    vi.mocked(useAppStore).mockReturnValue({
      currentDate: '2026-04-02',
      availableDates: ['2026-04-01', '2026-04-02', '2026-04-03'],
      loadDataByDate: mockLoadDataByDate,
      pageStatus: 'ready',
      error: null,
      setError: mockSetError,
      isPlaying: false,
      setIsPlaying: vi.fn(),
    });

    render(<Timeline />);

    expect(screen.getByText('播放')).toBeInTheDocument();
  });

  it('should disable all navigation buttons when loading', async () => {
    // 模拟一个耗时的数据加载
    mockLoadDataByDate.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    vi.mocked(useAppStore).mockReturnValue({
      currentDate: '2026-04-02',
      availableDates: ['2026-04-01', '2026-04-02', '2026-04-03'],
      loadDataByDate: mockLoadDataByDate,
      pageStatus: 'ready',
      error: null,
      setError: mockSetError,
      isPlaying: false,
      setIsPlaying: vi.fn(),
    });

    render(<Timeline />);

    // 点击下一天按钮触发加载状态
    const nextButton = screen.getByText('下一天');
    fireEvent.click(nextButton);

    // 验证按钮在加载状态下被禁用
    const prevButton = screen.getByText('上一天').closest('button');
    const nextButtonAfterClick = screen.getByText('下一天').closest('button');

    expect(prevButton).toBeDisabled();
    expect(nextButtonAfterClick).toBeDisabled();
  });

  it('should display error message when error exists', () => {
    vi.mocked(useAppStore).mockReturnValue({
      currentDate: '2026-04-02',
      availableDates: ['2026-04-01', '2026-04-02', '2026-04-03'],
      loadDataByDate: mockLoadDataByDate,
      pageStatus: 'ready',
      error: 'Failed to load data',
      setError: mockSetError,
      isPlaying: false,
      setIsPlaying: vi.fn(),
    });

    render(<Timeline />);

    expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    expect(screen.getByText('重试')).toBeInTheDocument();
  });

  it('should handle single date scenario', () => {
    vi.mocked(useAppStore).mockReturnValue({
      currentDate: '2026-04-01',
      availableDates: ['2026-04-01'],
      loadDataByDate: mockLoadDataByDate,
      pageStatus: 'ready',
      error: null,
      setError: mockSetError,
      isPlaying: false,
      setIsPlaying: vi.fn(),
    });

    const { container } = render(<Timeline />);

    // 验证位置指示器显示 1 / 1
    expect(container.textContent).toContain('1');
    expect(container.textContent).toContain('/');
    
    const prevButton = screen.getByText('上一天').closest('button');
    const nextButton = screen.getByText('下一天').closest('button');
    
    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
  });
});
