/** API 数据源类型 */
export type DataSourceMode = 'datahub' | 'local' | 'legacy-api'

export const DATA_SOURCE: DataSourceMode =
  (import.meta.env.VITE_DATA_SOURCE as DataSourceMode | undefined) ?? 'datahub'

export const DATAHUB_BASE_URL =
  import.meta.env.VITE_DATAHUB_BASE_URL ?? 'http://localhost:8000'

export const SANDBOX_SKELETON_LIMIT = Number(
  import.meta.env.VITE_SANDBOX_SKELETON_LIMIT ?? '10000',
)

export type DataSourceType = 'mock' | 'api' | 'local' | 'datahub';

/** API 配置 */
export interface ApiConfig {
  /** 数据源类型 */
  source: DataSourceType;
  /** API 基础地址 */
  baseUrl: string;
  /** DataHub API 基础地址 */
  datahubBaseUrl: string;
  /** 请求超时时间（毫秒） */
  timeout: number;
}

function getEnvDataSource(): DataSourceType {
  const source = import.meta.env.VITE_DATA_SOURCE as DataSourceType | undefined;
  return source && ['mock', 'api', 'local', 'datahub'].includes(source)
    ? source
    : 'local';
}

export const DATAHUB_API_BASE_URL =
  import.meta.env.VITE_DATAHUB_BASE_URL ||
  import.meta.env.VITE_DATAHUB_API_BASE_URL ||
  'http://localhost:8000';

/** 默认配置 */
export const DEFAULT_API_CONFIG: ApiConfig = {
  source: getEnvDataSource(),
  baseUrl: 'http://localhost:8001',
  datahubBaseUrl: DATAHUB_API_BASE_URL,
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
