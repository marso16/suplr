import io
import re
import base64
from decimal import Decimal
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from invoices.models import Invoice
from orders.models import Order, fmt_qty
from suppliers.models import Supplier

# ── Palette ────────────────────────────────────────────────────────────────
C_DARK     = colors.HexColor("#0F172A")   # header bg / heavy text
C_NAVY     = colors.HexColor("#1E293B")   # body text
C_ACCENT   = colors.HexColor("#10B981")   # emerald brand stripe / highlights
C_MUTED    = colors.HexColor("#64748B")   # secondary text / labels
C_LIGHT    = colors.HexColor("#F8FAFC")   # alternating row / card bg
C_BORDER   = colors.HexColor("#E2E8F0")   # table borders
C_WHITE    = colors.white
C_PAID_BG  = colors.HexColor("#DCFCE7")
C_PAID_FG  = colors.HexColor("#166534")
C_DUE_BG   = colors.HexColor("#FEF3C7")
C_DUE_FG   = colors.HexColor("#92400E")

LBP_RATE = 90_000


def _ps(name="_", **kw) -> ParagraphStyle:
    return ParagraphStyle(name, **kw)


def _p(text, **kw) -> Paragraph:
    return Paragraph(text, _ps(**kw))


def _label(text: str) -> str:
    return f'<font name="Helvetica-Bold" size="7" color="#94A3B8">{text.upper()}</font>'


def _val(text: str, size: int = 10, bold: bool = False, color: str = "#1E293B") -> str:
    face = "Helvetica-Bold" if bold else "Helvetica"
    return f'<font name="{face}" size="{size}" color="{color}">{text}</font>'


