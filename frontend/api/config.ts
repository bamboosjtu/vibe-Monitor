/** API 数据源类型 */
export type DataSourceType = 'mock' | 'api';

/** API 配置 */
export interface ApiConfig {
  /** 数据源类型 */
  source: DataSourceType;
  /** API 基础地址 */
  baseUrl: string;
  /** 请求超时时间（毫秒） */
  timeout: number;
}

/** 默认配置 */
export const DEFAULT_API_CONFIG: ApiConfig = {
  source: 'api',
  baseUrl: 'http://localhost:8001',
  timeout: 10000,
};

let currentConfig: ApiConfig = { ...DEFAULT_API_CONFIG };

/** 获取当前配置 */
export function getApiConfig(): ApiConfig {
  return { ...currentConfig };
}

/** 更新配置 */
export function setApiConfig(config: Partial<ApiConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/** 切换数据源 */
export function setDataSource(source: DataSourceType): void {
  currentConfig.source = source;
}
