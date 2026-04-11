"""变电站数据导入器（M1 Round2）

数据源：data/substation_coordinates/*.json

导入规则：
- 支持 JSON 格式（envelope + raw_data[*]）
- 写入 raw_station 表
- 以 singleProjectCode 为主键全覆盖更新 station_current 表
"""

import json
from datetime import datetime
from typing import Any, Dict, List
from sqlmodel import Session, select

from app.importers.import_service import BaseImporter
from app.models.m0_models import ImportBatch, RawStation, StationCurrent, YearProgressCurrent


class StationImporter(BaseImporter):
    """变电站数据导入器"""
    
    def __init__(self, session: Session):
        super().__init__(session, "station")
    
    def import_data(
        self,
        data: Any,
        batch_no: str,
        source_file: str = None
    ) -> Dict[str, Any]:
        """导入变电站数据"""
        batch = self.create_batch(batch_no, source_file)
        
        records = self._parse_records(data)
        
        success_count = 0
        failed_count = 0
        errors = []
        
        for idx, record in enumerate(records):
            try:
                valid, error_msg = self.validate_record(record)
                if not valid:
                    failed_count += 1
                    errors.append(f"记录 {idx}: {error_msg}")
                    continue
                
                self._save_raw_record(record, batch.id)
                self._update_current_record(record, batch.id)
                
                success_count += 1
                
            except Exception as e:
                failed_count += 1
                errors.append(f"记录 {idx}: {str(e)}")
        
        error_log = "\n".join(errors) if errors else None
        self.update_batch_result(
            batch=batch,
            total_count=len(records),
            success_count=success_count,
            failed_count=failed_count,
            error_log=error_log,
        )
        
        return self.get_result_dict(batch)
    
    def _parse_records(self, data: Any) -> List[Dict[str, Any]]:
        """解析数据（envelope + raw_data[*]）"""
        if isinstance(data, dict):
            if "raw_data" in data:
                return data["raw_data"]
            if "list" in data:
                return data["list"]
            if "data" in data:
                return data["data"]
            return [data]
        elif isinstance(data, list):
            return data
        else:
            raise ValueError("不支持的数据格式")
    
    def validate_record(self, record: Dict[str, Any]):
        """校验记录"""
        if not record.get("singleProjectCode"):
            return False, "缺少 singleProjectCode"
        return True, None
    
    def _save_raw_record(self, record: Dict[str, Any], batch_id: int):
        """保存原始记录"""
        raw = RawStation(
            import_batch_id=batch_id,
            raw_data=json.dumps(record, ensure_ascii=False),
            single_project_code=record.get("singleProjectCode"),
        )
        self.session.add(raw)
    
    def _get_station_name(self, single_project_code: str) -> str:
        """从 year_progress 关联获取项目名称
        
        匹配逻辑：
        - year_progress.source_code == station.single_project_code
        - 取 year_progress.source_name 作为项目名称
        """
        try:
            # 查询 year_progress_current 中匹配的记录
            yp = self.session.exec(
                select(YearProgressCurrent).where(
                    YearProgressCurrent.source_code == single_project_code
                )
            ).first()
            
            if yp and yp.source_name:
                return yp.source_name
        except Exception:
            pass
        
        # 降级：返回 single_project_code
        return single_project_code
    
    def _update_current_record(self, record: Dict[str, Any], batch_id: int):
        """更新当前生效视图（全覆盖）"""
        single_project_code = record.get("singleProjectCode")
        
        # 解析坐标
        longitude = None
        latitude = None
        try:
            longitude = float(record.get("longitude"))
        except (ValueError, TypeError):
            pass
        try:
            latitude = float(record.get("latitude"))
        except (ValueError, TypeError):
            pass
        
        # 从 year_progress 获取名称
        station_name = self._get_station_name(single_project_code)
        
        existing = self.session.exec(
            select(StationCurrent).where(
                StationCurrent.single_project_code == single_project_code
            )
        ).first()
        
        if existing:
            existing.prj_code = record.get("prjCode")
            existing.name = station_name
            existing.longitude = longitude
            existing.latitude = latitude
            existing.import_batch_id = batch_id
            existing.updated_at = datetime.utcnow()
            self.session.add(existing)
        else:
            current = StationCurrent(
                single_project_code=single_project_code,
                prj_code=record.get("prjCode"),
                name=station_name,
                longitude=longitude,
                latitude=latitude,
                import_batch_id=batch_id,
            )
            self.session.add(current)
        
        self.session.commit()
