import { describe, it, expect } from 'vitest';
import {
  buildDataUrl,
  parseDateFromFilename,
  getNextDate,
  getPrevDate,
  getLatestDate,
  hasDataForDate,
} from './dateDataLoader';

describe('dateDataLoader', () => {
  describe('buildDataUrl', () => {
    it('should build correct URL for YYYY-MM-DD format', () => {
      expect(buildDataUrl('2026-04-01')).toBe('/data/daily_meeting/meeting_20260401_all.json');
      expect(buildDataUrl('2026-12-31')).toBe('/data/daily_meeting/meeting_20261231_all.json');
    });

    it('should build correct URL for YYYYMMDD format', () => {
      expect(buildDataUrl('20260401')).toBe('/data/daily_meeting/meeting_20260401_all.json');
    });
  });

  describe('parseDateFromFilename', () => {
    it('should extract date from valid filename', () => {
      expect(parseDateFromFilename('meeting_20260401_all.json')).toBe('2026-04-01');
      expect(parseDateFromFilename('meeting_20261231_all.json')).toBe('2026-12-31');
    });

    it('should return null for invalid filenames', () => {
      expect(parseDateFromFilename('20260401.json')).toBeNull();
      expect(parseDateFromFilename('meeting_20260401.json')).toBeNull();
      expect(parseDateFromFilename('meeting_20260401_all.txt')).toBeNull();
      expect(parseDateFromFilename('hunan_boundary.json')).toBeNull();
      expect(parseDateFromFilename('index.json')).toBeNull();
    });
  });

  describe('getNextDate', () => {
    const dates = ['2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-05'];

    it('should return next date when not at end', () => {
      expect(getNextDate('2026-04-01', dates)).toBe('2026-04-02');
      expect(getNextDate('2026-04-03', dates)).toBe('2026-04-04');
    });

    it('should return null when at last date', () => {
      expect(getNextDate('2026-04-05', dates)).toBeNull();
    });

    it('should return null when date not in list', () => {
      expect(getNextDate('2026-04-10', dates)).toBeNull();
    });
  });

  describe('getPrevDate', () => {
    const dates = ['2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-05'];

    it('should return previous date when not at start', () => {
      expect(getPrevDate('2026-04-05', dates)).toBe('2026-04-04');
      expect(getPrevDate('2026-04-03', dates)).toBe('2026-04-02');
    });

    it('should return null when at first date', () => {
      expect(getPrevDate('2026-04-01', dates)).toBeNull();
    });

    it('should return null when date not in list', () => {
      expect(getPrevDate('2026-03-31', dates)).toBeNull();
    });
  });

  describe('getLatestDate', () => {
    it('should return last date from sorted array', () => {
      expect(getLatestDate(['2026-04-01', '2026-04-02', '2026-04-03'])).toBe('2026-04-03');
      expect(getLatestDate(['2026-04-01'])).toBe('2026-04-01');
    });

    it('should return null for empty array', () => {
      expect(getLatestDate([])).toBeNull();
    });
  });

  describe('hasDataForDate', () => {
    const dates = ['2026-04-01', '2026-04-02', '2026-04-03'];

    it('should return true for existing date', () => {
      expect(hasDataForDate('2026-04-01', dates)).toBe(true);
      expect(hasDataForDate('2026-04-02', dates)).toBe(true);
    });

    it('should return false for non-existing date', () => {
      expect(hasDataForDate('2026-04-10', dates)).toBe(false);
      expect(hasDataForDate('2026-03-31', dates)).toBe(false);
    });
  });
});
