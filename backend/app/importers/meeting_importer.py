"""meetlist 数据导入器

导入规则：
- 支持 JSON 格式
- 写入 raw_meeting_snapshot 表
- 以 id 为主键更新 meeting_current 表（同主键全覆盖更新全部字段）
"""

import json
from datetime import datetime
from typing import Any, Dict, List
from sqlmodel import Session, select

from app.importers.import_service import BaseImporter
from app.models.m0_models import ImportBatch, RawMeetingSnapshot, MeetingCurrent


class MeetingImporter(BaseImporter):
    """meetlist 数据导入器"""

    def __init__(self, session: Session):
        super().__init__(session, "meeting")

    def import_data(
        self,
        data: Any,
        batch_no: str,
        source_file: str = None
    ) -> Dict[str, Any]:
        """导入 meetlist 数据
        
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
                print(f"[MeetingImporter] record_path 命中 raw_data, 记录数={len(data['raw_data'])}")
                return data["raw_data"]
            # Fallback 路径
            if "list" in data:
                print(f"[MeetingImporter] record_path 降级 list, 记录数={len(data['list'])}")
                return data["list"]
            if "data" in data:
                print(f"[MeetingImporter] record_path 降级 data, 记录数={len(data['data'])}")
                return data["data"]
            print(f"[MeetingImporter] record_path 降级为单记录对象")
            return [data]
        elif isinstance(data, list):
            # 裸数组 fallback
            print(f"[MeetingImporter] record_path 降级为裸数组, 记录数={len(data)}")
            return data
        else:
            raise ValueError("不支持的数据格式")

    def validate_record(self, record: Dict[str, Any]):
        """校验记录"""
        if not record.get("id"):
            return False, "缺少 id"
        return True, None

    def _save_raw_record(self, record: Dict[str, Any], batch_id: int):
        """保存原始记录"""
        raw = RawMeetingSnapshot(
            import_batch_id=batch_id,
            raw_data=json.dumps(record, ensure_ascii=False),
            meeting_id=record.get("id"),
            single_project_code=record.get("singleProjectCode"),
            capture_time=record.get("currentConstrDate"),
        )
        self.session.add(raw)

    def _update_current_record(self, record: Dict[str, Any], batch_id: int):
        """更新当前生效视图（以 id 为主键）"""
        meeting_id = record.get("id")

        existing = self.session.exec(
            select(MeetingCurrent).where(
                MeetingCurrent.meeting_id == meeting_id
            )
        ).first()

        current = MeetingCurrent(
            meeting_id=meeting_id,
            single_project_code=record.get("singleProjectCode"),
            prj_name=record.get("prjName"),
            prj_code=record.get("prjCode"),
            ticket_id=record.get("ticketId"),
            ticket_no=record.get("ticketNo"),
            ticket_name=record.get("ticketName"),
            tool_box_talk_address=record.get("toolBoxTalkAddress"),
            tool_box_talk_longitude=record.get("toolBoxTalkLongitude"),
            tool_box_talk_latitude=record.get("toolBoxTalkLatitude"),
            re_assessment_risk_level=record.get("reAssessmentRiskLevel"),
            current_constr_headcount=record.get("currentConstrHeadcount"),
            current_construction_status=record.get("currentConstructionStatus"),
            voltage_level=record.get("voltageLevel"),
            construction_unit_name=record.get("constructionUnitName"),
            supervision_unit_name=record.get("supervisionUnitName"),
            build_unit_name=record.get("buildUnitName"),
            leader_name=record.get("leaderName"),
            work_procedure=record.get("workProcedure"),
            work_site_name=record.get("workSiteName"),
            current_constr_date=record.get("currentConstrDate"),
            work_start_time=record.get("workStartTime"),
            import_batch_id=batch_id,
            updated_at=datetime.utcnow(),
        )

        if existing:
            # 更新现有记录
            existing.single_project_code = current.single_project_code
            existing.prj_name = current.prj_name
            existing.prj_code = current.prj_code
            existing.ticket_id = current.ticket_id
            existing.ticket_no = current.ticket_no
            existing.ticket_name = current.ticket_name
            existing.tool_box_talk_address = current.tool_box_talk_address
            existing.tool_box_talk_longitude = current.tool_box_talk_longitude
            existing.tool_box_talk_latitude = current.tool_box_talk_latitude
            existing.re_assessment_risk_level = current.re_assessment_risk_level
            existing.current_constr_headcount = current.current_constr_headcount
            existing.current_construction_status = current.current_construction_status
            existing.voltage_level = current.voltage_level
            existing.construction_unit_name = current.construction_unit_name
            existing.supervision_unit_name = current.supervision_unit_name
            existing.build_unit_name = current.build_unit_name
            existing.leader_name = current.leader_name
            existing.work_procedure = current.work_procedure
            existing.work_site_name = current.work_site_name
            existing.current_constr_date = current.current_constr_date
            existing.work_start_time = current.work_start_time
            existing.import_batch_id = current.import_batch_id
            existing.updated_at = current.updated_at
            self.session.add(existing)
        else:
            # 新记录
            self.session.add(current)

        self.session.commit()
