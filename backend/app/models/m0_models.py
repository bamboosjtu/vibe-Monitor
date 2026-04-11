"""M0 最小数据表模型

包含：
- ImportBatch: 导入批次记录
- RawYearProgress: 年度目标原始数据
- RawTower: 杆塔原始数据
- RawMeetingSnapshot: meetlist 原始快照
- YearProgressCurrent: 年度目标当前生效视图
- TowerCurrent: 杆塔当前生效视图
- MeetingCurrent: meetlist 当前生效视图
"""

from datetime import datetime
from typing import Optional, List
from sqlmodel import Field, SQLModel, Column, JSON
from sqlalchemy import Text


# ==================== 导入批次 ====================

class ImportBatch(SQLModel, table=True):
    """导入批次记录表"""
    
    __tablename__ = "import_batch"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    batch_no: str = Field(
        index=True,
        unique=True,
        description="批次编号（自动生成）"
    )
    data_type: str = Field(
        description="数据类型：year_progress / tower / meeting"
    )
    source_file: Optional[str] = Field(
        default=None,
        description="源文件名"
    )
    total_records: int = Field(
        default=0,
        description="导入总记录数"
    )
    success_records: int = Field(
        default=0,
        description="成功导入记录数"
    )
    failed_records: int = Field(
        default=0,
        description="失败记录数"
    )
    skipped_records: int = Field(
        default=0,
        description="跳过记录数（当前为 0）"
    )
    unresolved_records: int = Field(
        default=0,
        description="未解析记录数（仅 year_progress_formation 适用）"
    )
    error_log: Optional[str] = Field(
        default=None,
        sa_column=Column(Text),
        description="错误日志"
    )
    status: str = Field(
        default="pending",
        description="状态：pending / processing / success / failed"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = Field(default=None)


# ==================== 年度目标数据 ====================

class RawYearProgress(SQLModel, table=True):
    """年度目标原始数据表"""
    
    __tablename__ = "raw_year_progress"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    import_batch_id: int = Field(
        foreign_key="import_batch.id",
        index=True,
        description="导入批次 ID"
    )
    # 原始数据保存为 JSON，保留源文件完整信息
    raw_data: str = Field(
        sa_column=Column(Text),
        description="原始数据 JSON"
    )
    # 索引字段（便于查询）
    prj_code: Optional[str] = Field(
        default=None,
        index=True,
        description="项目编码"
    )
    single_project_code: Optional[str] = Field(
        default=None,
        index=True,
        description="单项工程编码（M0 源数据中通常不存在，允许为空）"
    )
    source_code: Optional[str] = Field(
        default=None,
        index=True,
        description="源数据中的 code 列显示值"
    )
    year: Optional[int] = Field(
        default=None,
        index=True,
        description="年度"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)


class YearProgressCurrent(SQLModel, table=True):
    """年度目标当前生效视图表
    
    M0 主键降级策略：
    - 正式源数据 raw_data[*] 中没有 singleProjectCode
    - single_project_code 保留且允许为空（后续通过映射关系回填）
    - source_code 保存源数据中的 code（列显示值）
    - source_name 保存源数据中的 name（列显示值）
    - key_type 标记主键来源："resolved" 或 "source_code_fallback"
    - is_resolved 标记是否已解析为真正的 singleProjectCode
    """
    
    __tablename__ = "year_progress_current"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    prj_code: str = Field(
        index=True,
        description="项目编码"
    )
    single_project_code: Optional[str] = Field(
        default=None,
        index=True,
        description="单项工程编码（最小管理单元，M0 允许为空，后续映射回填）"
    )
    source_code: Optional[str] = Field(
        default=None,
        index=True,
        description="源数据中的 code 列显示值（M0 临时主键）"
    )
    source_name: Optional[str] = Field(
        default=None,
        description="源数据中的 name 列显示值"
    )
    key_type: str = Field(
        default="source_code_fallback",
        description="主键来源：resolved / source_code_fallback"
    )
    is_resolved: bool = Field(
        default=False,
        description="是否已解析为真正的 singleProjectCode"
    )
    single_project_type_name: Optional[str] = Field(
        default=None,
        description="单项工程类型（线路/变电）"
    )
    build_unit_code: Optional[str] = Field(default=None)
    build_unit_name: Optional[str] = Field(
        default=None,
        index=True,
        description="建管单位"
    )
    image_progress: Optional[str] = Field(
        default=None,
        description="形象进度（仅展示）"
    )
    jhkg_time: Optional[str] = Field(
        default=None,
        description="计划开工时间"
    )
    jhtc_time: Optional[str] = Field(
        default=None,
        description="计划投产时间"
    )
    # 其他字段保留为 JSON
    extra_data: Optional[str] = Field(
        default=None,
        sa_column=Column(Text),
        description="其他扩展字段"
    )
    import_batch_id: int = Field(
        foreign_key="import_batch.id",
        description="当前生效批次"
    )
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ==================== 线路数据（M1 新增）====================

class LineRaw(SQLModel, table=True):
    """线路原始数据表（由 tower 数据聚合生成）"""
    
    __tablename__ = "raw_line"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    import_batch_id: int = Field(
        foreign_key="import_batch.id",
        index=True,
        description="导入批次 ID"
    )
    single_project_code: str = Field(
        index=True,
        description="单项工程编码（线路标识）"
    )
    tower_codes: str = Field(
        sa_column=Column(Text),
        description="包含的杆塔编码 JSON 数组"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)


class LineCurrent(SQLModel, table=True):
    """线路当前生效视图表（M1 最小骨架用）
    
    线路不由独立源数据生成，而是从 tower_current 聚合：
    - 按 single_project_code 分组
    - 按 tower_sequence_no 排序
    - coords 字段存储按序排列的经纬度对列表 [[lon,lat], [lon,lat], ...]
    """
    
    __tablename__ = "line_current"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    single_project_code: str = Field(
        unique=True,
        index=True,
        description="单项工程编码（线路唯一标识）"
    )
    tower_count: int = Field(
        default=0,
        description="线路包含的杆塔数量"
    )
    coords: str = Field(
        sa_column=Column(Text),
        description="线路坐标序列 JSON: [[lon,lat], [lon,lat], ...]"
    )
    voltage_level: Optional[str] = Field(
        default=None,
        description="电压等级（从首个有坐标的杆塔推断）"
    )
    import_batch_id: int = Field(
        foreign_key="import_batch.id",
        description="当前生效批次"
    )
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ==================== 变电站数据（M1 Round2 新增）====================

class RawStation(SQLModel, table=True):
    """变电站原始数据表"""
    
    __tablename__ = "raw_station"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    import_batch_id: int = Field(
        foreign_key="import_batch.id",
        index=True,
        description="导入批次 ID"
    )
    raw_data: str = Field(
        sa_column=Column(Text),
        description="原始数据 JSON"
    )
    # 索引字段
    single_project_code: Optional[str] = Field(
        default=None,
        index=True,
        description="单项工程编码"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)


class StationCurrent(SQLModel, table=True):
    """变电站当前生效视图表（M1 Round2）
    
    数据源：data/substation_coordinates/*.json
    字段说明：
    - single_project_code: 主键，来自 singleProjectCode
    - prj_code: 项目编码，来自 prjCode
    - longitude/latitude: 坐标
    - name: 显示名，使用 single_project_code（源数据无独立 name 字段）
    """
    
    __tablename__ = "station_current"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    single_project_code: str = Field(
        unique=True,
        index=True,
        description="单项工程编码（主键）"
    )
    prj_code: Optional[str] = Field(
        default=None,
        description="项目编码"
    )
    name: Optional[str] = Field(
        default=None,
        description="显示名（使用 single_project_code）"
    )
    longitude: Optional[float] = Field(
        default=None,
        description="经度"
    )
    latitude: Optional[float] = Field(
        default=None,
        description="纬度"
    )
    import_batch_id: int = Field(
        foreign_key="import_batch.id",
        description="当前生效批次"
    )
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ==================== 杆塔数据 ====================

class RawTower(SQLModel, table=True):
    """杆塔原始数据表"""
    
    __tablename__ = "raw_tower"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    import_batch_id: int = Field(
        foreign_key="import_batch.id",
        index=True,
        description="导入批次 ID"
    )
    raw_data: str = Field(
        sa_column=Column(Text),
        description="原始数据 JSON"
    )
    # 索引字段
    single_project_code: Optional[str] = Field(
        default=None,
        index=True,
        description="单项工程编码"
    )
    tower_no: Optional[str] = Field(
        default=None,
        description="杆塔编号"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TowerCurrent(SQLModel, table=True):
    """杆塔当前生效视图表"""
    
    __tablename__ = "tower_current"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    single_project_code: str = Field(
        index=True,
        description="单项工程编码"
    )
    tower_no: str = Field(
        index=True,
        description="杆塔编号"
    )
    tower_sequence_no: Optional[int] = Field(
        default=None,
        index=True,
        description="杆塔序号（线路排序用）"
    )
    upstream_tower_no: Optional[str] = Field(
        default=None,
        description="上游塔号"
    )
    longitude_edit: Optional[float] = Field(
        default=None,
        description="经度"
    )
    latitude_edit: Optional[float] = Field(
        default=None,
        description="纬度"
    )
    bidding_section_code: Optional[str] = Field(
        default=None,
        description="标段编码"
    )
    # 其他字段保留为 JSON
    extra_data: Optional[str] = Field(
        default=None,
        sa_column=Column(Text),
        description="其他扩展字段"
    )
    import_batch_id: int = Field(
        foreign_key="import_batch.id",
        description="当前生效批次"
    )
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ==================== meetlist 数据 ====================

class RawMeetingSnapshot(SQLModel, table=True):
    """meetlist 原始快照表"""
    
    __tablename__ = "raw_meeting_snapshot"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    import_batch_id: int = Field(
        foreign_key="import_batch.id",
        index=True,
        description="导入批次 ID"
    )
    raw_data: str = Field(
        sa_column=Column(Text),
        description="原始数据 JSON"
    )
    # 索引字段
    meeting_id: Optional[str] = Field(
        default=None,
        index=True,
        description="作业点稳定主键"
    )
    single_project_code: Optional[str] = Field(
        default=None,
        index=True,
        description="单项工程编码"
    )
    capture_time: Optional[str] = Field(
        default=None,
        description="采集时间"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MeetingCurrent(SQLModel, table=True):
    """meetlist 当前生效视图表"""
    
    __tablename__ = "meeting_current"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    meeting_id: str = Field(
        unique=True,
        index=True,
        description="作业点稳定主键"
    )
    single_project_code: Optional[str] = Field(
        default=None,
        index=True,
        description="单项工程编码"
    )
    prj_name: Optional[str] = Field(default=None, description="项目名称")
    prj_code: Optional[str] = Field(default=None, description="项目编码")
    ticket_id: Optional[str] = Field(default=None, description="作业票ID")
    ticket_no: Optional[str] = Field(default=None, description="作业票号")
    ticket_name: Optional[str] = Field(default=None, description="作业票名称")
    
    # 位置信息
    tool_box_talk_address: Optional[str] = Field(default=None, description="地址")
    tool_box_talk_longitude: Optional[str] = Field(default=None, description="经度")
    tool_box_talk_latitude: Optional[str] = Field(default=None, description="纬度")
    
    # 作业信息
    re_assessment_risk_level: Optional[int] = Field(default=None, description="风险等级")
    current_constr_headcount: Optional[int] = Field(default=None, description="作业人数")
    current_construction_status: Optional[str] = Field(default=None, description="作业状态")
    voltage_level: Optional[str] = Field(default=None, description="电压等级")
    
    # 单位信息
    construction_unit_name: Optional[str] = Field(default=None, description="施工单位")
    supervision_unit_name: Optional[str] = Field(default=None, description="监理单位")
    build_unit_name: Optional[str] = Field(default=None, description="建管单位")
    
    # 人员信息
    leader_name: Optional[str] = Field(default=None, description="工作负责人")
    work_procedure: Optional[str] = Field(default=None, description="作业内容")
    work_site_name: Optional[str] = Field(default=None, description="作业地点")
    
    # 时间信息
    current_constr_date: Optional[str] = Field(default=None, description="作业日期")
    work_start_time: Optional[str] = Field(default=None, description="开始时间")
    
    import_batch_id: int = Field(
        foreign_key="import_batch.id",
        description="当前生效批次"
    )
    updated_at: datetime = Field(default_factory=datetime.utcnow)
