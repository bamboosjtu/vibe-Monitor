/** API 数据源类型. `datahub` is accepted only as a compatibility alias. */
export type DataSourceMode = 'monitor_backend' | 'datahub' | 'local'

export const DATA_SOURCE: DataSourceMode =
  (import.meta.env.VITE_DATA_SOURCE as DataSourceMode | undefined) ?? 'monitor_backend'

export const DATAHUB_BASE_URL =
  import.meta.env.VITE_DATAHUB_BASE_URL ?? 'http://localhost:8000'

export const MONITOR_BACKEND_URL =
  import.meta.env.VITE_MONITOR_BACKEND_URL ?? 'http://localhost:8001'

export const SANDBOX_SKELETON_LIMIT = Number(
  import.meta.env.VITE_SANDBOX_SKELETON_LIMIT ?? '10000',
)

/** API 配置 */
export interface ApiConfig {
  /** 数据源类型 */
  source: DataSourceMode;
  /** API 基础地址 */
  baseUrl: string;
  /** DataHub API 基础地址 */
  datahubBaseUrl: string;
  /** 请求超时时间（毫秒） */
  timeout: number;
}

function getEnvDataSource(): DataSourceMode {
  const source = import.meta.env.VITE_DATA_SOURCE as DataSourceMode | undefined;
  return normalizeDataSource(source);
}

export const DATAHUB_API_BASE_URL =
  import.meta.env.VITE_DATAHUB_BASE_URL ||
  'http://localhost:8000';

/** 默认配置 */
export const DEFAULT_API_CONFIG: ApiConfig = {
  source: getEnvDataSource(),
  baseUrl: MONITOR_BACKEND_URL,
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
  currentConfig = {
    ...currentConfig,
    ...config,
    source: normalizeDataSource(config.source ?? currentConfig.source),
  };
}

/** 切换数据源 */
export function setDataSource(source: DataSourceMode): void {
  currentConfig.source = normalizeDataSource(source);
}

export function normalizeDataSource(source: DataSourceMode | undefined): DataSourceMode {
  if (source === 'datahub') {
    return 'monitor_backend';
  }
  return source && ['monitor_backend', 'local'].includes(source)
    ? source
    : 'monitor_backend';
}
