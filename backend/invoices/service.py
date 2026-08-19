from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from invoices.models import Invoice
from orders.service import get_order
from fastapi import HTTPException


async def create_invoice(order_id: int, supplier_id: int, db: AsyncSession) -> Invoice:
    order = await get_order(order_id, supplier_id, db)
    if order.status not in ("confirmed", "fulfilled"):
        raise HTTPException(
            status_code=400, detail="Order must be confirmed before invoicing"
        )

    existing = await db.execute(select(Invoice).where(Invoice.order_id == order_id))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400, detail="Invoice already exists for this order"
        )

    count_result = await db.execute(
        select(func.count()).where(Invoice.supplier_id == supplier_id)
    )
    count = count_result.scalar() + 1
    now = datetime.now(timezone.utc)
    number = f"INV-{now.year}-{now.month:02d}{now.day:02d}-{count:04d}"

    invoice = Invoice(
        supplier_id=supplier_id,
        order_id=order_id,
        number=number,
        currency=order.currency,
        total=order.total,
    )
    db.add(invoice)
    order.status = "invoiced"

    # Increase client's outstanding balance
    from clients.models import Client

    client_result = await db.execute(select(Client).where(Client.id == order.client_id))
    client = client_result.scalar_one_or_none()
    if client:
        client.credit_balance = (client.credit_balance or Decimal("0")) + invoice.total

    await db.commit()
    await db.refresh(invoice)
    return invoice
