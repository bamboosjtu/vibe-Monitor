"""导入路由"""

import json
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlmodel import Session

from app.core.db import get_session
from app.schemas.responses import ImportResponse, ImportResult, ApiResponse
from app.importers.year_progress_importer import YearProgressImporter
from app.importers.tower_importer import TowerImporter
from app.importers.meeting_importer import MeetingImporter

router = APIRouter()


@router.post("/import/year-progress", response_model=ApiResponse)
async def import_year_progress(
    file: UploadFile = File(...),
    session: Session = Depends(get_session)
):
    """导入年度目标数据
    
    支持 JSON 格式文件。
    导入逻辑：
    1. 解析文件
    2. 校验数据
    3. 写入 raw 表
    4. 全覆盖更新 current 表
    """
    
    try:
        # 读取文件内容 (utf-8-sig 处理 BOM)
        content = await file.read()
        data = json.loads(content.decode('utf-8-sig'))
        
        # 创建导入批次
        batch_no = f"YP-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"
        
        importer = YearProgressImporter(session)
        result = importer.import_data(data, batch_no, file.filename)
        
        return ApiResponse(
            code=0,
            message="年度目标导入成功",
            data=result
        )
        
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"JSON 格式错误: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@router.post("/import/towers", response_model=ApiResponse)
async def import_towers(
    file: UploadFile = File(...),
    session: Session = Depends(get_session)
):
    """导入杆塔数据
    
    支持 JSON 格式文件。
    导入逻辑：
    1. 解析文件
    2. 校验数据
    3. 写入 raw 表
    4. 全覆盖更新 current 表
    """
    
    try:
        # 读取文件内容 (utf-8-sig 处理 BOM)
        content = await file.read()
        data = json.loads(content.decode('utf-8-sig'))
        
        # 创建导入批次
        batch_no = f"TW-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"
        
        importer = TowerImporter(session)
        result = importer.import_data(data, batch_no, file.filename)
        
        return ApiResponse(
            code=0,
            message="杆塔数据导入成功",
            data=result
        )
        
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"JSON 格式错误: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@router.post("/import/meetings", response_model=ApiResponse)
async def import_meetings(
    file: UploadFile = File(...),
    session: Session = Depends(get_session)
):
    """导入 meetlist 数据
    
    支持 JSON 格式文件。
    导入逻辑：
    1. 解析文件
    2. 校验数据
    3. 写入 raw 表
    4. 更新 meeting_current 表（以 id 为主键）
    """
    
    try:
        # 读取文件内容 (utf-8-sig 处理 BOM)
        content = await file.read()
        data = json.loads(content.decode('utf-8-sig'))
        
        # 创建导入批次
        batch_no = f"MT-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"
        
        importer = MeetingImporter(session)
        result = importer.import_data(data, batch_no, file.filename)
        
        return ApiResponse(
            code=0,
            message="meetlist 数据导入成功",
            data=result
        )
        
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"JSON 格式错误: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")
