/**
 * API 客户端
 * 
 * 提供：
 * - 统一请求封装
 * - mock/api 切换
 * - 错误处理
 */

import { getApiConfig } from './config';

/** API 响应结构 */
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
  timestamp: string;
}

/** 通用请求选项 */
interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

/**
 * 统一请求方法
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const config = getApiConfig();
  
  // 如果是 mock 模式，返回空数据
  if (config.source === 'mock') {
    console.warn(`[API] Mock 模式，跳过请求: ${path}`);
    return {} as T;
  }
  
  const url = `${config.baseUrl}${path}`;
  
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  const fetchOptions: RequestInit = {
    method: options.method || 'GET',
    headers: { ...defaultHeaders, ...options.headers },
    signal: AbortSignal.timeout(config.timeout),
  };
  
  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }
  
  try {
    const response = await fetch(url, fetchOptions);
    
    if (!response.ok) {
      throw new Error(`请求失败: ${response.status} ${response.statusText}`);
    }
    
    const result: ApiResponse<T> = await response.json();
    
    if (result.code !== 0) {
      throw new Error(result.message || '未知错误');
    }
    
    return result.data;
  } catch (error) {
    console.error(`[API] 请求失败: ${path}`, error);
    throw error;
  }
}

/**
 * GET 请求
 */
export function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

/**
 * POST 请求
 */
export function post<T>(path: string, body?: any): Promise<T> {
  return request<T>(path, { method: 'POST', body });
}

/**
 * 文件上传
 */
export async function uploadFile<T>(path: string, file: File): Promise<T> {
  const config = getApiConfig();
  
  if (config.source === 'mock') {
    console.warn(`[API] Mock 模式，跳过上传: ${path}`);
    return {} as T;
  }
  
  const formData = new FormData();
  formData.append('file', file);
  
  const url = `${config.baseUrl}${path}`;
  
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(config.timeout),
  });
  
  if (!response.ok) {
    throw new Error(`上传失败: ${response.status} ${response.statusText}`);
  }
  
  const result: ApiResponse<T> = await response.json();
  
  if (result.code !== 0) {
    throw new Error(result.message || '未知错误');
  }
  
  return result.data;
}
