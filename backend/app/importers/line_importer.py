"""线路聚合导入器

线路不由独立源数据生成，而是从 tower_current 聚合：
- 按 single_project_code 分组
- 按 tower_sequence_no 排序
- 使用 longitudeEdit/latitudeEdit 作为坐标
- upstreamTowerNo 作为辅助（不用于首轮连线）

降级策略：
- 同一线路序号不连续仍按排序连线，不做段拆分
- 无坐标的塔不参与连线坐标序列，但仍计入 tower_count
"""

import json
from datetime import datetime
from typing import Any, Dict
from collections import defaultdict
from sqlmodel import Session, select

from app.importers.import_service import BaseImporter
from app.models.m0_models import (
    ImportBatch,
    LineRaw,
    LineCurrent,
    TowerCurrent,
)


class LineImporter(BaseImporter):
    """线路聚合导入器"""

    def __init__(self, session: Session):
        super().__init__(session, "line")

    def build_lines(self, batch_no: str, source_file: str = None) -> Dict[str, Any]:
        """从 tower_current 聚合线路
        
        Args:
            batch_no: 批次编号
            source_file: 源文件名描述
            
        Returns:
            导入结果字典
        """
        batch = self.create_batch(batch_no, source_file)

        # 读取所有 tower
        towers = self.session.exec(select(TowerCurrent)).all()
        if not towers:
            self.update_batch_result(
                batch=batch,
                total_count=0,
                success_count=0,
                failed_count=0,
                error_log="tower_current 表为空，无法聚合线路",
            )
            return self.get_result_dict(batch)

        # 按 single_project_code 分组
        groups = defaultdict(list)
        for tower in towers:
            if tower.single_project_code:
                groups[tower.single_project_code].append(tower)

        success_count = 0
        failed_count = 0
        errors = []

        for spc, tower_list in groups.items():
            try:
                # 按 tower_sequence_no 排序（None 排在最后）
                tower_list.sort(
                    key=lambda t: (
                        t.tower_sequence_no is None,
                        t.tower_sequence_no if t.tower_sequence_no is not None else 0,
                    )
                )

                # 构建坐标序列
                coords = []
                tower_codes = []
                voltage_level = None

                for tower in tower_list:
                    tower_codes.append(tower.tower_no)

                    # 坐标必须同时存在且不为 0
                    lon = tower.longitude_edit
                    lat = tower.latitude_edit
                    if (lon is not None and lat is not None 
                        and lon != 0 and lat != 0):
                        coords.append([round(lon, 8), round(lat, 8)])

                        # 从首个有电压等级的塔推断
                        if voltage_level is None:
                            extra = json.loads(tower.extra_data) if tower.extra_data else {}
                            voltage_level = (
                                extra.get("voltageLevel")
                                or extra.get("voltage_level")
                            )

                # 写入 raw
                raw_line = LineRaw(
                    import_batch_id=batch.id,
                    single_project_code=spc,
                    tower_codes=json.dumps(tower_codes, ensure_ascii=False),
                )
                self.session.add(raw_line)

                # 全覆盖更新 current
                existing = self.session.exec(
                    select(LineCurrent).where(
                        LineCurrent.single_project_code == spc
                    )
                ).first()

                if existing:
                    existing.tower_count = len(tower_list)
                    existing.coords = json.dumps(coords, ensure_ascii=False)
                    existing.voltage_level = voltage_level
                    existing.import_batch_id = batch.id
                    existing.updated_at = datetime.utcnow()
                    self.session.add(existing)
                else:
                    current_line = LineCurrent(
                        single_project_code=spc,
                        tower_count=len(tower_list),
                        coords=json.dumps(coords, ensure_ascii=False),
                        voltage_level=voltage_level,
                        import_batch_id=batch.id,
                    )
                    self.session.add(current_line)

                self.session.commit()
                success_count += 1

            except Exception as e:
                failed_count += 1
                errors.append(f"线路 {spc}: {str(e)}")

        error_log = "\n".join(errors) if errors else None
        self.update_batch_result(
            batch=batch,
            total_count=len(groups),
            success_count=success_count,
            failed_count=failed_count,
            error_log=error_log,
        )

        return self.get_result_dict(batch)
