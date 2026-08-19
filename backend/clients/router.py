from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from auth.dependencies import get_current_supplier
from suppliers.models import Supplier
from clients.models import Client, ClientIn, ClientOut

router = APIRouter(prefix="/clients", tags=["clients"])


@router.post("", response_model=ClientOut, status_code=201)
async def create_client(
    data: ClientIn,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    client = Client(supplier_id=supplier.id, **data.model_dump())
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client


@router.get("", response_model=list[ClientOut])
async def list_clients(
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Client).where(Client.supplier_id == supplier.id))
    return result.scalars().all()


@router.delete("/{client_id}", status_code=204)
async def delete_client(
    client_id: int,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Client).where(Client.id == client_id, Client.supplier_id == supplier.id)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    await db.delete(client)
    await db.commit()
