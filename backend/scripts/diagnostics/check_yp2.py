"""检查 year_progress source_code 样例"""
import sys, os
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BACKEND_ROOT))

from app.core.db import engine
from sqlmodel import Session, select
from app.models.m0_models import YearProgressCurrent

with Session(engine) as session:
    yps = session.exec(select(YearProgressCurrent).limit(10)).all()
    for yp in yps:
        print(f"source_code={yp.source_code}, source_name={yp.source_name}")
