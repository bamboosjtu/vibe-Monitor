"""骨架地图接口

返回真实的空间骨架数据：
- 线路 (Line): 按 singleProjectCode 分组，包含坐标序列
- 杆塔 (Tower): 所有有坐标的塔
- 变电站 (Station): M1 Round2 新增
"""

import json
from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.core.db import get_session
from app.models.m0_models import LineCurrent, TowerCurrent, StationCurrent

router = APIRouter()


@router.get("/map/skeleton")
def map_skeleton(session: Session = Depends(get_session)):
    """返回工程骨架地图数据
    
    返回结构：
    {
        "code": 0,
        "message": "success",
        "data": {
            "lines": [...],
            "towers": [...],
            "stations": [...]  // M1 Round2 新增
        },
        "timestamp": "..."
    }
    """
    from datetime import datetime
    
    # 查询所有线路
    lines = session.exec(select(LineCurrent)).all()
    line_items = []
    for line in lines:
        try:
            coords = json.loads(line.coords) if line.coords else []
        except (json.JSONDecodeError, TypeError):
            coords = []
        
        line_items.append({
            "single_project_code": line.single_project_code,
            "tower_count": line.tower_count,
            "coords": coords,
            "voltage_level": line.voltage_level,
        })
    
    # 查询所有有坐标的塔
    towers = session.exec(select(TowerCurrent)).all()
    tower_items = []
    for tower in towers:
        lon = tower.longitude_edit
        lat = tower.latitude_edit
        if lon is None or lat is None or lon == 0 or lat == 0:
            continue
        
        tower_items.append({
            "id": str(tower.id) if tower.id else "",
            "single_project_code": tower.single_project_code,
            "tower_no": tower.tower_no,
            "longitude": lon,
            "latitude": lat,
            "tower_sequence_no": tower.tower_sequence_no,
        })
    
    # M1 Round2: 查询所有变电站
    stations = session.exec(select(StationCurrent)).all()
    station_items = []
    for station in stations:
        lon = station.longitude
        lat = station.latitude
        if lon is None or lat is None or lon == 0 or lat == 0:
            continue
        
        station_items.append({
            "id": str(station.id) if station.id else "",
            "single_project_code": station.single_project_code,
            "name": station.name or station.single_project_code,
            "prj_code": station.prj_code,
            "longitude": lon,
            "latitude": lat,
        })
    
    return {
        "code": 0,
        "message": "success",
        "data": {
            "lines": line_items,
            "towers": tower_items,
            "stations": station_items,  # M1 Round2 新增
        },
        "timestamp": datetime.utcnow().isoformat(),
    }
