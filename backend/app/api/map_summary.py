"""地图摘要路由"""

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.core.db import get_session
from app.schemas.responses import ApiResponse, MapSummaryItem
from app.models.m0_models import MeetingCurrent

router = APIRouter()


@router.get("/map/summary", response_model=ApiResponse)
def get_map_summary(session: Session = Depends(get_session)):
    """地图摘要接口
    
    返回当前 meetlist 数据的最小摘要，
    供现有前端地图页读取，不要求完整业务字段。
    """
    
    # 查询所有当前生效的 meetlist 记录
    meetings = session.exec(select(MeetingCurrent)).all()
    
    # 转换为前端可消费的格式
    summary_items = []
    for m in meetings:
        # 尝试解析经纬度
        longitude = None
        latitude = None
        if m.tool_box_talk_longitude:
            try:
                longitude = float(m.tool_box_talk_longitude)
            except (ValueError, TypeError):
                pass
        if m.tool_box_talk_latitude:
            try:
                latitude = float(m.tool_box_talk_latitude)
            except (ValueError, TypeError):
                pass
        
        summary_items.append(MapSummaryItem(
            id=m.meeting_id,
            project_name=m.prj_name,
            longitude=longitude,
            latitude=latitude,
            risk_level=m.re_assessment_risk_level,
            person_count=m.current_constr_headcount,
            work_status=m.current_construction_status,
            city=m.build_unit_name,
        ))
    
    return ApiResponse(
        code=0,
        message="success",
        data={
            "total_points": len(summary_items),
            "data": [item.model_dump() for item in summary_items]
        }
    )
