import asyncio
import logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from auth.dependencies import get_current_supplier
from suppliers.models import Supplier, WhatsAppConnection
from clients.models import Client
from whatsapp.sender import send_message

router = APIRouter(prefix="/broadcast", tags=["broadcast"])
logger = logging.getLogger(__name__)


class BroadcastIn(BaseModel):
    message: str


class BroadcastOut(BaseModel):
    sent: int
    failed: int
    total: int


@router.post("", response_model=BroadcastOut)
async def send_broadcast(
    data: BroadcastIn,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    conn_result = await db.execute(
        select(WhatsAppConnection).where(WhatsAppConnection.supplier_id == supplier.id)
    )
    conn = conn_result.scalar_one_or_none()
    if not conn:
        return BroadcastOut(sent=0, failed=0, total=0)

    clients_result = await db.execute(
        select(Client).where(Client.supplier_id == supplier.id)
    )
    clients = clients_result.scalars().all()

    if not clients:
        return BroadcastOut(sent=0, failed=0, total=0)

    async def _send_one(client: Client) -> bool:
        try:
            await send_message(
                conn.bsp_endpoint, conn.bsp_api_key, client.whatsapp_number, data.message
            )
            return True
        except Exception as e:
            logger.error("Broadcast failed for client %d (%s): %s", client.id, client.name, e)
            return False

    results = await asyncio.gather(*[_send_one(c) for c in clients])
    sent = sum(1 for r in results if r)
    failed = len(results) - sent

    logger.info("📢 Broadcast: %d/%d sent (supplier %d)", sent, len(clients), supplier.id)
    return BroadcastOut(sent=sent, failed=failed, total=len(clients))
