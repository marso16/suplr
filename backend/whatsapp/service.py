import json
import logging
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from clients.service import get_or_create_client_by_number
from whatsapp.models import Message
from whatsapp.sender import send_message, send_document
from suppliers.models import WhatsAppConnection, Supplier
from products.service import get_active_products
from ai.parser import parse_order_message
from orders.service import create_order
from orders.models import Order, OrderItemIn, fmt_qty
from orders.pending import PendingOrder

logger = logging.getLogger(__name__)

YES_WORDS = {
    "yes",
    "y",
    "oui",
    "si",
    "ok",
    "okay",
    "sure",
    "confirm",
    "نعم",
    "أكيد",
    "تمام",
    "ايه",
    "اه",
}
NO_WORDS = {"no", "n", "non", "cancel", "annuler", "لا", "إلغاء", "نو"}

_HISTORY_PHRASES = {
    # English
    "history",
    "last order",
    "last time",
    "previous order",
    "my orders",
    "order history",
    "past order",
    "recent order",
    "what did i order",
    "what have i ordered",
    "show my orders",
    # French
    "historique",
    "dernière commande",
    "la dernière fois",
    "mes commandes",
    "commandes précédentes",
    "mes dernières commandes",
    # Arabic
    "طلبياتي",
    "آخر طلبية",
    "ماذا طلبت",
    "تاريخ طلبياتي",
    "طلبياتي السابقة",
    "ما طلبته",
    "الطلبية السابقة",
    "طلباتي",
}

_SKIP_WORDS = {"skip", "no", "none", "-", "n/a", "لا", "non", "passer", "aucun"}

_MSG = {
    "en": {
        "ask_email": "Got it, {name}! Do you have an email address? Reply with it or type *skip*.",
        "email_saved": "Perfect! Your email has been saved. You can now send your order.",
        "email_skipped": "No problem! You can now send your order.",
        "name_saved": "Thank you, {name}! You can now send your order.",
        "summary_header": "Here's a summary of your order:\n",
        "confirm_prompt": "\nReply *YES* to confirm or *NO* to cancel.",
        "total": "\nTotal: *{total:.2f} {currency}*",
        "order_received": "Your order has been received. We'll be in touch shortly.",
        "order_cancelled": "Your order has been cancelled. Feel free to reach out if you'd like to place a new order.",
        "order_confirmed": "Your order #{order_id} has been confirmed. Thank you — we'll keep you updated.",
        "history_header": "Here are your recent orders:",
        "history_empty": "You haven't placed any confirmed orders yet.",
        "history_order_line": "Order #{id} · {date}",
    },
    "fr": {
        "ask_email": "Compris, {name} ! Avez-vous une adresse email ? Répondez avec ou tapez *passer*.",
        "email_saved": "Parfait ! Votre email a été enregistré. Vous pouvez maintenant passer votre commande.",
        "email_skipped": "Pas de problème ! Vous pouvez maintenant passer votre commande.",
        "name_saved": "Merci, {name} ! Vous pouvez maintenant passer votre commande.",
        "summary_header": "Voici le récapitulatif de votre commande :\n",
        "confirm_prompt": "\nRépondez *OUI* pour confirmer ou *NON* pour annuler.",
        "total": "\nTotal : *{total:.2f} {currency}*",
        "order_received": "Votre commande a bien été reçue. Nous vous contacterons sous peu.",
        "order_cancelled": "Votre commande a été annulée. N'hésitez pas à nous contacter pour passer une nouvelle commande.",
        "order_confirmed": "Votre commande #{order_id} a été confirmée. Merci — nous vous tiendrons informé.",
        "history_header": "Voici vos commandes récentes :",
        "history_empty": "Vous n'avez pas encore de commandes confirmées.",
        "history_order_line": "Commande #{id} · {date}",
    },
    "ar": {
        "ask_email": "حسناً، {name}! هل لديك بريد إلكتروني؟ أرسله أو اكتب *تخطي*.",
        "email_saved": "ممتاز! تم حفظ بريدك الإلكتروني. يمكنك الآن إرسال طلبيتك.",
        "email_skipped": "لا بأس! يمكنك الآن إرسال طلبيتك.",
        "name_saved": "شكراً، {name}! يمكنك الآن إرسال طلبيتك.",
        "summary_header": "إليك ملخص طلبيتك:\n",
        "confirm_prompt": "\nأجب بـ *نعم* للتأكيد أو *لا* للإلغاء.",
        "total": "\nالمجموع: *{total:.2f} {currency}*",
        "order_received": "تم استلام طلبيتك. سنتواصل معك قريباً.",
        "order_cancelled": "تم إلغاء طلبيتك. لا تتردد في التواصل معنا لتقديم طلبية جديدة.",
        "order_confirmed": "تم تأكيد طلبيتك رقم #{order_id}. شكراً لك — سنبقيك على اطلاع.",
        "history_header": "إليك طلبياتك الأخيرة:",
        "history_empty": "لم تقم بأي طلبية مؤكدة بعد.",
        "history_order_line": "طلبية #{id} · {date}",
    },
}


