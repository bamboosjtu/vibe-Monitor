"""杆塔数据导入器

导入规则：
- 支持 JSON 格式
- 写入 raw_tower 表
- 以 singleProjectCode + towerNo 为主键全覆盖更新 tower_current 表
"""

import json
from datetime import datetime
from typing import Any, Dict, List
from sqlmodel import Session, select

from app.importers.import_service import BaseImporter
from app.models.m0_models import ImportBatch, RawTower, TowerCurrent


class TowerImporter(BaseImporter):
    """杆塔数据导入器"""
    
    def __init__(self, session: Session):
        super().__init__(session, "tower")
    
    def import_data(
        self,
        data: Any,
        batch_no: str,
        source_file: str = None
    ) -> Dict[str, Any]:
        """导入杆塔数据
        
        Args:
            data: 原始数据
            batch_no: 批次编号
            source_file: 源文件名
            
        Returns:
            导入结果字典
        """
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
        """解析数据

        正式 schema 定义 record_path = raw_data[*]
        主路径：先检查 raw_data 键
        Fallback：裸数组（仅兼容历史样例）
        """
        if isinstance(data, dict):
            # 正式 envelope 路径（主路径）
            if "raw_data" in data:
                print(f"[TowerImporter] record_path 命中 raw_data, 记录数={len(data['raw_data'])}")
                return data["raw_data"]
            # Fallback 路径
            if "list" in data:
                print(f"[TowerImporter] record_path 降级 list, 记录数={len(data['list'])}")
                return data["list"]
            if "data" in data:
                print(f"[TowerImporter] record_path 降级 data, 记录数={len(data['data'])}")
                return data["data"]
            print(f"[TowerImporter] record_path 降级为单记录对象")
            return [data]
        elif isinstance(data, list):
            # 裸数组 fallback
            print(f"[TowerImporter] record_path 降级为裸数组, 记录数={len(data)}")
            return data
        else:
            raise ValueError("不支持的数据格式")
    
    def validate_record(self, record: Dict[str, Any]):
        """校验记录"""
        if not record.get("singleProjectCode"):
            return False, "缺少 singleProjectCode"
        if not record.get("towerNo"):
            return False, "缺少 towerNo"
        return True, None
    
    def _save_raw_record(self, record: Dict[str, Any], batch_id: int):
        """保存原始记录"""
        raw = RawTower(
            import_batch_id=batch_id,
            raw_data=json.dumps(record, ensure_ascii=False),
            single_project_code=record.get("singleProjectCode"),
            tower_no=record.get("towerNo"),
        )
        self.session.add(raw)
    
    def _update_current_record(self, record: Dict[str, Any], batch_id: int):
        """更新当前生效视图（全覆盖）"""
        single_project_code = record.get("singleProjectCode")
        tower_no = record.get("towerNo")
        
        # 解析坐标（处理可能的字符串类型）
        longitude = None
        latitude = None
        try:
            longitude = float(record.get("longitudeEdit"))
        except (ValueError, TypeError):
            pass
        try:
            latitude = float(record.get("latitudeEdit"))
        except (ValueError, TypeError):
            pass
        
        # 解析序列号
        sequence_no = None
        try:
            sequence_no = int(record.get("towerSequenceNo"))
        except (ValueError, TypeError):
            pass
        
        existing = self.session.exec(
            select(TowerCurrent).where(
                TowerCurrent.single_project_code == single_project_code,
                TowerCurrent.tower_no == tower_no,
            )
        ).first()
        
        if existing:
            existing.tower_sequence_no = sequence_no
            existing.upstream_tower_no = record.get("upstreamTowerNo")
            existing.longitude_edit = longitude
            existing.latitude_edit = latitude
            existing.bidding_section_code = record.get("biddingSectionCode")
            existing.extra_data = json.dumps(record, ensure_ascii=False)
            existing.import_batch_id = batch_id
            existing.updated_at = datetime.utcnow()
            self.session.add(existing)
        else:
            current = TowerCurrent(
                single_project_code=single_project_code,
                tower_no=tower_no,
                tower_sequence_no=sequence_no,
                upstream_tower_no=record.get("upstreamTowerNo"),
                longitude_edit=longitude,
                latitude_edit=latitude,
                bidding_section_code=record.get("biddingSectionCode"),
                extra_data=json.dumps(record, ensure_ascii=False),
                import_batch_id=batch_id,
            )
            self.session.add(current)
        
        self.session.commit()
