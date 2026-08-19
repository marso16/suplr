from sqlalchemy import String, ForeignKey, Numeric, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base
from pydantic import BaseModel
from decimal import Decimal
from typing import Optional
from datetime import datetime


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(primary_key=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), unique=True)
    number: Mapped[str] = mapped_column(String(50))
    currency: Mapped[str] = mapped_column(String(5))
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    paid_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class InvoiceOut(BaseModel):
    id: int
    supplier_id: int
    order_id: int
    number: str
    currency: str
    total: Decimal
    issued_at: datetime
    paid_at: Optional[datetime]
    model_config = {"from_attributes": True}
