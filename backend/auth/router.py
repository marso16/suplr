from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from database import get_db
from suppliers.models import Supplier, SupplierOut, WhatsAppConnection
from auth.service import hash_password, verify_password, create_access_token
from auth.dependencies import get_current_supplier, get_current_admin

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterIn(BaseModel):
    name: str
    email: str
    password: str


class LoginIn(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/register", response_model=SupplierOut, status_code=201)
async def register(
    data: RegisterIn,
    _: Supplier = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(Supplier).where(Supplier.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    supplier = Supplier(
        name=data.name, email=data.email, password_hash=hash_password(data.password)
    )
    db.add(supplier)
    await db.commit()
    await db.refresh(supplier)
    return supplier


@router.post("/login", response_model=TokenOut)
async def login(data: LoginIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Supplier).where(Supplier.email == data.email))
    supplier = result.scalar_one_or_none()
    if not supplier or not verify_password(data.password, supplier.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    return TokenOut(access_token=create_access_token(supplier.id))


@router.get("/me", response_model=SupplierOut)
async def me(supplier: Supplier = Depends(get_current_supplier)):
    return supplier


class ProfileIn(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    logo: Optional[str] = None


@router.put("/profile", response_model=SupplierOut)
async def update_profile(
    data: ProfileIn,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(supplier, field, value or None)
    await db.commit()
    await db.refresh(supplier)
    return supplier


class WhatsAppConnectionIn(BaseModel):
    bsp_endpoint: str
    bsp_api_key: str
    phone_number: str


class WhatsAppConnectionOut(BaseModel):
    bsp_endpoint: str
    phone_number: str
    model_config = {"from_attributes": True}


@router.put("/whatsapp-connection", response_model=WhatsAppConnectionOut)
async def upsert_whatsapp_connection(
    data: WhatsAppConnectionIn,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WhatsAppConnection).where(WhatsAppConnection.supplier_id == supplier.id)
    )
    conn = result.scalar_one_or_none()
    if conn:
        conn.bsp_endpoint = data.bsp_endpoint
        conn.bsp_api_key = data.bsp_api_key
        conn.phone_number = data.phone_number
    else:
        conn = WhatsAppConnection(
            supplier_id=supplier.id,
            bsp_endpoint=data.bsp_endpoint,
            bsp_api_key=data.bsp_api_key,
            phone_number=data.phone_number,
        )
        db.add(conn)
    await db.commit()
    await db.refresh(conn)
    return conn


@router.get("/whatsapp-connection", response_model=Optional[WhatsAppConnectionOut])
async def get_whatsapp_connection(
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WhatsAppConnection).where(WhatsAppConnection.supplier_id == supplier.id)
    )
    return result.scalar_one_or_none()


@router.patch("/me/plan", response_model=SupplierOut)
async def update_plan(
    plan: str,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    if plan not in ("pro",):
        raise HTTPException(status_code=400, detail="Plan must be 'pro'")
    supplier.plan = plan
    await db.commit()
    await db.refresh(supplier)
    return supplier