def _t(lang: str, key: str, **kwargs) -> str:
    m = _MSG.get(lang, _MSG["en"])
    template = m.get(key, _MSG["en"][key])
    return template.format(**kwargs) if kwargs else template


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _get_connection(
    supplier_id: int, db: AsyncSession
) -> WhatsAppConnection | None:
    result = await db.execute(
        select(WhatsAppConnection).where(WhatsAppConnection.supplier_id == supplier_id)
    )
    return result.scalar_one_or_none()


async def _send(supplier_id: int, to: str, text: str, db: AsyncSession) -> None:
    conn = await _get_connection(supplier_id, db)
    if not conn:
        return
    try:
        await send_message(conn.bsp_endpoint, conn.bsp_api_key, to, text)
    except Exception as e:
        logger.error("❌ Failed to send message to %s: %s", to, e)


# ── Inbound message storage ───────────────────────────────────────────────────


async def handle_inbound_message(
    supplier_id: int, msg_id: str, from_number: str, body: str, db: AsyncSession
) -> Message:
    client = await get_or_create_client_by_number(supplier_id, from_number, db)
    message = Message(
        supplier_id=supplier_id,
        client_id=client.id,
        whatsapp_message_id=msg_id,
        direction="inbound",
        body=body,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return message


# ── First-contact name collection ────────────────────────────────────────────

_WELCOME = (
    "Welcome! Before we get started, could you please tell us your name?\n"
    "Bienvenue ! Quel est votre nom ?\n"
    "أهلاً! ما اسمك؟"
)


async def handle_name_collection(
    supplier_id: int, client_id: int, body: str, from_number: str, db: AsyncSession
) -> bool:
    """
    Onboarding gate that runs before order logic.
    Step 1 (msg 1):  send welcome + ask name
    Step 2 (msg 2):  save name, ask for email
    Step 3 (msg 3+): save email (or skip), set name_confirmed = True
    Confirmed clients bypass immediately.
    """
    from clients.models import Client
    from whatsapp.models import Message

    client = await db.get(Client, client_id)
    if not client or client.name_confirmed:
        return False

    count_result = await db.execute(
        select(func.count()).where(
            Message.client_id == client_id,
            Message.direction == "inbound",
        )
    )
    msg_count = count_result.scalar()

    if msg_count <= 1:
        await _send(supplier_id, from_number, _WELCOME, db)
        return True

    if msg_count == 2:
        # Save name, ask for email
        name = body.strip()[:200]
        client.name = name
        await db.commit()
        lang = client.preferred_language
        await _send(supplier_id, from_number, _t(lang, "ask_email", name=name), db)
        logger.info("👤 Name collected for client %d: %s", client_id, name)
        return True

    # Step 3 — save email or skip
    lang = client.preferred_language
    word = body.strip().lower()
    if word not in _SKIP_WORDS and "@" in body:
        client.email = body.strip()[:254]
        await db.commit()
        await _send(supplier_id, from_number, _t(lang, "email_saved"), db)
        logger.info("📧 Email collected for client %d: %s", client_id, client.email)
    else:
        await _send(supplier_id, from_number, _t(lang, "email_skipped"), db)

    client.name_confirmed = True
    await db.commit()
    return True


# ── Order history query ───────────────────────────────────────────────────────


def _is_history_query(text: str) -> bool:
    t = text.lower().strip()
    return any(phrase in t for phrase in _HISTORY_PHRASES)


async def handle_history_query(
    supplier_id: int, client_id: int, from_number: str, lang: str, db: AsyncSession
) -> bool:
    result = await db.execute(
        select(Order)
        .where(
            Order.supplier_id == supplier_id,
            Order.client_id == client_id,
            Order.status.in_(["confirmed", "fulfilled", "invoiced"]),
        )
        .order_by(Order.created_at.desc())
        .limit(5)
    )
    orders = result.scalars().all()

    if not orders:
        await _send(supplier_id, from_number, _t(lang, "history_empty"), db)
        return True

    lines = [_t(lang, "history_header")]
    for order in orders:
        date_str = order.created_at.strftime("%d %b %Y")
        lines.append(
            f"\n*{_t(lang, 'history_order_line', id=order.id, date=date_str)}*"
        )
        for item in order.items:
            lines.append(f"• {fmt_qty(item.quantity)} {item.unit} {item.product_name}")
        lines.append(f"_{order.total:.2f} {order.currency}_")

    await _send(supplier_id, from_number, "\n".join(lines), db)
    logger.info(
        "📋 Sent order history to client %d (%d orders)", client_id, len(orders)
    )
    return True


# ── Pending order confirmation ────────────────────────────────────────────────


async def handle_pending_confirmation(
    supplier_id: int, client_id: int, from_number: str, text: str, db: AsyncSession
) -> bool:
    """
    If there is a pending order for this client and the message is YES or NO,
    confirm or cancel it. Returns True if the message was consumed.
    """
    result = await db.execute(
        select(PendingOrder).where(
            PendingOrder.supplier_id == supplier_id,
            PendingOrder.client_id == client_id,
        )
    )
    pending = result.scalar_one_or_none()
    if not pending:
        return False

    from clients.models import Client

    client_row = await db.get(Client, client_id)
    lang = client_row.preferred_language if client_row else "en"

    word = text.strip().lower()

    if word in YES_WORDS:
        items_data = json.loads(pending.items_json)
        items = [
            OrderItemIn(
                product_name_raw=i["product_name_raw"],
                product_id=i["product_id"],
                quantity=Decimal(str(i["quantity"])),
                unit=i["unit"],
                price=Decimal(str(i["price"])),
                notes=i.get("notes"),
            )
            for i in items_data
        ]
        order = await create_order(supplier_id, client_id, pending.currency, items, db)
        await db.delete(pending)
        await db.commit()

        from sse.events import publish_order_event

        await publish_order_event(supplier_id, "order_created", order.id)
        await _send(supplier_id, from_number, _t(lang, "order_received"), db)
        logger.info("✅ Pending order confirmed → order #%d", order.id)
        return True

    if word in NO_WORDS:
        await db.delete(pending)
        await db.commit()
        await _send(supplier_id, from_number, _t(lang, "order_cancelled"), db)
        logger.info("🚫 Pending order cancelled for client %d", client_id)
        return True

    return False  # Not a yes/no — treat as a new message


# ── Order parsing ─────────────────────────────────────────────────────────────


async def parse_and_create_order(
    supplier: Supplier, message: "Message", from_number: str, db: AsyncSession
) -> bool:
    """Parse message, validate against catalog, create pending order, send summary."""
    if supplier.plan != "pro":
        return False

    products = await get_active_products(supplier.id, db)
    client = await get_or_create_client_by_number(supplier.id, from_number, db)
    parsed = await parse_order_message(message.body, products)

    if not parsed.is_order or parsed.confidence == "low":
        return False

    currency = parsed.currency
    lang = parsed.language

    # Persist the detected language so later notifications use it too
    client.preferred_language = lang
    await db.commit()

    price_map = {
        p.id: (p.price_lbp if currency == "LBP" else p.price_usd)
        for p in products
        if (p.price_lbp if currency == "LBP" else p.price_usd) is not None
    }

    # Only keep items that matched a catalog product
    matched = [i for i in parsed.items if i.product_id is not None]
    if not matched:
        logger.info("⚠️ No catalog matches for message from %s — skipping", from_number)
        return False

    items = [
        OrderItemIn(
            product_name_raw=i.product_name_raw,
            product_id=i.product_id,
            quantity=i.quantity,
            unit=i.unit,
            price=price_map.get(i.product_id, Decimal("0")),
            notes=i.notes,
        )
        for i in matched
    ]

    # Build summary message
    lines = [_t(lang, "summary_header")]
    total = Decimal("0")
    for item in items:
        line_total = item.price * item.quantity
        total += line_total
        lines.append(
            f"• {fmt_qty(item.quantity)} {item.unit} {item.product_name_raw} — {line_total:.2f} {currency}"
        )
    lines.append(_t(lang, "total", total=total, currency=currency))
    lines.append(_t(lang, "confirm_prompt"))
    summary = "\n".join(lines)

    # Replace any existing pending order for this client
    existing = await db.execute(
        select(PendingOrder).where(
            PendingOrder.supplier_id == supplier.id,
            PendingOrder.client_id == client.id,
        )
    )
    existing_pending = existing.scalar_one_or_none()
    if existing_pending:
        await db.delete(existing_pending)
        await db.flush()

    pending = PendingOrder(
        supplier_id=supplier.id,
        client_id=client.id,
        currency=currency,
        items_json=json.dumps([item.model_dump(mode="json") for item in items]),
    )
    db.add(pending)
    await db.commit()

    await _send(supplier.id, from_number, summary, db)
    logger.info(
        "📝 Pending order created for client %d, waiting for confirmation", client.id
    )
    return True


# ── Post-confirm notifications ────────────────────────────────────────────────


async def send_ack(supplier_id: int, to: str, db: AsyncSession) -> None:
    await _send(
        supplier_id, to, "Your order has been received. We'll be in touch shortly.", db
    )


async def send_order_confirmation(
    supplier_id: int,
    client_whatsapp: str,
    order_id: int,
    db: AsyncSession,
    lang: str = "en",
) -> None:
    conn = await _get_connection(supplier_id, db)
    if not conn:
        return
    try:
        await send_message(
            conn.bsp_endpoint,
            conn.bsp_api_key,
            client_whatsapp,
            _t(lang, "order_confirmed", order_id=order_id),
        )
        logger.info(
            "📱 Sent confirmation for order %d to %s", order_id, client_whatsapp
        )
    except Exception as e:
        logger.error(
            "❌ Failed to send order confirmation for order %d: %s", order_id, e
        )


async def send_invoice_pdf(
    supplier_id: int,
    client_whatsapp: str,
    pdf_bytes: bytes,
    invoice_number: str,
    db: AsyncSession,
) -> None:
    conn = await _get_connection(supplier_id, db)
    if not conn:
        return
    try:
        await send_document(
            conn.bsp_endpoint,
            conn.bsp_api_key,
            client_whatsapp,
            pdf_bytes,
            f"{invoice_number}.pdf",
        )
        logger.info("📄 Sent invoice PDF %s to %s", invoice_number, client_whatsapp)
    except Exception as e:
        logger.error("❌ Failed to send invoice PDF %s: %s", invoice_number, e)
