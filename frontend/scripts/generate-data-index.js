#!/usr/bin/env node

/**
 * 自动生成数据日期清单脚本
 * 
 * 功能：
 * - 扫描 data/daily_meeting/ 目录
 * - 识别 meeting_YYYYMMDD_all.json 格式的文件
 * - 提取日期并生成 public/data/daily_meeting/index.json
 * 
 * 使用：
 * node scripts/generate-data-index.js
 * 或 npm run generate:data-index
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件目录（ES Module 兼容）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
// 数据源目录：仓库根目录下的 data/daily_meeting/ 文件夹
const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'daily_meeting');
// 输出文件：frontend/public/data/daily_meeting/index.json（供前端访问）
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'data', 'daily_meeting', 'index.json');
const FILE_PATTERN = /^meeting_(\d{8})_all\.json$/;

/**
 * 从文件名提取日期
 * @param {string} filename - 文件名
 * @returns {string|null} - YYYY-MM-DD 格式日期或 null
 */
function extractDateFromFilename(filename) {
  const match = filename.match(FILE_PATTERN);
  if (!match) return null;
  
  const digits = match[1];
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  
  // 验证日期有效性
  const date = new Date(`${year}-${month}-${day}`);
  if (isNaN(date.getTime())) return null;
  
  return `${year}-${month}-${day}`;
}

/**
 * 扫描目录获取日期列表
 * @param {string} dir - 目录路径
 * @returns {string[]} - 日期列表（已排序）
 */
function scanDirectory(dir) {
  try {
    const files = fs.readdirSync(dir);
    const dates = [];
    
    for (const file of files) {
      // 只处理文件，跳过目录
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) continue;
      
      // 提取日期
      const date = extractDateFromFilename(file);
      if (date) {
        dates.push(date);
      }
    }
    
    // 去重并排序
    return [...new Set(dates)].sort();
  } catch (error) {
    console.error(`[Error] 扫描目录失败: ${error.message}`);
    return [];
  }
}

/**
 * 生成 index.json 内容
 * @param {string[]} dates - 日期列表
 * @returns {object} - index.json 对象
 */
function generateIndexContent(dates) {
  const today = new Date();
  const lastUpdated = today.toISOString().split('T')[0];
  
  return {
    dates,
    meta: {
      description: '输变电工程数字沙盘系统 - 可用数据日期清单',
      format: 'YYYY-MM-DD',
      lastUpdated,
    },
  };
}

/**
 * 主函数
 */
function main() {
  console.log('[Generate Data Index] 开始生成日期清单...');
  console.log(`[Generate Data Index] 扫描目录: ${DATA_DIR}`);
  
  // 检查目录是否存在
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`[Error] 数据目录不存在: ${DATA_DIR}`);
    process.exit(1);
  }
  
  // 扫描目录
  const dates = scanDirectory(DATA_DIR);
  console.log(`[Generate Data Index] 发现 ${dates.length} 个日期文件`);
  
  if (dates.length > 0) {
    console.log(`[Generate Data Index] 日期列表: ${dates.join(', ')}`);
  } else {
    console.warn('[Generate Data Index] 警告: 未发现符合格式的数据文件');
    console.warn('[Generate Data Index] 期望格式: meeting_YYYYMMDD_all.json');
  }
  
  // 生成内容
  const indexContent = generateIndexContent(dates);
  
  // 写入文件
  try {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(indexContent, null, 2) + '\n', 'utf-8');
    console.log(`[Generate Data Index] 成功生成: ${OUTPUT_FILE}`);
    console.log(`[Generate Data Index] 时间范围: ${dates.length > 0 ? dates[0] + ' 至 ' + dates[dates.length - 1] : '无'}`);
  } catch (error) {
    console.error(`[Error] 写入文件失败: ${error.message}`);
    process.exit(1);
  }
  
  console.log('[Generate Data Index] 完成!');
}

// 执行
main();
