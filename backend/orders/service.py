from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from orders.models import Order, OrderItem, OrderItemIn
from fastapi import HTTPException


async def create_order(
    supplier_id: int,
    client_id: int,
    currency: str,
    items: list[OrderItemIn],
    db: AsyncSession,
) -> Order:
    total = sum(i.price * i.quantity for i in items)
    order = Order(
        supplier_id=supplier_id, client_id=client_id, currency=currency, total=total
    )
    db.add(order)
    await db.flush()
    for item in items:
        db.add(OrderItem(order_id=order.id, **item.model_dump()))
    await db.commit()
    await db.refresh(order)
    return order


async def get_order(order_id: int, supplier_id: int, db: AsyncSession) -> Order:
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.supplier_id == supplier_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


async def confirm_order(order_id: int, supplier_id: int, db: AsyncSession) -> Order:
    order = await get_order(order_id, supplier_id, db)
    order.status = "confirmed"
    order.confirmed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(order)
    from sse.events import publish_order_event

    await publish_order_event(supplier_id, "order_updated", order_id)
    return order


async def fulfill_order(order_id: int, supplier_id: int, db: AsyncSession) -> Order:
    order = await get_order(order_id, supplier_id, db)
    order.status = "fulfilled"
    await db.commit()
    await db.refresh(order)
    from sse.events import publish_order_event

    await publish_order_event(supplier_id, "order_updated", order_id)
    return order
