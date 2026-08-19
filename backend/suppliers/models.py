from sqlalchemy import String, DateTime, ForeignKey, func, Text
from sqlalchemy.orm import Mapped, mapped_column
from database import Base
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    plan: Mapped[str] = mapped_column(String(20), default="pro")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    logo: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_admin: Mapped[bool] = mapped_column(default=False)
    suspended: Mapped[bool] = mapped_column(default=False)


class SupplierOut(BaseModel):
    id: int
    name: str
    email: str
    plan: str
    logo: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    is_admin: bool = False
    suspended: bool = False
    created_at: datetime
    model_config = {"from_attributes": True}


class WhatsAppConnection(Base):
    __tablename__ = "whatsapp_connections"

    id: Mapped[int] = mapped_column(primary_key=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), unique=True)
    phone_number: Mapped[str] = mapped_column(String(20))
    bsp_api_key: Mapped[str] = mapped_column(
        String(500)
    )  # BSP-specific API key for outbound
    bsp_endpoint: Mapped[str] = mapped_column(
        String(500)
    )  # BSP send URL (swappable per BSP)
    connected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
