from sqlalchemy import String, ForeignKey, Numeric, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from database import Base
from pydantic import BaseModel
from decimal import Decimal
from typing import Optional


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    sku: Mapped[str] = mapped_column(String(100))
    unit: Mapped[str] = mapped_column(String(50))
    price_usd: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    price_lbp: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class ProductIn(BaseModel):
    name: str
    sku: Optional[str] = None
    unit: str
    price_usd: Optional[Decimal] = None
    price_lbp: Optional[Decimal] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    unit: Optional[str] = None
    price_usd: Optional[Decimal] = None
    price_lbp: Optional[Decimal] = None


class ProductOut(BaseModel):
    id: int
    supplier_id: int
    name: str
    sku: str
    unit: str
    price_usd: Optional[Decimal]
    price_lbp: Optional[Decimal]
    active: bool
    model_config = {"from_attributes": True}
