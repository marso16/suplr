from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select, text, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_admin
from auth.service import create_access_token, hash_password
from clients.models import Client
from database import get_db
from invoices.models import Invoice
from orders.models import Order
from suppliers.models import Supplier, SupplierOut, SupplierWithStats, WhatsAppConnection

router = APIRouter(prefix="/admin", tags=["admin"])


class PlanIn(BaseModel):
    plan: str


class CreateSupplierIn(BaseModel):
    name: str
    email: str
    password: str


class BroadcastIn(BaseModel):
    subject: str
    message: str


@router.post("/suppliers", response_model=SupplierOut, status_code=201)
async def create_supplier(
    data: CreateSupplierIn,
    _: Supplier = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(Supplier).where(Supplier.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    supplier = Supplier(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        plan="pro",
        must_change_password=True,
    )
    db.add(supplier)
    await db.commit()
    await db.refresh(supplier)
    return supplier


@router.get("/suppliers", response_model=list[SupplierWithStats])
async def list_suppliers(
    _: Supplier = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    result = await db.execute(
        select(
            Supplier,
            func.count(distinct(Order.id)).label("order_count"),
            func.count(distinct(Invoice.id)).label("invoice_count"),
            func.count(distinct(Client.id)).label("client_count"),
            func.max(Order.created_at).label("last_order_at"),
        )
        .outerjoin(Order, Order.supplier_id == Supplier.id)
        .outerjoin(Invoice, Invoice.supplier_id == Supplier.id)
        .outerjoin(Client, Client.supplier_id == Supplier.id)
        .group_by(Supplier.id)
        .order_by(Supplier.created_at.desc())
    )
    rows = result.all()
    out = []
    for supplier, order_count, invoice_count, client_count, last_order_at in rows:
        s = SupplierWithStats.model_validate(supplier)
        s.order_count = order_count or 0
        s.invoice_count = invoice_count or 0
        s.client_count = client_count or 0
        s.is_active = bool(last_order_at and last_order_at >= seven_days_ago)
        out.append(s)
    return out


@router.patch("/suppliers/{supplier_id}/plan", response_model=SupplierOut)
async def set_plan(
    supplier_id: int,
    data: PlanIn,
    _: Supplier = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    if data.plan not in ("pro",):
        raise HTTPException(status_code=400, detail="Plan must be 'pro'")
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    supplier.plan = data.plan
    await db.commit()
    await db.refresh(supplier)
    return supplier


@router.patch("/suppliers/{supplier_id}/suspend", response_model=SupplierOut)
async def toggle_suspend(
    supplier_id: int,
    _: Supplier = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    if supplier.is_admin:
        raise HTTPException(status_code=400, detail="Cannot suspend an admin account")
    supplier.suspended = not supplier.suspended
    await db.commit()
    await db.refresh(supplier)
    return supplier


@router.delete("/suppliers/{supplier_id}", status_code=204)
async def delete_supplier(
    supplier_id: int,
    _: Supplier = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    if supplier.is_admin:
        raise HTTPException(status_code=400, detail="Cannot delete an admin account")
    sid = supplier_id
    for stmt in [
        text("DELETE FROM invoices WHERE supplier_id = :sid"),
        text("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE supplier_id = :sid)"),
        text("DELETE FROM orders WHERE supplier_id = :sid"),
        text("DELETE FROM messages WHERE supplier_id = :sid"),
        text("DELETE FROM pending_orders WHERE supplier_id = :sid"),
        text("DELETE FROM clients WHERE supplier_id = :sid"),
        text("DELETE FROM products WHERE supplier_id = :sid"),
        text("DELETE FROM whatsapp_connections WHERE supplier_id = :sid"),
        text("DELETE FROM suppliers WHERE id = :sid"),
    ]:
        await db.execute(stmt, {"sid": sid})
    await db.commit()


@router.post("/suppliers/{supplier_id}/impersonate")
async def impersonate_supplier(
    supplier_id: int,
    _: Supplier = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    if supplier.is_admin:
        raise HTTPException(status_code=400, detail="Cannot impersonate admin")
    token = create_access_token(supplier.id)
    return {"access_token": token}


@router.get("/orders")
async def list_all_orders(
    _: Supplier = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(
            Order.id,
            Order.status,
            Order.created_at,
            Supplier.name.label("supplier_name"),
            Client.name.label("client_name"),
        )
        .join(Supplier, Supplier.id == Order.supplier_id)
        .join(Client, Client.id == Order.client_id)
        .order_by(Order.created_at.desc())
        .limit(200)
    )
    return [
        {
            "id": row.id,
            "status": row.status,
            "created_at": row.created_at,
            "supplier_name": row.supplier_name,
            "client_name": row.client_name,
        }
        for row in result.all()
    ]


@router.post("/broadcast", status_code=204)
async def broadcast_to_suppliers(
    data: BroadcastIn,
    _: Supplier = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Supplier).where(Supplier.is_admin.is_(False), Supplier.suspended.is_(False))
    )
    suppliers = result.scalars().all()
    if not suppliers:
        return

    from config import get_settings
    import smtplib
    from email.message import EmailMessage

    s = get_settings()
    if not s.smtp_user:
        raise HTTPException(status_code=503, detail="SMTP not configured")

    errors = []
    for supplier in suppliers:
        try:
            msg = EmailMessage()
            msg["Subject"] = data.subject
            msg["From"] = s.email_from or s.smtp_user
            msg["To"] = supplier.email
            msg.set_content(data.message)
            with smtplib.SMTP(s.smtp_host, s.smtp_port) as srv:
                srv.starttls()
                srv.login(s.smtp_user, s.smtp_pass)
                srv.send_message(msg)
        except Exception as e:
            errors.append(f"{supplier.email}: {e}")

    if errors:
        raise HTTPException(status_code=502, detail="; ".join(errors))
