"""统一响应结构与错误码"""

from datetime import datetime
from typing import Optional, Generic, TypeVar
from pydantic import BaseModel

T = TypeVar('T')


# ==================== 统一响应结构 ====================

class ApiResponse(BaseModel, Generic[T]):
    """统一 API 响应结构"""
    
    code: int = 0
    message: str = "success"
    data: Optional[T] = None
    timestamp: datetime = datetime.utcnow()


class PaginatedResponse(BaseModel, Generic[T]):
    """分页响应结构"""
    
    total: int
    page_no: int
    page_size: int
    items: list[T]


# ==================== 错误码定义 ====================

class ErrorCode:
    """错误码常量"""
    
    SUCCESS = 0
    BAD_REQUEST = 400
    UNAUTHORIZED = 401
    FORBIDDEN = 403
    NOT_FOUND = 404
    INTERNAL_ERROR = 500
    
    # 业务错误码（1000+）
    IMPORT_FAILED = 1001
    DATA_VALIDATION_FAILED = 1002
    FILE_FORMAT_ERROR = 1003
    DATA_NOT_FOUND = 1004


class ErrorResponse(BaseModel):
    """错误响应结构"""
    
    code: int
    message: str
    details: Optional[str] = None
    timestamp: datetime = datetime.utcnow()


# ==================== 导入相关 Schema ====================

class ImportResult(BaseModel):
    """导入结果（M0 第二轮统一结构）
    
    字段口径：
    - total_count: 原始文件中的总记录数
    - success_count: 成功写入 raw + current 的记录数
    - failed_count: 因校验失败无法落库的记录数
    - skipped_count: 因主键重复或其他原因被跳过的记录数（当前为 0）
    - unresolved_count: 成功写入但未解析的记录数（仅 year_progress_formation 适用）
    """
    
    batch_no: str
    data_type: str
    total_count: int
    success_count: int
    failed_count: int
    skipped_count: int = 0
    unresolved_count: int = 0
    status: str
    error_log: Optional[str] = None


class ImportResponse(BaseModel):
    """导入 API 响应"""
    
    code: int = 0
    message: str = "导入成功"
    data: Optional[ImportResult] = None


# ==================== 地图摘要 Schema ====================

class MapSummaryItem(BaseModel):
    """地图摘要项（来自 meeting_current 表）
    
    字段口径说明：
    - id: meeting_current.meeting_id（站班会记录 ID）
    - project_name: meeting_current.prj_name
    - longitude: meeting_current.tool_box_talk_longitude（站班会经度）
    - latitude: meeting_current.tool_box_talk_latitude（站班会纬度）
    - risk_level: meeting_current.re_assessment_risk_level（风险评估等级）
    - person_count: meeting_current.current_constr_headcount（施工人数）
    - work_status: meeting_current.current_construction_status（当前施工状态）
      注：当前返回原始编码值（如 "03"），M1 阶段统一映射为中文标签
    - city: meeting_current.build_unit_name（建管单位）
    """
    
    id: str
    project_name: Optional[str] = None
    longitude: Optional[float] = None
    latitude: Optional[float] = None
    risk_level: Optional[int] = None
    person_count: Optional[int] = None
    work_status: Optional[str] = None
    city: Optional[str] = None


class MapSummaryResponse(BaseModel):
    """地图摘要响应"""
    
    total_points: int
    data: list[MapSummaryItem]


# ==================== Bootstrap Schema ====================

class BootstrapInfo(BaseModel):
    """系统启动信息"""
    
    app_name: str
    app_version: str
    db_initialized: bool
    has_year_progress_data: bool
    has_tower_data: bool
    has_meeting_data: bool
    latest_import_time: Optional[str] = None
    total_import_batches: int = 0