def render_invoice_pdf(
    invoice: Invoice,
    order: Order,
    supplier: Supplier,
) -> bytes:
    buf = io.BytesIO()
    W, H = 8.5 * inch, 11.0 * inch
    M = 0.65 * inch
    CW = W - 2 * M

    doc = SimpleDocTemplate(
        buf,
        pagesize=(W, H),
        leftMargin=M,
        rightMargin=M,
        topMargin=M,
        bottomMargin=M,
    )
    story = []

    # ── 1. HEADER BAND ───────────────────────────────────────────────────────
    contact_parts = [p for p in [supplier.email, getattr(supplier, "phone", None)] if p]
    contact_line = "  ·  ".join(contact_parts)

    sup_lines = f'<font name="Helvetica-Bold" size="17" color="#FFFFFF">{supplier.name}</font>'
    if getattr(supplier, "address", None):
        sup_lines += f'<br/><font name="Helvetica" size="8" color="#94A3B8">{supplier.address}</font>'
    if contact_line:
        sup_lines += f'<br/><font name="Helvetica" size="8" color="#94A3B8">{contact_line}</font>'

    inv_right = (
        '<font name="Helvetica-Bold" size="22" color="#FFFFFF">INVOICE</font>'
        f'<br/><font name="Helvetica-Bold" size="11" color="#10B981">{invoice.number}</font>'
    )

    logo_cell = None
    if getattr(supplier, "logo", None):
        try:
            b64_data = re.sub(r"^data:[^;]+;base64,", "", supplier.logo)
            logo_cell = Image(
                io.BytesIO(base64.b64decode(b64_data)),
                width=0.9 * inch, height=0.55 * inch, kind="proportional",
            )
        except Exception:
            logo_cell = None

    if logo_cell:
        hdr_data = [[logo_cell, _p(sup_lines, leading=18), _p(inv_right, leading=22, alignment=2)]]
        hdr_cols = [CW * 0.13, CW * 0.50, CW * 0.37]
    else:
        hdr_data = [[_p(sup_lines, leading=22), _p(inv_right, leading=22, alignment=2)]]
        hdr_cols = [CW * 0.62, CW * 0.38]

    header = Table(hdr_data, colWidths=hdr_cols)
    header.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), C_DARK),
        ("TOPPADDING",    (0, 0), (-1, -1), 20),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 20),
        ("LEFTPADDING",   (0, 0), (-1, -1), 18),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 18),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(header)

    # Signature emerald stripe
    accent_bar = Table([[""]],  colWidths=[CW])
    accent_bar.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), C_ACCENT),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(accent_bar)
    story.append(Spacer(1, 18))

    # ── 2. BILL TO  +  INVOICE META ─────────────────────────────────────────
    client = order.client
    client_phone = re.sub(r"@(s\.whatsapp\.net|lid)$", "", client.whatsapp_number)

    # Bill To card with left accent border (simulated via nested table)
    bill_inner = (
        f'{_label("Bill To")}<br/>'
        f'{_val(client.name, size=12, bold=True)}<br/>'
        f'{_val(client_phone, size=9, color="#64748B")}'
    )
    if getattr(client, "credit_terms", None):
        bill_inner += f'<br/><font name="Helvetica" size="8" color="#64748B">Terms: {client.credit_terms}</font>'

    # Accent left-bar card: 3pt emerald | content
    bill_card = Table(
        [["", _p(bill_inner, leading=16)]],
        colWidths=[4, CW * 0.44 - 4],
    )
    bill_card.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (0, 0), C_ACCENT),
        ("BACKGROUND",    (1, 0), (1, 0), C_LIGHT),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
        ("TOPPADDING",    (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING",   (1, 0), (1, 0), 12),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
    ]))

    # Invoice meta card (right side)
    issued = invoice.issued_at.strftime("%B %d, %Y")
    meta_lines = (
        f'{_label("Invoice Date")}<br/>{_val(issued, size=9)}'
        "<br/><br/>"
        f'{_label("Order Reference")}<br/>{_val(f"#{order.id}", size=9)}'
    )
    if order.delivery_date:
        meta_lines += f'<br/><br/>{_label("Delivery Date")}<br/>{_val(order.delivery_date.strftime("%B %d, %Y"), size=9)}'
    if getattr(client, "credit_terms", None):
        meta_lines += f'<br/><br/>{_label("Payment Terms")}<br/>{_val(client.credit_terms, size=9)}'

    meta_card = Table(
        [[_p(meta_lines, leading=15, alignment=2)]],
        colWidths=[CW * 0.46],
    )
    meta_card.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), C_LIGHT),
        ("LEFTPADDING",   (0, 0), (-1, -1), 14),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 14),
        ("TOPPADDING",    (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
    ]))

    row2 = Table(
        [[bill_card, "", meta_card]],
        colWidths=[CW * 0.44, CW * 0.1, CW * 0.46],
    )
    row2.setStyle(TableStyle([
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(row2)
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_BORDER, spaceAfter=16))

    # ── 3. ITEMS TABLE ───────────────────────────────────────────────────────
    th  = _ps(fontName="Helvetica-Bold", fontSize=8,  textColor=C_WHITE)
    th_c = _ps(fontName="Helvetica-Bold", fontSize=8, textColor=C_WHITE, alignment=1)
    th_r = _ps(fontName="Helvetica-Bold", fontSize=8, textColor=C_WHITE, alignment=2)
    td  = _ps(fontName="Helvetica",       fontSize=9,  textColor=C_NAVY, leading=13)
    td_c = _ps(fontName="Helvetica",      fontSize=9,  textColor=C_MUTED, leading=13, alignment=1)
    td_r = _ps(fontName="Helvetica",      fontSize=9,  textColor=C_NAVY, leading=13, alignment=2)
    td_sub = _ps(fontName="Helvetica",    fontSize=8,  textColor=C_MUTED, leading=12)

    rows = [[
        Paragraph("Description", th),
        Paragraph("Qty", th_c),
        Paragraph("Unit Price", th_r),
        Paragraph("Amount", th_r),
    ]]

    for item in order.items:
        line_total = item.quantity * item.price
        desc = item.product_name
        if getattr(item, "notes", None):
            desc += f'<br/><font name="Helvetica" size="7.5" color="#94A3B8">{item.notes}</font>'
        rows.append([
            Paragraph(desc, td),
            Paragraph(f"{fmt_qty(item.quantity)} {item.unit}", td_c),
            Paragraph(f"{item.price:.2f} {invoice.currency}", td_r),
            Paragraph(f"{line_total:.2f}", td_r),
        ])

    col_w = [CW * 0.46, CW * 0.16, CW * 0.20, CW * 0.18]
    tbl = Table(rows, colWidths=col_w)
    tbl_ts = [
        ("BACKGROUND",    (0, 0), (-1, 0),  C_DARK),
        ("TOPPADDING",    (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW",     (0, 0), (-1, -1), 0.4, C_BORDER),
    ]
    for i in range(1, len(rows)):
        if i % 2 == 0:
            tbl_ts.append(("BACKGROUND", (0, i), (-1, i), C_LIGHT))
    tbl.setStyle(TableStyle(tbl_ts))
    story.append(tbl)
    story.append(Spacer(1, 6))

    # ── 4. TOTALS BLOCK ──────────────────────────────────────────────────────
    total_val = Decimal(str(invoice.total))
    total_str = f"{total_val:.2f} {invoice.currency}"

    total_rows = []

    # Subtotal (same as total unless tax added in future)
    total_rows.append([
        "", "",
        _p(_val("Subtotal", size=9, color="#64748B"), alignment=2),
        _p(_val(total_str, size=9, color="#64748B"), alignment=2),
    ])

    # Divider row
    total_rows.append(["", "", "", ""])

    # Grand total
    total_rows.append([
        "", "",
        _p(_val("Total", size=11, bold=True), alignment=2),
        _p(_val(total_str, size=11, bold=True), alignment=2),
    ])

    # LBP equivalent
    if invoice.currency == "USD":
        lbp_amt = int(total_val * LBP_RATE)
        lbp_str = f"≈ {lbp_amt:,} LBP".replace(",", ",")
        total_rows.append([
            "", "",
            "",
            _p(f'<font name="Helvetica" size="8" color="#94A3B8">{lbp_str}</font>', alignment=2),
        ])

    tot_col = [CW * 0.36, CW * 0.08, CW * 0.30, CW * 0.26]
    tot_tbl = Table(total_rows, colWidths=tot_col)
    tot_ts = [
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        # subtotal top line
        ("LINEABOVE",     (2, 0), (-1, 0), 0.5, C_BORDER),
        # total row highlight
        ("BACKGROUND",    (2, 2), (-1, 2), C_DARK),
        ("TOPPADDING",    (2, 2), (-1, 2), 9),
        ("BOTTOMPADDING", (2, 2), (-1, 2), 9),
    ]
    # Override text color for total row to white
    tot_tbl.setStyle(TableStyle(tot_ts))
    # Re-render the total row with white text directly
    total_rows[2][2] = _p(_val("Total", size=11, bold=True, color="#FFFFFF"), alignment=2)
    total_rows[2][3] = _p(_val(total_str, size=11, bold=True, color="#FFFFFF"), alignment=2)
    tot_tbl = Table(total_rows, colWidths=tot_col)
    tot_tbl.setStyle(TableStyle(tot_ts))
    story.append(tot_tbl)
    story.append(Spacer(1, 22))

    # ── 5. NOTES (if any) ────────────────────────────────────────────────────
    if getattr(order, "notes", None) and order.notes.strip():
        notes_inner = (
            f'{_label("Special Instructions")}<br/>'
            f'<font name="Helvetica" size="9" color="#475569">{order.notes.strip()}</font>'
        )
        notes_tbl = Table(
            [[_p(notes_inner, leading=15)]],
            colWidths=[CW],
        )
        notes_tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), C_LIGHT),
            ("LEFTPADDING",   (0, 0), (-1, -1), 14),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 14),
            ("TOPPADDING",    (0, 0), (-1, -1), 11),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
            ("BOX",           (0, 0), (-1, -1), 0.5, C_BORDER),
        ]))
        story.append(notes_tbl)
        story.append(Spacer(1, 18))

    # ── 6. FOOTER ────────────────────────────────────────────────────────────
    is_paid = bool(invoice.paid_at)
    badge_bg = C_PAID_BG if is_paid else C_DUE_BG
    badge_fg_hex = "#166534" if is_paid else "#92400E"
    badge_txt = "PAID IN FULL" if is_paid else "PAYMENT OUTSTANDING"

    paid_date = ""
    if is_paid and invoice.paid_at:
        paid_date = f'<br/><font name="Helvetica" size="7.5" color="{badge_fg_hex}">{invoice.paid_at.strftime("%B %d, %Y")}</font>'

    badge_p = _p(
        f'<font name="Helvetica-Bold" size="8.5" color="{badge_fg_hex}">{badge_txt}</font>{paid_date}',
        leading=14, alignment=1,
    )
    thanks_p = _p(
        f'<font name="Helvetica" size="9" color="#64748B">Thank you for your business, {client.name}!</font>'
        f'<br/><font name="Helvetica" size="7.5" color="#94A3B8">Generated with Suplr · suplr.app</font>',
        leading=14, alignment=2,
    )

    footer = Table(
        [[badge_p, thanks_p]],
        colWidths=[CW * 0.30, CW * 0.70],
    )
    footer.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (0, 0), badge_bg),
        ("BACKGROUND",    (1, 0), (1, 0), C_WHITE),
        ("TOPPADDING",    (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING",   (0, 0), (-1, -1), 14),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 14),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("BOX",           (0, 0), (-1, -1), 0.5, C_BORDER),
        ("LINEAFTER",     (0, 0), (0, 0), 0.5, C_BORDER),
    ]))
    story.append(footer)

    doc.build(story)
    pdf_data = buf.getvalue()
    buf.close()
    return pdf_data
