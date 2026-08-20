import asyncio
import logging
import re
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from decimal import Decimal

from config import get_settings
from invoices.models import Invoice
from orders.models import Order, fmt_qty
from suppliers.models import Supplier

logger = logging.getLogger(__name__)


def _html_template(invoice: Invoice, order: Order, supplier: Supplier) -> str:
    client = order.client
    client_phone = re.sub(r"@(s\.whatsapp\.net|lid)$", "", client.whatsapp_number)
    issued = invoice.issued_at.strftime("%B %d, %Y")
    is_paid = bool(invoice.paid_at)

    status_bg = "#dcfce7" if is_paid else "#fef3c7"
    status_fg = "#166534" if is_paid else "#92400E"
    status_txt = "PAID IN FULL" if is_paid else "PAYMENT OUTSTANDING"

    # Items rows
    rows_html = ""
    for item in order.items:
        line_total = item.quantity * item.price
        rows_html += f"""
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;color:#1e293b;font-size:14px;">{item.product_name}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px;text-align:center;">{fmt_qty(item.quantity)} {item.unit}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;color:#1e293b;font-size:14px;text-align:right;font-family:monospace;">{item.price:.2f} {invoice.currency}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;color:#1e293b;font-size:14px;text-align:right;font-family:monospace;font-weight:600;">{line_total:.2f}</td>
        </tr>"""

    # LBP equivalent
    total_val = Decimal(str(invoice.total))
    lbp_row = ""
    if invoice.currency == "USD":
        lbp_amt = int(total_val * get_settings().lbp_rate)
        lbp_row = f"""<tr><td colspan="4" style="padding:4px 16px 12px;text-align:right;color:#94a3b8;font-size:12px;">≈ {lbp_amt:,} LBP</td></tr>"""

    # Supplier contact
    contact_parts = [p for p in [supplier.email, getattr(supplier, "phone", None)] if p]
    contact_html = "  ·  ".join(contact_parts)
    address_html = (
        f'<br/><span style="color:#94a3b8;">{supplier.address}</span>'
        if getattr(supplier, "address", None)
        else ""
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
  <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

    <!-- Header -->
    <tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:28px 28px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">{supplier.name}</p>
            {address_html}
            <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">{contact_html}</p>
          </td>
          <td align="right" valign="top">
            <p style="margin:0;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">INVOICE</p>
            <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#10b981;">{invoice.number}</p>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Emerald stripe -->
    <tr><td style="background:#10b981;height:4px;"></td></tr>

    <!-- Bill To + Meta -->
    <tr><td style="background:#ffffff;padding:24px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:50%;vertical-align:top;border-left:3px solid #10b981;padding-left:12px;background:#f8fafc;">
            <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Bill To</p>
            <p style="margin:0;font-size:15px;font-weight:700;color:#1e293b;">{client.name}</p>
            <p style="margin:2px 0 0;font-size:13px;color:#64748b;font-family:monospace;">{client_phone}</p>
          </td>
          <td style="width:50%;vertical-align:top;text-align:right;padding-left:16px;">
            <p style="margin:0;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Invoice Date</p>
            <p style="margin:2px 0 12px;font-size:13px;color:#1e293b;">{issued}</p>
            <p style="margin:0;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Order Reference</p>
            <p style="margin:2px 0 0;font-size:13px;color:#1e293b;">#{order.id}</p>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Items table -->
    <tr><td style="background:#ffffff;padding:0 28px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
        <thead>
          <tr style="background:#1e293b;">
            <th style="padding:10px 16px;color:#ffffff;font-size:11px;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Description</th>
            <th style="padding:10px 16px;color:#ffffff;font-size:11px;text-align:center;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Qty</th>
            <th style="padding:10px 16px;color:#ffffff;font-size:11px;text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Unit Price</th>
            <th style="padding:10px 16px;color:#ffffff;font-size:11px;text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows_html}
          <!-- Total -->
          <tr style="background:#0f172a;">
            <td colspan="3" style="padding:12px 16px;color:#ffffff;font-size:13px;font-weight:600;text-align:right;">Total</td>
            <td style="padding:12px 16px;color:#ffffff;font-size:15px;font-weight:700;text-align:right;font-family:monospace;">{total_val:.2f} {invoice.currency}</td>
          </tr>
          {lbp_row}
        </tbody>
      </table>
    </td></tr>

    <!-- Notes -->
    {"" if not (getattr(order, "notes", None) and order.notes.strip()) else f'''
    <tr><td style="background:#ffffff;padding:16px 28px 0;">
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;">
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Special Instructions</p>
        <p style="margin:0;font-size:13px;color:#475569;">{order.notes.strip()}</p>
      </div>
    </td></tr>'''}

    <!-- Status footer -->
    <tr><td style="background:#ffffff;padding:24px 28px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="background:{status_bg};padding:14px 20px;width:35%;">
            <p style="margin:0;font-size:12px;font-weight:700;color:{status_fg};text-align:center;">{status_txt}</p>
          </td>
          <td style="padding:14px 20px;text-align:right;">
            <p style="margin:0;font-size:13px;color:#64748b;">Thank you for your business, <strong>{client.name}</strong>!</p>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Footer -->
    <tr><td style="background:#0f172a;border-radius:0 0 12px 12px;padding:16px 28px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#475569;">Generated with <span style="color:#10b981;font-weight:600;">Suplr</span></p>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>"""


def _welcome_html(supplier_name: str, email: str, password: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
  <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

    <!-- Header -->
    <tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:32px 32px 28px;">
      <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Suplr</p>
      <p style="margin:6px 0 0;font-size:14px;color:#94a3b8;">Your B2B order management platform</p>
    </td></tr>

    <!-- Emerald stripe -->
    <tr><td style="background:#10b981;height:4px;"></td></tr>

    <!-- Body -->
    <tr><td style="background:#ffffff;padding:32px;">
      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Welcome, {supplier_name}! 👋</p>
      <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
        Your Suplr account is ready. Use the credentials below to sign in and start managing your orders.
      </p>

      <!-- Credentials box -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:28px;">
        <tr><td style="padding:20px 24px;">
          <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">Email</p>
          <p style="margin:0 0 16px;font-size:14px;color:#1e293b;font-family:monospace;">{email}</p>
          <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">Temporary Password</p>
          <p style="margin:0;font-size:14px;color:#1e293b;font-family:monospace;">{password}</p>
        </td></tr>
      </table>

      <!-- Steps -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td style="width:32px;vertical-align:top;padding-top:2px;">
            <span style="display:inline-block;width:22px;height:22px;background:#10b981;border-radius:50%;text-align:center;line-height:22px;font-size:11px;font-weight:700;color:#fff;">1</span>
          </td>
          <td style="padding-left:10px;padding-bottom:14px;">
            <p style="margin:0;font-size:14px;color:#1e293b;font-weight:600;">Sign in with your credentials above</p>
          </td>
        </tr>
        <tr>
          <td style="width:32px;vertical-align:top;padding-top:2px;">
            <span style="display:inline-block;width:22px;height:22px;background:#10b981;border-radius:50%;text-align:center;line-height:22px;font-size:11px;font-weight:700;color:#fff;">2</span>
          </td>
          <td style="padding-left:10px;padding-bottom:14px;">
            <p style="margin:0;font-size:14px;color:#1e293b;font-weight:600;">Change your password in Settings → Security</p>
          </td>
        </tr>
        <tr>
          <td style="width:32px;vertical-align:top;padding-top:2px;">
            <span style="display:inline-block;width:22px;height:22px;background:#10b981;border-radius:50%;text-align:center;line-height:22px;font-size:11px;font-weight:700;color:#fff;">3</span>
          </td>
          <td style="padding-left:10px;">
            <p style="margin:0;font-size:14px;color:#1e293b;font-weight:600;">Connect your WhatsApp and add your first products</p>
          </td>
        </tr>
      </table>

      <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
        If you have any questions, reply to this email and we'll help you get started.
      </p>
    </td></tr>

    <!-- Footer -->
    <tr><td style="background:#0f172a;border-radius:0 0 12px 12px;padding:16px 28px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#475569;">You're receiving this because an admin created your account on <span style="color:#10b981;font-weight:600;">Suplr</span></p>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>"""


async def send_welcome_email(supplier_name: str, to_email: str, password: str) -> None:
    settings = get_settings()
    if not settings.smtp_user or not settings.smtp_pass:
        raise ValueError("SMTP_USER and SMTP_PASS are not configured")

    from_addr = settings.email_from or settings.smtp_user
    html = _welcome_html(supplier_name, to_email, password)

    msg = MIMEMultipart("mixed")
    msg["From"] = from_addr
    msg["To"] = to_email
    msg["Subject"] = f"Welcome to Suplr — your account is ready"

    msg.attach(MIMEText(html, "html", "utf-8"))

    await asyncio.get_event_loop().run_in_executor(None, _send_smtp, settings, msg)
    logger.info("Welcome email sent to %s", to_email)


def _send_smtp(settings, msg: MIMEMultipart) -> None:
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
        smtp.ehlo()
        smtp.starttls()
        smtp.login(settings.smtp_user, settings.smtp_pass)
        smtp.send_message(msg)


async def send_invoice_email(
    invoice: Invoice,
    order: Order,
    supplier: Supplier,
    to_email: str,
    pdf_bytes: bytes,
) -> None:
    settings = get_settings()
    if not settings.smtp_user or not settings.smtp_pass:
        raise ValueError("SMTP_USER and SMTP_PASS are not configured")

    from_addr = settings.email_from or settings.smtp_user
    html = _html_template(invoice, order, supplier)

    msg = MIMEMultipart("mixed")
    msg["From"] = from_addr
    msg["To"] = to_email
    msg["Subject"] = f"Invoice {invoice.number} from {supplier.name}"
    if supplier.email:
        msg["Reply-To"] = supplier.email

    msg.attach(MIMEText(html, "html", "utf-8"))

    pdf_part = MIMEApplication(pdf_bytes, _subtype="pdf")
    pdf_part.add_header(
        "Content-Disposition", "attachment", filename=f"{invoice.number}.pdf"
    )
    msg.attach(pdf_part)

    await asyncio.get_event_loop().run_in_executor(None, _send_smtp, settings, msg)
    logger.info("Invoice email sent: invoice=%s to=%s", invoice.number, to_email)
