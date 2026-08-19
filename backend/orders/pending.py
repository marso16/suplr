from datetime import datetime
from sqlalchemy import String, ForeignKey, Text, DateTime, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class PendingOrder(Base):
    __tablename__ = "pending_orders"
    __table_args__ = (
        UniqueConstraint("supplier_id", "client_id", name="uq_pending_supplier_client"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"))
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"))
    currency: Mapped[str] = mapped_column(String(5))
    items_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
