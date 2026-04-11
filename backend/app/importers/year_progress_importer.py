"""年度目标数据导入器

导入规则：
- 支持 JSON 格式
- 写入 raw_year_progress 表
- 以 singleProjectCode 为主键全覆盖更新 year_progress_current 表
"""

import json
from datetime import datetime
from typing import Any, Dict, List
from sqlmodel import Session, select

from app.importers.import_service import BaseImporter
from app.models.m0_models import ImportBatch, RawYearProgress, YearProgressCurrent


class YearProgressImporter(BaseImporter):
    """年度目标数据导入器"""
    
    def __init__(self, session: Session):
        super().__init__(session, "year_progress")
    
    def import_data(
        self,
        data: Any,
        batch_no: str,
        source_file: str = None
    ) -> Dict[str, Any]:
        """导入年度目标数据
        
        Args:
            data: 原始数据（可以是列表或包含列表的字典）
            batch_no: 批次编号
            source_file: 源文件名
            
        Returns:
            导入结果字典
        """
        # 创建批次
        batch = self.create_batch(batch_no, source_file)
        
        # 解析数据
        records = self._parse_records(data)
        
        success_count = 0
        failed_count = 0
        unresolved_count = 0
        errors = []
        
        for idx, record in enumerate(records):
            try:
                # 校验
                valid, error_msg = self.validate_record(record)
                if not valid:
                    failed_count += 1
                    errors.append(f"记录 {idx}: {error_msg}")
                    continue
                
                # 写入 raw 表
                self._save_raw_record(record, batch.id)
                
                # 更新 current 表（全覆盖）
                self._update_current_record(record, batch.id)
                
                # 统计 unresolved
                if not record.get("singleProjectCode"):
                    unresolved_count += 1
                
                success_count += 1
                
            except Exception as e:
                failed_count += 1
                errors.append(f"记录 {idx}: {str(e)}")
        
        # 更新批次结果
        error_log = "\n".join(errors) if errors else None
        self.update_batch_result(
            batch=batch,
            total_count=len(records),
            success_count=success_count,
            failed_count=failed_count,
            unresolved_count=unresolved_count,
            error_log=error_log,
        )
        
        return self.get_result_dict(batch)
    
    def _parse_records(self, data: Any) -> List[Dict[str, Any]]:
        """解析数据，返回记录列表

        正式 schema 定义 record_path = raw_data[*]
        主路径：先检查 raw_data 键
        Fallback：裸数组（仅兼容历史样例）
        """
        if isinstance(data, dict):
            # 正式 envelope 路径（主路径）
            if "raw_data" in data:
                print(f"[YearProgressImporter] record_path 命中 raw_data, 记录数={len(data['raw_data'])}")
                return data["raw_data"]
            # Fallback 路径
            if "list" in data:
                print(f"[YearProgressImporter] record_path 降级 list, 记录数={len(data['list'])}")
                return data["list"]
            if "data" in data:
                print(f"[YearProgressImporter] record_path 降级 data, 记录数={len(data['data'])}")
                return data["data"]
            print(f"[YearProgressImporter] record_path 降级为单记录对象")
            return [data]
        elif isinstance(data, list):
            # 裸数组 fallback
            print(f"[YearProgressImporter] record_path 降级为裸数组, 记录数={len(data)}")
            return data
        else:
            raise ValueError("不支持的数据格式")
    
    def validate_record(self, record: Dict[str, Any]):
        """校验记录
        
        M0 降级策略：
        - 不再要求 singleProjectCode 必须存在
        - 如果存在 prjCode 或 code（列显示值），则视为有效记录
        - 不得伪造 singleProjectCode
        """
        prj_code = record.get("prjCode")
        source_code = record.get("code")
        
        if not prj_code and not source_code:
            return False, "缺少 prjCode 且缺少 code（列显示值），无法落库"
        return True, None
    
    def _save_raw_record(self, record: Dict[str, Any], batch_id: int):
        """保存原始记录"""
        single_project_code = record.get("singleProjectCode")
        source_code = record.get("code")
        
        raw = RawYearProgress(
            import_batch_id=batch_id,
            raw_data=json.dumps(record, ensure_ascii=False),
            prj_code=record.get("prjCode"),
            single_project_code=single_project_code,
            source_code=source_code,
        )
        self.session.add(raw)
    
    def _update_current_record(self, record: Dict[str, Any], batch_id: int):
        """更新当前生效视图（全覆盖）
        
        M0 主键降级策略：
        - single_project_code 优先使用真实字段，不存在则为 None
        - source_code 保存源数据中的 code 列显示值
        - source_name 保存源数据中的 name 列显示值
        - key_type 标记主键来源
        - is_resolved 标记是否已解析
        - 主键查找：优先 source_code，其次 prj_code
        """
        single_project_code = record.get("singleProjectCode")
        source_code = record.get("code")
        source_name = record.get("name")
        prj_code = record.get("prjCode")
        
        if single_project_code:
            key_type = "resolved"
            is_resolved = True
        else:
            key_type = "source_code_fallback"
            is_resolved = False
        
        # 用于查找现有记录的主键：优先 source_code，其次 prj_code
        lookup_key = source_code or prj_code
        if not lookup_key:
            return
        
        # 查找现有记录
        existing = self.session.exec(
            select(YearProgressCurrent).where(
                YearProgressCurrent.source_code == lookup_key
            )
        ).first()
        
        if not existing and prj_code:
            # 如果 source_code 没找到，尝试用 prj_code 查找
            existing = self.session.exec(
                select(YearProgressCurrent).where(
                    YearProgressCurrent.prj_code == prj_code,
                    YearProgressCurrent.source_code.is_(None),
                )
            ).first()
        
        if existing:
            existing.prj_code = prj_code
            existing.single_project_code = single_project_code
            existing.source_code = source_code
            existing.source_name = source_name
            existing.key_type = key_type
            existing.is_resolved = is_resolved
            existing.single_project_type_name = record.get("singleProjectTypeName")
            existing.build_unit_code = record.get("buildUnitCode")
            existing.build_unit_name = record.get("buildUnitName")
            existing.image_progress = record.get("imageProgress")
            existing.jhkg_time = record.get("jhkgTime")
            existing.jhtc_time = record.get("jhtcTime")
            existing.extra_data = json.dumps(record, ensure_ascii=False)
            existing.import_batch_id = batch_id
            existing.updated_at = datetime.utcnow()
            self.session.add(existing)
        else:
            current = YearProgressCurrent(
                prj_code=prj_code or "",
                single_project_code=single_project_code,
                source_code=source_code,
                source_name=source_name,
                key_type=key_type,
                is_resolved=is_resolved,
                single_project_type_name=record.get("singleProjectTypeName"),
                build_unit_code=record.get("buildUnitCode"),
                build_unit_name=record.get("buildUnitName"),
                image_progress=record.get("imageProgress"),
                jhkg_time=record.get("jhkgTime"),
                jhtc_time=record.get("jhtcTime"),
                extra_data=json.dumps(record, ensure_ascii=False),
                import_batch_id=batch_id,
            )
            self.session.add(current)
        
        self.session.commit()
