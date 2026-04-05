import type {
  RawStationMeeting,
  RawDataResponse,
  NormalizedStationMeeting,
  RiskLevel,
  WorkStatus,
  VoltageLevelCode,
  DataParseStats,
} from '@/types';

// 湖南省边界范围
const HUNAN_BOUNDS = {
  minLng: 108.6,
  maxLng: 114.3,
  minLat: 24.6,
  maxLat: 30.2,
};

// 电压等级编码映射表
const VOLTAGE_LEVEL_MAP: Record<string, { code: VoltageLevelCode; name: string }> = {
  'AC10001': { code: 'AC10001', name: '1000kV' },
  'DC00801': { code: 'DC00801', name: '±800kV' },
  'AC05001': { code: 'AC05001', name: '500kV' },
  'AC02201': { code: 'AC02201', name: '220kV' },
  'AC01101': { code: 'AC01101', name: '110kV' },
  'AC00351': { code: 'AC00351', name: '35kV' },
  'AC00010': { code: 'AC00010', name: '10kV' },
};

// 作业状态编码映射表
const WORK_STATUS_MAP: Record<string, WorkStatus> = {
  '01': 'working',
  '02': 'paused',
  '03': 'finished',
};

// 坐标合法性校验
function validateCoordinate(
  raw: RawStationMeeting
): { valid: false; reason: string } | { valid: true; lng: number; lat: number } {
  if (!raw.toolBoxTalkLongitude || !raw.toolBoxTalkLatitude) {
    return { valid: false, reason: 'emptyCoordinates' };
  }

  const lng = parseFloat(raw.toolBoxTalkLongitude);
  const lat = parseFloat(raw.toolBoxTalkLatitude);

  if (isNaN(lng) || isNaN(lat)) {
    return { valid: false, reason: 'invalidCoordinates' };
  }

  if (lng === 0 || lat === 0) {
    return { valid: false, reason: 'zeroCoordinates' };
  }

  if (
    lng < HUNAN_BOUNDS.minLng ||
    lng > HUNAN_BOUNDS.maxLng ||
    lat < HUNAN_BOUNDS.minLat ||
    lat > HUNAN_BOUNDS.maxLat
  ) {
    return { valid: false, reason: 'outOfBounds' };
  }

  return { valid: true, lng, lat };
}

// 人数归一化
function normalizePersonCount(raw: RawStationMeeting): { count: number; display: number } {
  const rawCount = raw.currentConstrHeadcount ?? raw.constructionHeadcount ?? 0;

  if (rawCount === null || rawCount === undefined || isNaN(rawCount) || rawCount < 0) {
    return { count: 0, display: 0 };
  }

  const display = rawCount;
  const count = rawCount > 300 ? 300 : rawCount;

  return { count, display };
}

// 风险等级归一化
function normalizeRiskLevel(raw: RawStationMeeting): RiskLevel {
  const level = raw.reAssessmentRiskLevel;

  if (level === null || level === undefined || isNaN(level)) {
    return 'unknown';
  }

  if (level >= 1 && level <= 4) {
    return level as RiskLevel;
  }

  return 'unknown';
}

// 作业状态归一化
function normalizeWorkStatus(raw: RawStationMeeting): WorkStatus {
  const status = raw.currentConstructionStatus;

  if (status && WORK_STATUS_MAP[status]) {
    return WORK_STATUS_MAP[status];
  }

  return 'unknown';
}

// 电压等级归一化
function normalizeVoltageLevel(
  raw: RawStationMeeting
): { code: VoltageLevelCode; name: string } {
  const level = raw.voltageLevel;

  if (level && VOLTAGE_LEVEL_MAP[level]) {
    return VOLTAGE_LEVEL_MAP[level];
  }

  return { code: 'unknown', name: '未知' };
}

// 市州提取
function extractCity(raw: RawStationMeeting): string {
  if (raw.buildUnitName) {
    return raw.buildUnitName;
  }

  const address = raw.toolBoxTalkAddress || '';
  const match = address.match(/湖南省(.+?)(市|州)/);
  if (match) {
    return match[1] + match[2];
  }

  return '其他';
}

// 单条记录清洗归一化
function normalizeRecord(
  raw: RawStationMeeting
): { valid: false; reason: string } | { valid: true; record: NormalizedStationMeeting } {
  const coordResult = validateCoordinate(raw);
  if (!coordResult.valid) {
    return { valid: false, reason: coordResult.reason };
  }

  const personCount = normalizePersonCount(raw);
  const riskLevel = normalizeRiskLevel(raw);
  const workStatus = normalizeWorkStatus(raw);
  const voltageLevel = normalizeVoltageLevel(raw);
  const city = extractCity(raw);

  const normalized: NormalizedStationMeeting = {
    id: raw.id,
    projectName: raw.prjName,
    projectCode: raw.prjCode,
    ticketId: raw.ticketId,
    ticketNo: raw.ticketNo,
    ticketName: raw.ticketName,
    address: raw.toolBoxTalkAddress,
    longitude: coordResult.lng,
    latitude: coordResult.lat,
    city,
    personCount: personCount.count,
    personCountDisplay: personCount.display,
    leaderName: raw.leaderName,
    riskLevel,
    workStatus,
    voltageLevel: voltageLevel.code,
    voltageLevelName: voltageLevel.name,
    constructionUnit: raw.constructionUnitName,
    supervisionUnit: raw.supervisionUnitName,
    workProcedure: raw.workProcedure,
    workSiteName: raw.workSiteName,
    workDate: raw.currentConstrDate,
    workStartTime: raw.workStartTime,
  };

  return { valid: true, record: normalized };
}

// 主入口：解析并清洗数据
export function parseAndNormalizeData(
  rawData: RawDataResponse
): {
  records: NormalizedStationMeeting[];
  stats: DataParseStats;
} {
  const rawList = rawData.list || [];

  const stats: DataParseStats = {
    totalRawRecords: rawList.length,
    validCoordinateRecords: 0,
    filteredRecords: 0,
    filterReasons: {
      emptyCoordinates: 0,
      invalidCoordinates: 0,
      outOfBounds: 0,
      zeroCoordinates: 0,
    },
  };

  const records: NormalizedStationMeeting[] = [];

  for (const raw of rawList) {
    const result = normalizeRecord(raw);

    if (result.valid) {
      records.push(result.record);
      stats.validCoordinateRecords++;
    } else {
      stats.filteredRecords++;
      stats.filterReasons[result.reason as keyof typeof stats.filterReasons]++;
    }
  }

  return { records, stats };
}

// 加载数据文件
export async function loadDataFile(url: string): Promise<RawDataResponse> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load data: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.list || !Array.isArray(data.list)) {
    throw new Error('Invalid data format: missing list array');
  }

  return data as RawDataResponse;
}
