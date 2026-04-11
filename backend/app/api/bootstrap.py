"""系统启动信息路由"""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func

from app.core.db import get_session
from app.models.m0_models import ImportBatch, RawYearProgress, RawTower, RawMeetingSnapshot, YearProgressCurrent
from app.schemas.responses import BootstrapInfo, ApiResponse

router = APIRouter()


@router.get("/bootstrap", response_model=ApiResponse)
def get_bootstrap_info(session: Session = Depends(get_session)):
    """系统启动信息
    
    返回最小系统启动信息，包括：
    - 数据版本
    - 是否存在已导入数据
    - 最新导入时间
    """
    
    # 检查是否有数据
    has_year_progress = session.exec(select(RawYearProgress).limit(1)).first() is not None
    has_tower_data = session.exec(select(RawTower).limit(1)).first() is not None
    has_meeting_data = session.exec(select(RawMeetingSnapshot).limit(1)).first() is not None
    
    # 获取导入批次信息
    total_batches = session.exec(select(func.count(ImportBatch.id))).one()
    
    # 获取最新导入时间
    latest_batch = session.exec(
        select(ImportBatch).order_by(ImportBatch.created_at.desc()).limit(1)
    ).first()
    
    latest_import_time = None
    if latest_batch:
        latest_import_time = latest_batch.created_at.isoformat()
    
    # 检查 year_progress unresolved 记录数（M0 已知限制）
    unresolved_year_progress_count = session.exec(
        select(func.count(YearProgressCurrent.id)).where(
            YearProgressCurrent.is_resolved == False
        )
    ).one()
    
    bootstrap_info = BootstrapInfo(
        app_name="输变电工程数字沙盘系统",
        app_version="0.1.0",
        db_initialized=True,
        has_year_progress_data=has_year_progress,
        has_tower_data=has_tower_data,
        has_meeting_data=has_meeting_data,
        latest_import_time=latest_import_time,
        total_import_batches=total_batches,
    )
    
    # 添加 unresolved 统计到响应
    result_data = bootstrap_info.model_dump()
    result_data["unresolved_year_progress_count"] = unresolved_year_progress_count
    
    return ApiResponse(
        code=0,
        message="success",
        data=result_data
    )
