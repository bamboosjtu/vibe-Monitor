"""基础模型与审计字段"""

from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class BaseAuditMixin(SQLModel):
    """审计字段基类（所有业务表继承）"""
    
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="创建时间"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="更新时间"
    )
    created_by: Optional[str] = Field(
        default=None,
        description="创建者"
    )
    updated_by: Optional[str] = Field(
        default=None,
        description="更新者"
    )
    import_batch_id: Optional[int] = Field(
        default=None,
        foreign_key="importbatch.id",
        description="导入批次 ID"
    )
