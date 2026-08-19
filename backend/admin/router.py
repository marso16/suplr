from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from database import get_db
from suppliers.models import Supplier, SupplierOut
from auth.dependencies import get_current_admin
from auth.service import hash_password

router = APIRouter(prefix="/admin", tags=["admin"])


class PlanIn(BaseModel):
    plan: str


class CreateSupplierIn(BaseModel):
    name: str
    email: str
    password: str


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
    )
    db.add(supplier)
    await db.commit()
    await db.refresh(supplier)
    return supplier


@router.get("/suppliers", response_model=list[SupplierOut])
async def list_suppliers(
    _: Supplier = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Supplier).order_by(Supplier.created_at.desc()))
    return result.scalars().all()


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
