"""重新导入变电站数据（带名称关联）"""
import sys, os
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_ROOT.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.core.db import engine
from sqlmodel import Session, select
from app.importers.station_importer import StationImporter
from app.models.m0_models import StationCurrent
from datetime import datetime
import uuid, json

data_dir = os.path.join(PROJECT_ROOT, "data", "substation_coordinates")

with Session(engine) as session:
    importer = StationImporter(session)
    
    files = [f for f in os.listdir(data_dir) if f.endswith('.json')]
    print(f"发现 {len(files)} 个变电站数据文件")
    
    for fname in files:
        fpath = os.path.join(data_dir, fname)
        print(f"\n导入: {fname}")
        
        with open(fpath, 'r', encoding='utf-8-sig') as f:
            data = json.load(f)
        
        batch_no = f"ST-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"
        result = importer.import_data(data, batch_no, fname)
        
        print(f"  总记录: {result['total_count']}, 成功: {result['success_count']}")
    
    session.commit()
    
    # 验证结果
    print("\n=== 导入结果验证 ===")
    stations = session.exec(select(StationCurrent)).all()
    for s in stations:
        print(f"  {s.single_project_code}: {s.name}")

print("\n完成!")
