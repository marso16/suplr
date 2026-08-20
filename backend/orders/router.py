import io
import csv
from datetime import date, datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from auth.dependencies import get_current_supplier
from suppliers.models import Supplier
from orders.models import Order, OrderIn, OrderOut, fmt_qty
from orders.service import create_order, confirm_order, fulfill_order, get_order

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", response_model=OrderOut, status_code=201)
async def create(
    data: OrderIn,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    order = await create_order(supplier.id, data.client_id, data.currency, data.items, db)
    from sse.events import publish_order_event
    await publish_order_event(supplier.id, "order_created", order.id)
    return order


@router.get("", response_model=list[OrderOut])
async def list_orders(
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Order)
        .where(Order.supplier_id == supplier.id)
        .order_by(Order.created_at.desc())
    )
    return result.scalars().all()


@router.get("/export")
async def export_orders(
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Order)
        .where(Order.supplier_id == supplier.id)
        .order_by(Order.created_at.desc())
    )
    orders = result.scalars().all()

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(
        [
            "Order ID",
            "Date",
            "Client",
            "Status",
            "Currency",
            "Product",
            "Qty",
            "Unit",
            "Unit Price",
            "Line Total",
            "Order Total",
            "Delivery Date",
            "Notes",
        ]
    )
    for order in orders:
        for item in order.items:
            w.writerow(
                [
                    order.id,
                    order.created_at.strftime("%Y-%m-%d %H:%M"),
                    order.client.name,
                    order.status,
                    order.currency,
                    item.product_name,
                    fmt_qty(item.quantity),
                    item.unit,
                    str(item.price),
                    str((item.quantity * item.price).quantize(item.price)),
                    str(order.total),
                    order.delivery_date.isoformat() if order.delivery_date else "",
                    order.notes or "",
                ]
            )

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return Response(
        content=buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="orders-{stamp}.csv"'},
    )


@router.get("/{order_id}", response_model=OrderOut)
async def get_order_detail(
    order_id: int,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    return await get_order(order_id, supplier.id, db)


@router.patch("/{order_id}/confirm", response_model=OrderOut)
async def confirm(
    order_id: int,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    order = await confirm_order(order_id, supplier.id, db)
    from whatsapp.service import send_order_confirmation

    await send_order_confirmation(
        supplier.id,
        order.client.whatsapp_number,
        order.id,
        db,
        lang=order.client.preferred_language,
    )
    return order


@router.patch("/{order_id}/fulfill", response_model=OrderOut)
async def fulfill(
    order_id: int,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    return await fulfill_order(order_id, supplier.id, db)


class DeliveryDateIn(BaseModel):
    delivery_date: Optional[date] = None


class NotesIn(BaseModel):
    notes: Optional[str] = None


@router.patch("/{order_id}/delivery-date", response_model=OrderOut)
async def set_delivery_date(
    order_id: int,
    data: DeliveryDateIn,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.supplier_id == supplier.id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.delivery_date = data.delivery_date
    await db.commit()
    await db.refresh(order)
    return order


@router.patch("/{order_id}/notes", response_model=OrderOut)
async def set_notes(
    order_id: int,
    data: NotesIn,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.supplier_id == supplier.id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.notes = data.notes or None
    await db.commit()
    await db.refresh(order)
    return order
