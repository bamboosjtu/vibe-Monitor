"""检查 year_progress 数据"""
import sys, os
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BACKEND_ROOT))

from app.core.db import engine
from sqlmodel import Session, select
from app.models.m0_models import YearProgressCurrent

with Session(engine) as session:
    # 查询所有 year_progress
    yps = session.exec(select(YearProgressCurrent)).all()
    print(f"总记录: {len(yps)}")
    
    # 查找匹配的
    for code in ['1516A023001U01', '1616A124002U01']:
        yp = session.exec(
            select(YearProgressCurrent).where(
                YearProgressCurrent.source_code == code
            )
        ).first()
        if yp:
            print(f"{code}: source_name={yp.source_name}")
        else:
            print(f"{code}: 未找到")
