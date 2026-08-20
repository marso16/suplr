from decimal import Decimal
from sqlalchemy import String, ForeignKey, Numeric, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from database import Base
from pydantic import BaseModel
from typing import Optional


class Client(Base):
    __tablename__ = "clients"
    __table_args__ = (
        UniqueConstraint(
            "supplier_id", "whatsapp_number", name="uq_client_supplier_number"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    whatsapp_number: Mapped[str] = mapped_column(String(50), index=True)
    credit_terms: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    credit_balance: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0"), server_default="0"
    )
    preferred_language: Mapped[str] = mapped_column(
        String(5), default="en", server_default="en"
    )
    name_confirmed: Mapped[bool] = mapped_column(default=False, server_default="false")
    email: Mapped[Optional[str]] = mapped_column(String(254), nullable=True)


class ClientIn(BaseModel):
    name: str
    whatsapp_number: str
    credit_terms: Optional[str] = None
    notes: Optional[str] = None
    email: Optional[str] = None


class ClientOut(BaseModel):
    id: int
    supplier_id: int
    name: str
    whatsapp_number: str
    credit_terms: Optional[str]
    notes: Optional[str]
    credit_balance: Decimal
    email: Optional[str] = None
    model_config = {"from_attributes": True}
