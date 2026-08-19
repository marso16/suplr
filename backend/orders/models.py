from sqlalchemy import String, ForeignKey, Numeric, DateTime, Date, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base
from pydantic import BaseModel, field_serializer
from decimal import Decimal
from typing import Optional, TYPE_CHECKING
from datetime import datetime, date


def fmt_qty(qty: Decimal) -> str:
    """Format a quantity removing trailing zeros: 2.000→'2', 2.500→'2.5'."""
    s = f"{qty:f}"
    return s.rstrip("0").rstrip(".") if "." in s else s


if TYPE_CHECKING:
    from clients.models import Client
    from products.models import Product


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), index=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    currency: Mapped[str] = mapped_column(String(5), default="USD")
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    delivery_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    items: Mapped[list["OrderItem"]] = relationship(
        "OrderItem", back_populates="order", lazy="selectin"
    )
    client: Mapped["Client"] = relationship("Client", lazy="selectin")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    product_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("products.id"), nullable=True
    )
    product_name_raw: Mapped[str] = mapped_column(String(200))
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3))
    unit: Mapped[str] = mapped_column(String(50))
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    order: Mapped["Order"] = relationship("Order", back_populates="items")
    product: Mapped[Optional["Product"]] = relationship("Product", lazy="selectin")

    @property
    def product_name(self) -> str:
        return self.product.name if self.product is not None else self.product_name_raw


class OrderItemIn(BaseModel):
    product_name_raw: str
    product_id: Optional[int] = None
    quantity: Decimal
    unit: str
    price: Decimal
    notes: Optional[str] = None


class OrderIn(BaseModel):
    client_id: int
    currency: str = "USD"
    items: list[OrderItemIn]


class ClientSummary(BaseModel):
    id: int
    name: str
    whatsapp_number: str
    model_config = {"from_attributes": True}


class OrderItemOut(BaseModel):
    id: int
    product_name: str
    product_name_raw: str
    product_id: Optional[int]
    quantity: Decimal
    unit: str
    price: Decimal
    notes: Optional[str]
    model_config = {"from_attributes": True}

    @field_serializer("quantity")
    def _fmt_quantity(self, v: Decimal) -> str:
        return fmt_qty(v)


class OrderOut(BaseModel):
    id: int
    supplier_id: int
    client_id: int
    client: ClientSummary
    status: str
    currency: str
    total: Decimal
    created_at: datetime
    confirmed_at: Optional[datetime]
    delivery_date: Optional[date]
    notes: Optional[str]
    items: list[OrderItemOut]
    model_config = {"from_attributes": True}
