// 湖南省各市州列表（与数据中 buildUnitName 保持一致）
export const CITIES = [
  '长沙',
  '株洲',
  '湘潭',
  '衡阳',
  '邵阳',
  '岳阳',
  '常德',
  '张家界',
  '益阳',
  '郴州',
  '永州',
  '怀化',
  '娄底',
  '湘西',
  '建设分公司',
] as const;

// 电压等级
export const VOLTAGE_LEVELS = [
  '1000kV',
  '±800kV',
  '500kV',
  '220kV',
  '110kV',
  '35kV',
  '10kV',
] as const;

// 页面状态
export const PAGE_STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  ERROR: 'error',
  EMPTY: 'empty',
  FILTERED_EMPTY: 'filtered_empty',
} as const;

export type PageStatus = typeof PAGE_STATUS[keyof typeof PAGE_STATUS];
