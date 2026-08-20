import asyncio
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from auth.dependencies import get_current_supplier
from suppliers.models import Supplier, WhatsAppConnection
from clients.models import Client
from whatsapp.sender import send_message, enqueue_broadcast

router = APIRouter(prefix="/broadcast", tags=["broadcast"])
logger = logging.getLogger(__name__)


class BroadcastIn(BaseModel):
    message: str
    scheduled_at: Optional[datetime] = None
    media_url: Optional[str] = None


class BroadcastOut(BaseModel):
    sent: int
    failed: int
    total: int
    scheduled: bool = False
    job_id: Optional[str] = None


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

    numbers = [c.whatsapp_number for c in clients]

    # Scheduled — hand off to BullMQ
    if data.scheduled_at:
        job_id = await enqueue_broadcast(
            conn.bsp_endpoint, conn.bsp_api_key, numbers, data.message, data.scheduled_at, data.media_url
        )
        logger.info(
            "📅 Broadcast scheduled for %s — job %s (supplier %d)",
            data.scheduled_at.isoformat(), job_id, supplier.id,
        )
        return BroadcastOut(sent=0, failed=0, total=len(clients), scheduled=True, job_id=job_id)

    # Immediate — fire and gather
    async def _send_one(number: str) -> bool:
        try:
            await send_message(conn.bsp_endpoint, conn.bsp_api_key, number, data.message, data.media_url)
            return True
        except Exception as e:
            logger.error("Broadcast failed for %s: %s", number, e)
            return False

    results = await asyncio.gather(*[_send_one(n) for n in numbers])
    sent = sum(1 for r in results if r)
    failed = len(results) - sent
    logger.info("📢 Broadcast: %d/%d sent (supplier %d)", sent, len(clients), supplier.id)
    return BroadcastOut(sent=sent, failed=failed, total=len(clients))


@router.post("/upload")
async def upload_broadcast_media(
    file: UploadFile = File(...),
    supplier: Supplier = Depends(get_current_supplier),
):
    from storage import upload_bytes
    data = await file.read()
    ext = Path(file.filename or "media").suffix.lower() or ".bin"
    key = f"broadcasts/{supplier.id}/{uuid.uuid4().hex}{ext}"
    try:
        url = await upload_bytes(key, data, file.content_type or "application/octet-stream")
        return {"url": url}
    except RuntimeError:
        raise HTTPException(status_code=503, detail="File storage not configured")
