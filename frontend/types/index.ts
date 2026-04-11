// ============================================
// 原始数据类型（来自 JSON 的原始记录）
// 基于 20260401.json 真实数据结构定义
// ============================================

export interface RawStationMeeting {
  id: string;
  prjName: string;
  prjCode: string | null;
  ticketId: string;
  ticketNo: string;
  ticketName: string;
  reAssessmentRiskLevel: number | null;
  reAssessmentRiskLevelChines: string | null;
  currentConstrHeadcount: number | null;
  constructionHeadcount: number | null;
  currentConstrDate: string;
  workStartTime: string;
  currentConstructionStatus: string;
  workOvernightFlag: number;
  toolBoxTalkAddress: string;
  toolBoxTalkLongitude: string | null;
  toolBoxTalkLatitude: string | null;
  biddingSectionCode: string;
  biddingSectionName: string;
  singleProjectCode: string;
  singleProjectName: string;
  constructionUnitName: string;
  supervisionUnitName: string;
  voltageLevel: string;
  buildUnitCode: string;
  buildUnitName: string;
  provinceCode: string;
  provinceName: string;
  leaderName: string;
  workProcedure: string;
  workSiteName: string;
  lonAndLatString: string | null;
}

// 分页信息
export interface PageInfo {
  page_no: number;
  list_length: number;
  total: number;
  summary: {
    total: number;
    list_length: number;
  };
}

// 原始 JSON 根结构（支持新旧两种格式）
// 新格式：包含 raw_data 数组和 query 对象
// 旧格式：包含 list 数组
export interface RawDataResponse {
  // 新格式字段
  page_name?: string;
  page_route?: string;
  script?: string;
  script_category?: string;
  source_type?: string;
  result_state?: string;
  mode?: string;
  primary_api?: string;
  query?: {
    date?: string;
    status?: string;
    province_code?: string;
    prj_code?: string;
    page_size?: number;
  };
  page_size?: number;
  summary?: {
    total: number;
    list_length: number;
    page_count?: number;
  };
  raw_data?: RawStationMeeting[];
  
  // 旧格式字段（保持兼容）
  http_status?: number;
  has_encryptData?: boolean;
  decrypt_mode?: string;
  digest_match?: boolean;
  date?: string;
  status_filter?: string;
  pages?: PageInfo[];
  total?: number;
  list?: RawStationMeeting[];
}

// ============================================
// 归一化后的数据类型（清洗后的标准记录）
// ============================================

// 风险等级：1-4=风险等级（1最高，4最低），unknown=未知
// 业务语义：一级风险(1)=最高风险，四级风险(4)=较低风险
// 说明：真实数据中 reAssessmentRiskLevel 取值范围为 1-4 或 null，不存在 0 值
// 保留 0 在类型中是为了代码兼容性，但数据中不会出现
export type RiskLevel = 0 | 1 | 2 | 3 | 4 | 'unknown';

// 作业状态
export type WorkStatus = 'working' | 'paused' | 'finished' | 'unknown';

// 电压等级编码映射
// 真实数据中发现取值：AC00351(35kV), AC01101(110kV), AC02201(220kV), AC05001(500kV)
export type VoltageLevelCode = 
  | 'AC10001'  // 1000kV
  | 'DC00801'  // ±800kV
  | 'AC05001'  // 500kV
  | 'AC02201'  // 220kV
  | 'AC01101'  // 110kV
  | 'AC00351'  // 35kV
  | 'AC00010'  // 10kV
  | 'unknown';

// 清洗归一化后的站班会记录
export interface NormalizedStationMeeting {
  // 原始 ID
  id: string;
  
  // 工程信息
  projectName: string;
  projectCode: string | null;
  
  // 作业票信息
  ticketId: string;
  ticketNo: string;
  ticketName: string;
  
  // 位置信息
  address: string;
  longitude: number;
  latitude: number;
  city: string;
  
  // 人员信息
  personCount: number;
  personCountDisplay: number;
  leaderName: string;
  
  // 风险与状态
  riskLevel: RiskLevel;
  workStatus: WorkStatus;
  
  // 电压等级
  voltageLevel: VoltageLevelCode;
  voltageLevelName: string;
  
  // 单位信息
  constructionUnit: string;
  supervisionUnit: string;
  
  // 作业内容
  workProcedure: string;
  workSiteName: string;
  
  // 时间信息
  workDate: string;
  workStartTime: string;
}

// ============================================
// 筛选条件类型
// ============================================

export interface FilterState {
  // 作业状态（单选）
  workStatus: WorkStatus | 'all';
  
  // 风险等级（多选）
  riskLevels: RiskLevel[];
  
  // 市州（多选）
  cities: string[];
  
  // 电压等级（多选）- 存储的是显示名称（如 '35kV'）
  voltageLevels: string[];
}

// ============================================
// 页面状态类型
// ============================================

export type PageStatus = 
  | 'idle'       // 初始状态
  | 'loading'    // 加载中
  | 'error'      // 加载错误
  | 'empty'      // 数据为空
  | 'filtered_empty' // 筛选结果为空
  | 'ready';     // 数据就绪

// ============================================
// 数据清洗结果统计
// ============================================

export interface DataParseStats {
  totalRawRecords: number;
  validCoordinateRecords: number;
  filteredRecords: number;
  filterReasons: {
    emptyCoordinates: number;
    invalidCoordinates: number;
    outOfBounds: number;
    zeroCoordinates: number;
  };
}
