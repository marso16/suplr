import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Invoice } from '../entities/invoice.entity.js';
import type { Order } from '../entities/order.entity.js';
import type { Supplier } from '../entities/supplier.entity.js';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly lbpRate: number;

  constructor(private readonly config: ConfigService) {
    this.lbpRate = Number(config.get('LBP_RATE', '90000'));
  }

  private createTransport() {
    return nodemailer.createTransport({
      host: this.config.get('SMTP_HOST', 'smtp.gmail.com'),
      port: Number(this.config.get('SMTP_PORT', '587')),
      secure: false,
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });
  }

  private isConfigured(): boolean {
    const user = this.config.get<string>('SMTP_USER', '');
    const pass = this.config.get<string>('SMTP_PASS', '');
    return !!user && !!pass;
  }

  sendWelcomeEmail(
    supplierName: string,
    toEmail: string,
    password: string,
  ): void {
    if (!this.isConfigured()) {
      this.logger.warn('SMTP not configured — skipping welcome email');
      return;
    }
    const from =
      this.config.get<string>('EMAIL_FROM') ||
      this.config.get<string>('SMTP_USER');
    const html = this.buildWelcomeHtml(supplierName, toEmail, password);
    this.createTransport()
      .sendMail({
        from,
        to: toEmail,
        subject: 'Welcome to Suplr — your account is ready',
        html,
      })
      .then(() => this.logger.log(`Welcome email sent to ${toEmail}`))
      .catch((e: Error) =>
        this.logger.warn(`Welcome email failed: ${e.message}`),
      );
  }

  sendInvoiceEmail(
    invoice: Invoice,
    order: Order,
    supplier: Supplier,
    toEmail: string,
    pdfBytes: Buffer,
  ): void {
    if (!this.isConfigured()) throw new Error('SMTP not configured');
    const from =
      this.config.get<string>('EMAIL_FROM') ||
      this.config.get<string>('SMTP_USER');
    this.createTransport()
      .sendMail({
        from,
        to: toEmail,
        subject: `Invoice ${invoice.number} from ${supplier.name}`,
        replyTo: supplier.email || undefined,
        html: this.buildInvoiceHtml(invoice, order, supplier),
        attachments: [
          {
            filename: `${invoice.number}.pdf`,
            content: pdfBytes,
            contentType: 'application/pdf',
          },
        ],
      })
      .then(() =>
        this.logger.log(`Invoice email sent: ${invoice.number} → ${toEmail}`),
      )
      .catch((e: Error) => {
        this.logger.warn(`Invoice email failed: ${e.message}`);
        throw e;
      });
  }

  sendBroadcastEmail(toEmail: string, subject: string, message: string): void {
    if (!this.isConfigured()) {
      this.logger.warn('SMTP not configured — skipping broadcast email');
      return;
    }
    const from =
      this.config.get<string>('EMAIL_FROM') ||
      this.config.get<string>('SMTP_USER');
    this.createTransport()
      .sendMail({ from, to: toEmail, subject, text: message })
      .then(() => this.logger.log(`Broadcast email sent to ${toEmail}`))
      .catch((e: Error) =>
        this.logger.warn(`Broadcast email failed to ${toEmail}: ${e.message}`),
      );
  }

  private buildWelcomeHtml(
    name: string,
    email: string,
    password: string,
  ): string {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0">
<tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:32px;">
<p style="margin:0;font-size:28px;font-weight:800;color:#fff;">Suplr</p>
<p style="margin:6px 0 0;font-size:14px;color:#94a3b8;">Your B2B order management platform</p>
</td></tr>
<tr><td style="background:#10b981;height:4px;"></td></tr>
<tr><td style="background:#fff;padding:32px;">
<p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Welcome, ${name}!</p>
<p style="margin:0 0 24px;font-size:15px;color:#475569;">Your Suplr account is ready. Use the credentials below to sign in.</p>
<table width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:24px;">
<tr><td style="padding:20px 24px;">
<p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Email</p>
<p style="margin:0 0 16px;font-size:14px;color:#1e293b;font-family:monospace;">${email}</p>
<p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Temporary Password</p>
<p style="margin:0;font-size:14px;color:#1e293b;font-family:monospace;">${password}</p>
</td></tr></table>
<p style="margin:0;font-size:13px;color:#94a3b8;">Please change your password after first login in Settings → Security.</p>
</td></tr>
<tr><td style="background:#0f172a;border-radius:0 0 12px 12px;padding:16px 28px;text-align:center;">
<p style="margin:0;font-size:11px;color:#475569;">Generated with <span style="color:#10b981;font-weight:600;">Suplr</span></p>
</td></tr>
</table></td></tr></table></body></html>`;
  }

  private buildInvoiceHtml(
    invoice: Invoice,
    order: Order,
    supplier: Supplier,
  ): string {
    const isPaid = !!invoice.paidAt;
    const statusBg = isPaid ? '#dcfce7' : '#fef3c7';
    const statusFg = isPaid ? '#166534' : '#92400e';
    const statusTxt = isPaid ? 'PAID IN FULL' : 'PAYMENT OUTSTANDING';
    const clientName = order.client?.name ?? '';
    const clientPhone = (order.client?.whatsappNumber ?? '').replace(
      /@(s\.whatsapp\.net|lid)$/,
      '',
    );
    const issued = invoice.issuedAt.toLocaleDateString('en-US', {
      month: 'long',
      day: '2-digit',
      year: 'numeric',
    });

    let rows = '';
    for (const item of order.items) {
      const lineTotal = (
        parseFloat(item.price) * parseFloat(item.quantity)
      ).toFixed(2);
      rows += `<tr>
<td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;color:#1e293b;font-size:14px;">${item.productName}</td>
<td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px;text-align:center;">${parseFloat(item.quantity).toString()} ${item.unit}</td>
<td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;color:#1e293b;font-size:14px;text-align:right;font-family:monospace;">${parseFloat(item.price).toFixed(2)} ${invoice.currency}</td>
<td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;color:#1e293b;font-size:14px;text-align:right;font-family:monospace;font-weight:600;">${lineTotal}</td>
</tr>`;
    }

    let lbpRow = '';
    if (invoice.currency === 'USD') {
      const lbpAmt = Math.floor(parseFloat(invoice.total) * this.lbpRate);
      lbpRow = `<tr><td colspan="4" style="padding:4px 16px 12px;text-align:right;color:#94a3b8;font-size:12px;">≈ ${lbpAmt.toLocaleString()} LBP</td></tr>`;
    }

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0">
<tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:28px;">
<p style="margin:0;font-size:20px;font-weight:700;color:#fff;">${supplier.name}</p>
<p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">${supplier.email ?? ''}</p>
</td></tr>
<tr><td style="background:#10b981;height:4px;"></td></tr>
<tr><td style="background:#fff;padding:24px 28px;">
<p style="margin:0 0 4px;font-size:10px;color:#94a3b8;">BILL TO</p>
<p style="margin:0;font-size:15px;font-weight:700;color:#1e293b;">${clientName}</p>
<p style="margin:2px 0;font-size:13px;color:#64748b;">${clientPhone}</p>
<p style="margin:12px 0 0;text-align:right;font-size:13px;color:#1e293b;">${issued} &nbsp;|&nbsp; Order #${order.id}</p>
</td></tr>
<tr><td style="background:#fff;padding:0 28px;">
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;">
<thead><tr style="background:#1e293b;">
<th style="padding:10px 16px;color:#fff;font-size:11px;text-align:left;">Description</th>
<th style="padding:10px 16px;color:#fff;font-size:11px;text-align:center;">Qty</th>
<th style="padding:10px 16px;color:#fff;font-size:11px;text-align:right;">Unit Price</th>
<th style="padding:10px 16px;color:#fff;font-size:11px;text-align:right;">Amount</th>
</tr></thead>
<tbody>${rows}
<tr style="background:#0f172a;">
<td colspan="3" style="padding:12px 16px;color:#fff;font-weight:600;text-align:right;">Total</td>
<td style="padding:12px 16px;color:#fff;font-weight:700;text-align:right;font-family:monospace;">${parseFloat(invoice.total).toFixed(2)} ${invoice.currency}</td>
</tr>${lbpRow}
</tbody></table>
</td></tr>
<tr><td style="background:#fff;padding:24px 28px 28px;">
<table width="100%" style="border:1px solid #e2e8f0;border-radius:8px;"><tr>
<td style="background:${statusBg};padding:14px 20px;width:35%;"><p style="margin:0;font-size:12px;font-weight:700;color:${statusFg};text-align:center;">${statusTxt}</p></td>
<td style="padding:14px 20px;text-align:right;"><p style="margin:0;font-size:13px;color:#64748b;">Thank you for your business, <strong>${clientName}</strong>!</p></td>
</tr></table>
</td></tr>
<tr><td style="background:#0f172a;border-radius:0 0 12px 12px;padding:16px 28px;text-align:center;">
<p style="margin:0;font-size:11px;color:#475569;">Generated with <span style="color:#10b981;font-weight:600;">Suplr</span></p>
</td></tr>
</table></td></tr></table></body></html>`;
  }
}
