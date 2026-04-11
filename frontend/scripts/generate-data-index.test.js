import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 模拟 generate-data-index.js 的核心函数
// 由于原脚本是直接执行的，这里提取核心逻辑进行测试

function extractDateFromFilename(filename) {
  const FILE_PATTERN = /^meeting_(\d{8})_all\.json$/;
  const match = filename.match(FILE_PATTERN);
  if (!match) return null;
  
  const digits = match[1];
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  
  const date = new Date(`${year}-${month}-${day}`);
  if (isNaN(date.getTime())) return null;
  
  return `${year}-${month}-${day}`;
}

function scanDirectory(files) {
  const dates = [];
  
  for (const file of files) {
    const date = extractDateFromFilename(file);
    if (date) {
      dates.push(date);
    }
  }
  
  return [...new Set(dates)].sort();
}

describe('generate-data-index', () => {
  describe('extractDateFromFilename', () => {
    it('should extract date from valid meeting filename', () => {
      expect(extractDateFromFilename('meeting_20260401_all.json')).toBe('2026-04-01');
      expect(extractDateFromFilename('meeting_20261231_all.json')).toBe('2026-12-31');
    });

    it('should return null for invalid filenames', () => {
      expect(extractDateFromFilename('20260401.json')).toBeNull();
      expect(extractDateFromFilename('meeting_20260401.json')).toBeNull();
      expect(extractDateFromFilename('hunan_boundary.json')).toBeNull();
      expect(extractDateFromFilename('index.json')).toBeNull();
      expect(extractDateFromFilename('meeting_detail_schema.json')).toBeNull();
    });
  });

  describe('scanDirectory', () => {
    it('should only recognize meeting_YYYYMMDD_all.json files', () => {
      const files = [
        'meeting_20260401_all.json',
        'meeting_20260402_all.json',
        'hunan_boundary.json',
        'index.json',
        'meeting_detail_schema.json',
        '20260403.json', // 不符合规范
      ];
      
      const dates = scanDirectory(files);
      expect(dates).toHaveLength(2);
      expect(dates).toContain('2026-04-01');
      expect(dates).toContain('2026-04-02');
      expect(dates).not.toContain('2026-04-03');
    });

    it('should automatically sort dates in ascending order', () => {
      const files = [
        'meeting_20260405_all.json',
        'meeting_20260401_all.json',
        'meeting_20260403_all.json',
      ];
      
      const dates = scanDirectory(files);
      expect(dates).toEqual(['2026-04-01', '2026-04-03', '2026-04-05']);
    });

    it('should automatically deduplicate dates', () => {
      const files = [
        'meeting_20260401_all.json',
        'meeting_20260401_all.json', // 重复
        'meeting_20260402_all.json',
      ];
      
      const dates = scanDirectory(files);
      expect(dates).toHaveLength(2);
      expect(dates).toEqual(['2026-04-01', '2026-04-02']);
    });

    it('should return empty array when no valid files', () => {
      const files = [
        'hunan_boundary.json',
        'index.json',
        'readme.txt',
      ];
      
      const dates = scanDirectory(files);
      expect(dates).toHaveLength(0);
    });
  });
});
