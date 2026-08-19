from sqlalchemy import String, ForeignKey, Text, DateTime, Integer, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base
from typing import Optional
from datetime import datetime


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), index=True)
    client_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("clients.id"), nullable=True
    )
    whatsapp_message_id: Mapped[str] = mapped_column(String(200), unique=True)
    direction: Mapped[str] = mapped_column(String(10))  # inbound | outbound
    body: Mapped[str] = mapped_column(Text)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    order_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # NOTE: order_id has no FK constraint here — it will be added in the Alembic migration (Task 11)
    # This avoids a circular dependency in test DB creation (orders table created in Task 6)
