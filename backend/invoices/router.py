import io
import csv
import logging
from decimal import Decimal

logger = logging.getLogger(__name__)
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from database import get_db
from auth.dependencies import get_current_supplier
from suppliers.models import Supplier
from invoices.models import Invoice, InvoiceOut
from invoices.service import create_invoice
from invoices.pdf import render_invoice_pdf
from orders.models import Order
from orders.service import get_order
from cache import invalidate_report_cache
from invoices.email import send_invoice_email
from clients.models import Client
from pydantic import BaseModel

router = APIRouter(prefix="/invoices", tags=["invoices"])


class InvoiceIn(BaseModel):
    order_id: int


@router.post("", response_model=InvoiceOut, status_code=201)
async def create(
    data: InvoiceIn,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    invoice = await create_invoice(data.order_id, supplier.id, db)

    # Send PDF to client via WhatsApp + email (non-blocking — failure doesn't affect response)
    order_result = await db.execute(
        select(Order)
        .where(Order.id == invoice.order_id)
        .options(selectinload(Order.items), selectinload(Order.client))
    )
    order = order_result.scalar_one_or_none()
    if order:
        client_result = await db.execute(
            select(Client).where(Client.id == order.client_id)
        )
        client = client_result.scalar_one_or_none()
        if client:
            from whatsapp.service import send_invoice_pdf

            pdf_bytes = render_invoice_pdf(invoice, order, supplier)

            # Cache PDF in R2 (non-blocking — failure doesn't affect response)
            try:
                from storage import upload_bytes

                await upload_bytes(
                    f"invoices/{invoice.id}.pdf", pdf_bytes, "application/pdf"
                )
                logger.debug("Uploaded invoice %s PDF to R2", invoice.number)
            except Exception as e:
                logger.debug("R2 PDF upload skipped: %s", e)

            await send_invoice_pdf(
                supplier.id, client.whatsapp_number, pdf_bytes, invoice.number, db
            )
            if client.email:
                try:
                    await send_invoice_email(
                        invoice, order, supplier, client.email, pdf_bytes
                    )
                except Exception as e:
                    logger.warning(
                        "Auto email failed for invoice %s: %s", invoice.number, e
                    )

    return invoice


@router.get("", response_model=list[InvoiceOut])
async def list_invoices(
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Invoice, Client.name.label("client_name"), Client.email.label("client_email"))
        .join(Order, Order.id == Invoice.order_id)
        .join(Client, Client.id == Order.client_id)
        .where(Invoice.supplier_id == supplier.id)
        .order_by(Invoice.issued_at.desc())
    )
    rows = result.all()
    return [
        InvoiceOut(
            **{c.key: getattr(inv, c.key) for c in Invoice.__table__.columns},
            client_name=client_name,
            client_email=client_email,
        )
        for inv, client_name, client_email in rows
    ]


@router.get("/export")
async def export_invoices(
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Invoice, Order, Client)
        .join(Order, Order.id == Invoice.order_id)
        .join(Client, Client.id == Order.client_id)
        .where(Invoice.supplier_id == supplier.id)
        .order_by(Invoice.issued_at.desc())
    )
    rows = result.all()

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(
        [
            "Invoice Number",
            "Order ID",
            "Client",
            "Issued Date",
            "Paid Date",
            "Currency",
            "Total",
            "Status",
        ]
    )
    for invoice, order, client in rows:
        w.writerow(
            [
                invoice.number,
                order.id,
                client.name,
                invoice.issued_at.strftime("%Y-%m-%d"),
                invoice.paid_at.strftime("%Y-%m-%d") if invoice.paid_at else "",
                invoice.currency,
                str(invoice.total),
                "Paid" if invoice.paid_at else "Outstanding",
            ]
        )

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return Response(
        content=buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="invoices-{stamp}.csv"'},
    )


@router.patch("/{invoice_id}/mark-paid", response_model=InvoiceOut)
async def mark_paid(
    invoice_id: int,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Invoice).where(
            Invoice.id == invoice_id, Invoice.supplier_id == supplier.id
        )
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.paid_at:
        raise HTTPException(status_code=400, detail="Invoice already paid")

    invoice.paid_at = datetime.now(timezone.utc)

    # Reduce client's outstanding balance
    order_result = await db.execute(select(Order).where(Order.id == invoice.order_id))
    order = order_result.scalar_one_or_none()
    if order:
        client_result = await db.execute(
            select(Client).where(Client.id == order.client_id)
        )
        client = client_result.scalar_one_or_none()
        if client:
            client.credit_balance = max(
                Decimal("0"),
                (client.credit_balance or Decimal("0")) - invoice.total,
            )

    await db.commit()
    await db.refresh(invoice)
    await invalidate_report_cache(supplier.id)
    return invoice


@router.post("/{invoice_id}/send-email", status_code=204)
async def send_email(
    invoice_id: int,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Invoice).where(
            Invoice.id == invoice_id, Invoice.supplier_id == supplier.id
        )
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    order_result = await db.execute(
        select(Order)
        .where(Order.id == invoice.order_id, Order.supplier_id == supplier.id)
        .options(selectinload(Order.items), selectinload(Order.client))
    )
    order = order_result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if not order.client.email:
        raise HTTPException(status_code=400, detail="Client has no email address")

    try:
        pdf_bytes = render_invoice_pdf(invoice, order, supplier)
        await send_invoice_email(invoice, order, supplier, order.client.email, pdf_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Email delivery failed: {exc}")


@router.get("/{invoice_id}/pdf")
async def get_pdf(
    invoice_id: int,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Invoice).where(
            Invoice.id == invoice_id, Invoice.supplier_id == supplier.id
        )
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Serve from R2 if cached
    try:
        from storage import key_exists, public_url

        r2_key = f"invoices/{invoice_id}.pdf"
        if await key_exists(r2_key):
            return RedirectResponse(url=public_url(r2_key), status_code=302)
    except Exception:
        pass

    order = await get_order(invoice.order_id, supplier.id, db)
    pdf_bytes = render_invoice_pdf(invoice, order, supplier)
    return Response(content=pdf_bytes, media_type="application/pdf")
