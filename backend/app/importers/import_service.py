"""导入服务基础类

提供：
- 导入批次创建
- 导入日志记录
- 通用校验逻辑
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from sqlmodel import Session, select

from app.models.m0_models import ImportBatch
from app.schemas.responses import ImportResult


class BaseImporter:
    """导入服务基类"""
    
    def __init__(self, session: Session, data_type: str):
        """初始化导入器
        
        Args:
            session: 数据库会话
            data_type: 数据类型标识（year_progress / tower / meeting）
        """
        self.session = session
        self.data_type = data_type
    
    def create_batch(self, batch_no: str, source_file: Optional[str] = None) -> ImportBatch:
        """创建导入批次记录
        
        Args:
            batch_no: 批次编号
            source_file: 源文件名
            
        Returns:
            ImportBatch 实例
        """
        batch = ImportBatch(
            batch_no=batch_no,
            data_type=self.data_type,
            source_file=source_file,
            status="processing",
        )
        self.session.add(batch)
        self.session.flush()
        return batch
    
    def update_batch_result(
        self,
        batch: ImportBatch,
        total_count: int,
        success_count: int,
        failed_count: int,
        skipped_count: int = 0,
        unresolved_count: int = 0,
        error_log: Optional[str] = None,
        status: str = "success",
    ):
        """更新导入批次结果
        
        Args:
            batch: 导入批次实例
            total_count: 总记录数
            success_count: 成功记录数
            failed_count: 失败记录数
            skipped_count: 跳过记录数
            unresolved_count: 未解析记录数
            error_log: 错误日志
            status: 状态
        """
        batch.total_records = total_count
        batch.success_records = success_count
        batch.failed_records = failed_count
        batch.skipped_records = skipped_count
        batch.unresolved_records = unresolved_count
        batch.error_log = error_log
        batch.status = status
        self.session.add(batch)
        self.session.commit()
    
    def validate_record(self, record: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """校验单条记录（子类可重写）
        
        Args:
            record: 原始记录字典
            
        Returns:
            (是否有效, 错误信息)
        """
        return True, None
    
    def get_result_dict(self, batch: ImportBatch) -> Dict[str, Any]:
        """获取导入结果字典（M0 第二轮统一结构）
        
        Args:
            batch: 导入批次实例
            
        Returns:
            结果字典
        """
        return {
            "batch_no": batch.batch_no,
            "data_type": batch.data_type,
            "total_count": batch.total_records,
            "success_count": batch.success_records,
            "failed_count": batch.failed_records,
            "skipped_count": batch.skipped_records,
            "unresolved_count": batch.unresolved_records,
            "status": batch.status,
            "error_log": batch.error_log,
        }
