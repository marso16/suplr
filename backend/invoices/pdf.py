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
C_DARK = colors.HexColor("#0F172A")
C_NAVY = colors.HexColor("#1E293B")
C_MUTED = colors.HexColor("#64748B")
C_BORDER = colors.HexColor("#CBD5E1")
C_ALT = colors.HexColor("#F8FAFC")
C_WHITE = colors.white
C_PAID_BG = colors.HexColor("#DCFCE7")
C_PAID_FG = colors.HexColor("#15803D")
C_DUE_BG = colors.HexColor("#FEF9C3")
C_DUE_FG = colors.HexColor("#92400E")


def _ps(name="_", **kw) -> ParagraphStyle:
    return ParagraphStyle(name, **kw)


def _p(text, **kw) -> Paragraph:
    return Paragraph(text, _ps(**kw))


def render_invoice_pdf(
    invoice: Invoice,
    order: Order,
    supplier: Supplier,
) -> bytes:
    buf = io.BytesIO()
    W, H = 8.5 * inch, 10.0 * inch
    M = 0.55 * inch
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
    contact_parts = [p for p in [supplier.email, supplier.phone] if p]
    contact_line = "  ·  ".join(contact_parts)

    sup_left = (
        f'<font name="Helvetica-Bold" size="18" color="#FFFFFF">{supplier.name}</font>'
    )
    if getattr(supplier, "address", None):
        sup_left += f'<br/><font name="Helvetica" size="8" color="#94A3B8">{supplier.address}</font>'
    if contact_line:
        sup_left += f'<br/><font name="Helvetica" size="8" color="#94A3B8">{contact_line}</font>'

    inv_label = _p("INVOICE", fontName="Helvetica-Bold", fontSize=24, textColor=C_WHITE, alignment=2)

    logo_cell = None
    if getattr(supplier, "logo", None):
        try:
            b64_data = re.sub(r"^data:[^;]+;base64,", "", supplier.logo)
            logo_bytes = base64.b64decode(b64_data)
            logo_cell = Image(io.BytesIO(logo_bytes), width=0.85 * inch, height=0.5 * inch, kind="proportional")
        except Exception:
            logo_cell = None

    if logo_cell:
        header_data = [[logo_cell, _p(sup_left, leading=22), inv_label]]
        col_widths = [CW * 0.14, CW * 0.50, CW * 0.36]
    else:
        header_data = [[_p(sup_left, leading=26), inv_label]]
        col_widths = [CW * 0.62, CW * 0.38]

    header = Table(header_data, colWidths=col_widths)
    header.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), C_DARK),
                ("TOPPADDING", (0, 0), (-1, -1), 18),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 18),
                ("LEFTPADDING", (0, 0), (-1, -1), 16),
                ("RIGHTPADDING", (0, 0), (-1, -1), 16),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(header)
    story.append(Spacer(1, 16))

    # ── 2. BILL TO + INVOICE META ────────────────────────────────────────────
    client = order.client
    client_phone = re.sub(r"@(s\.whatsapp\.net|lid)$", "", client.whatsapp_number)

    bill_to = (
        '<font name="Helvetica-Bold" size="7" color="#64748B">BILL TO</font><br/>'
        f'<font name="Helvetica-Bold" size="11" color="#1E293B">{client.name}</font><br/>'
        f'<font name="Helvetica" size="9" color="#64748B">{client_phone}</font>'
    )

    meta = (
        '<font name="Helvetica-Bold" size="7" color="#64748B">INVOICE NUMBER</font>'
        f'<br/><font name="Helvetica-Bold" size="10" color="#1E293B">{invoice.number}</font>'
        "<br/><br/>"
        '<font name="Helvetica-Bold" size="7" color="#64748B">DATE ISSUED</font>'
        f'<br/><font name="Helvetica" size="9" color="#1E293B">{invoice.issued_at.strftime("%B %d, %Y")}</font>'
        "<br/><br/>"
        '<font name="Helvetica-Bold" size="7" color="#64748B">ORDER REFERENCE</font>'
        f'<br/><font name="Helvetica" size="9" color="#1E293B">#{order.id}</font>'
    )

    info = Table(
        [[_p(bill_to, leading=15), _p(meta, leading=15, alignment=2)]],
        colWidths=[CW * 0.5, CW * 0.5],
    )
    info.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(info)
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=1, color=C_BORDER, spaceAfter=16))

    # ── 3. ITEMS TABLE ───────────────────────────────────────────────────────
    th = _ps(fontName="Helvetica-Bold", fontSize=8, textColor=C_WHITE)
    th_c = _ps(fontName="Helvetica-Bold", fontSize=8, textColor=C_WHITE, alignment=1)
    th_r = _ps(fontName="Helvetica-Bold", fontSize=8, textColor=C_WHITE, alignment=2)
    td = _ps(fontName="Helvetica", fontSize=9, textColor=C_NAVY, leading=13)
    td_c = _ps(
        fontName="Helvetica", fontSize=9, textColor=C_MUTED, leading=13, alignment=1
    )
    td_r = _ps(
        fontName="Helvetica", fontSize=9, textColor=C_NAVY, leading=13, alignment=2
    )

    rows = [
        [
            Paragraph("Product Description", th),
            Paragraph("Qty", th_c),
            Paragraph("Unit Price", th_r),
            Paragraph("Amount", th_r),
        ]
    ]

    for item in order.items:
        line_total = item.quantity * item.price
        rows.append(
            [
                Paragraph(item.product_name, td),
                Paragraph(f"{fmt_qty(item.quantity)} {item.unit}", td_c),
                Paragraph(f"{item.price:.2f} {invoice.currency}", td_r),
                Paragraph(f"{line_total:.2f} {invoice.currency}", td_r),
            ]
        )

    col_w = [CW * 0.46, CW * 0.17, CW * 0.19, CW * 0.18]
    tbl = Table(rows, colWidths=col_w)

    tbl_ts = [
        ("BACKGROUND", (0, 0), (-1, 0), C_NAVY),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, C_BORDER),
    ]
    for i in range(1, len(rows)):
        if i % 2 == 0:
            tbl_ts.append(("BACKGROUND", (0, i), (-1, i), C_ALT))

    tbl.setStyle(TableStyle(tbl_ts))
    story.append(tbl)

    # ── 4. TOTAL BLOCK ───────────────────────────────────────────────────────
    total_tbl = Table(
        [
            [
                "",
                _p(
                    "Total Amount Due",
                    fontName="Helvetica-Bold",
                    fontSize=10,
                    textColor=C_MUTED,
                    alignment=2,
                ),
                _p(
                    f"{invoice.total:.2f} {invoice.currency}",
                    fontName="Helvetica-Bold",
                    fontSize=13,
                    textColor=C_NAVY,
                    alignment=2,
                ),
            ]
        ],
        colWidths=[CW * 0.44, CW * 0.31, CW * 0.25],
    )
    total_tbl.setStyle(
        TableStyle(
            [
                ("LINEABOVE", (0, 0), (-1, 0), 2, C_DARK),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(total_tbl)
    story.append(Spacer(1, 20))

    # ── 5. STATUS BADGE + FOOTER ─────────────────────────────────────────────
    is_paid = bool(invoice.paid_at)
    badge_bg = C_PAID_BG if is_paid else C_DUE_BG
    badge_fg = C_PAID_FG if is_paid else C_DUE_FG
    badge_txt = "PAID IN FULL" if is_paid else "PAYMENT OUTSTANDING"

    footer_tbl = Table(
        [
            [
                _p(
                    f"<b>{badge_txt}</b>",
                    fontName="Helvetica-Bold",
                    fontSize=9,
                    textColor=badge_fg,
                    alignment=1,
                ),
                _p(
                    "Thank you for your business!",
                    fontName="Helvetica",
                    fontSize=9,
                    textColor=C_MUTED,
                    alignment=2,
                ),
            ]
        ],
        colWidths=[CW * 0.35, CW * 0.65],
    )
    footer_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, 0), badge_bg),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(footer_tbl)

    doc.build(story)
    pdf_data = buf.getvalue()
    buf.close()
    return pdf_data
