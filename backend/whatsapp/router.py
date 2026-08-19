import json
import logging
from fastapi import APIRouter, Request, HTTPException, Depends, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from config import get_settings
from suppliers.models import Supplier
from cache import is_message_seen, mark_message_seen
from whatsapp.service import (
    handle_inbound_message,
    send_ack,
    parse_and_create_order,
    handle_pending_confirmation,
    handle_name_collection,
    handle_history_query,
    _is_history_query,
)

router = APIRouter(prefix="/webhook", tags=["webhook"])
logger = logging.getLogger(__name__)


@router.get("/{supplier_id}")
async def verify_webhook(
    supplier_id: int,
    hub_mode: str = Query(alias="hub.mode", default=""),
    hub_verify_token: str = Query(alias="hub.verify_token", default=""),
    hub_challenge: str = Query(alias="hub.challenge", default=""),
):
    """Meta webhook verification (kept for future use)."""
    settings = get_settings()
    if hub_mode == "subscribe" and hub_verify_token == settings.webhook_verify_token:
        return PlainTextResponse(hub_challenge)
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/{supplier_id}")
async def receive_webhook(
    supplier_id: int, request: Request, db: AsyncSession = Depends(get_db)
):
    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        # Raw JSON (custom BSP / manual testing)
        payload = await request.json()
        for msg in payload.get("messages", []):
            if msg.get("type") != "text":
                continue
            await _process(supplier_id, msg["id"], msg["from"], msg["text"]["body"], db)

    else:
        # Twilio WhatsApp Sandbox — sends application/x-www-form-urlencoded
        form = await request.form()
        msg_id = form.get("MessageSid", "")
        from_number = str(form.get("From", "")).replace("whatsapp:", "")
        body = str(form.get("Body", ""))
        if from_number and body:
            await _process(supplier_id, msg_id, from_number, body, db)

    return {"status": "ok"}


async def _process(
    supplier_id: int, msg_id: str, from_number: str, text: str, db: AsyncSession
) -> None:
    if msg_id and await is_message_seen(supplier_id, msg_id):
        logger.info("⏭️  Duplicate message %s for supplier %d — skipped", msg_id, supplier_id)
        return
    if msg_id:
        await mark_message_seen(supplier_id, msg_id)

    message = await handle_inbound_message(supplier_id, msg_id, from_number, text, db)

    # New client gate: collect name before processing any order
    if await handle_name_collection(supplier_id, message.client_id, text, from_number, db):
        return

    # Check if the client is asking for their order history
    if _is_history_query(text):
        from clients.models import Client
        client_row = await db.get(Client, message.client_id)
        lang = client_row.preferred_language if client_row else "en"
        await handle_history_query(supplier_id, message.client_id, from_number, lang, db)
        return

    # Check if the client is responding to a pending order (YES / NO)
    handled = await handle_pending_confirmation(
        supplier_id, message.client_id, from_number, text, db
    )
    if handled:
        return

    # Otherwise parse as a new order → creates pending, sends summary
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()
    if supplier:
        await parse_and_create_order(supplier, message, from_number, db)
