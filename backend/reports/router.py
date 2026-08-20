from datetime import datetime, timezone, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from auth.dependencies import get_current_supplier
from suppliers.models import Supplier
from orders.models import Order, OrderItem
from clients.models import Client
from products.models import Product
from cache import get_cached_report, set_cached_report

router = APIRouter(prefix="/reports", tags=["reports"])

SETTLED = ["confirmed", "fulfilled", "invoiced"]


class PeriodBucket(BaseModel):
    label: str
    revenue: Decimal
    order_count: int


class ProductStat(BaseModel):
    name: str
    revenue: Decimal
    order_count: int


class ClientStat(BaseModel):
    name: str
    revenue: Decimal
    order_count: int
    credit_balance: Decimal


class ReportOut(BaseModel):
    period: str
    revenue: Decimal
    order_count: int
    avg_order_value: Decimal
    buckets: list[PeriodBucket]
    top_products: list[ProductStat]
    top_clients: list[ClientStat]


def _bounds(period: str):
    now = datetime.now(timezone.utc)
    if period == "7d":
        return now - timedelta(days=7), now, "day"
    if period == "30d":
        return now - timedelta(days=30), now, "day"
    if period == "90d":
        return now - timedelta(days=90), now, "week"
    if period == "1y":
        return now - timedelta(days=365), now, "month"
    return None, now, "month"  # "all"


def _label(dt, trunc: str) -> str:
    if trunc == "month":
        return dt.strftime("%b %Y")
    return dt.strftime("%b %d")


@router.get("", response_model=ReportOut)
async def get_report(
    period: str = Query("30d", pattern="^(7d|30d|90d|1y|all)$"),
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    cached = await get_cached_report(supplier.id, period)
    if cached:
        return ReportOut.model_validate(cached)

    start, end, trunc = _bounds(period)
    sid = supplier.id

    base = [Order.supplier_id == sid, Order.status.in_(SETTLED)]
    if start:
        base.append(Order.created_at >= start)

    # ── Summary ──────────────────────────────────────────────────────────────
    row = (
        await db.execute(
            select(
                func.coalesce(func.sum(Order.total), 0).label("revenue"),
                func.count(Order.id).label("cnt"),
            ).where(*base)
        )
    ).one()
    revenue = Decimal(str(row.revenue))
    order_count = int(row.cnt)
    avg = (revenue / order_count).quantize(Decimal("0.01")) if order_count else Decimal("0")

    # ── Buckets ───────────────────────────────────────────────────────────────
    bucket_col = func.date_trunc(trunc, Order.created_at).label("bucket")
    bucket_rows = (
        await db.execute(
            select(
                bucket_col,
                func.coalesce(func.sum(Order.total), 0).label("revenue"),
                func.count(Order.id).label("cnt"),
            )
            .where(*base)
            .group_by(bucket_col)
            .order_by(bucket_col)
        )
    ).all()
    buckets = [
        PeriodBucket(
            label=_label(r.bucket, trunc),
            revenue=Decimal(str(r.revenue)),
            order_count=int(r.cnt),
        )
        for r in bucket_rows
    ]

    # ── Top products ──────────────────────────────────────────────────────────
    name_expr = func.coalesce(Product.name, OrderItem.product_name_raw)
    prod_conditions = [Order.supplier_id == sid, Order.status.in_(SETTLED)]
    if start:
        prod_conditions.append(Order.created_at >= start)

    prod_rows = (
        await db.execute(
            select(
                name_expr.label("name"),
                func.sum(OrderItem.quantity * OrderItem.price).label("revenue"),
                func.count(func.distinct(OrderItem.order_id)).label("cnt"),
            )
            .select_from(OrderItem)
            .join(Order, Order.id == OrderItem.order_id)
            .outerjoin(Product, Product.id == OrderItem.product_id)
            .where(*prod_conditions)
            .group_by(name_expr)
            .order_by(func.sum(OrderItem.quantity * OrderItem.price).desc())
            .limit(8)
        )
    ).all()
    top_products = [
        ProductStat(
            name=r.name,
            revenue=Decimal(str(r.revenue)),
            order_count=int(r.cnt),
        )
        for r in prod_rows
    ]

    # ── Top clients ───────────────────────────────────────────────────────────
    client_rows = (
        await db.execute(
            select(
                Client.name,
                func.sum(Order.total).label("revenue"),
                func.count(Order.id).label("cnt"),
                Client.credit_balance,
            )
            .join(Client, Client.id == Order.client_id)
            .where(*base)
            .group_by(Client.id, Client.name, Client.credit_balance)
            .order_by(func.sum(Order.total).desc())
            .limit(8)
        )
    ).all()
    top_clients = [
        ClientStat(
            name=r.name,
            revenue=Decimal(str(r.revenue)),
            order_count=int(r.cnt),
            credit_balance=Decimal(str(r.credit_balance)),
        )
        for r in client_rows
    ]

    result = ReportOut(
        period=period,
        revenue=revenue,
        order_count=order_count,
        avg_order_value=avg,
        buckets=buckets,
        top_products=top_products,
        top_clients=top_clients,
    )
    await set_cached_report(supplier.id, period, result.model_dump(mode="json"))
    return result
