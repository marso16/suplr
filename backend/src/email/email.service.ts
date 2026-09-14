import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';
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

  async sendLoginAlertEmail(
    supplier: Supplier,
    ip: string,
    userAgent: string,
    revokeUrl: string,
  ): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not set — skipping login alert');
      return;
    }
    const from =
      this.config.get<string>('RESEND_FROM') ??
      'Suplr Security <security@marcelinokeyrouz.com>';

    const device = parseUserAgent(userAgent);
    const location = await fetchGeoLocation(ip);
    const time = new Date().toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    const html = buildLoginAlertHtml({
      name: supplier.name,
      time,
      device,
      location,
      ip,
      revokeUrl,
    });

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: supplier.email,
      subject: 'New sign-in to your Suplr account',
      html,
    });
    if (error) {
      this.logger.warn(`Login alert email failed: ${JSON.stringify(error)}`);
    } else {
      this.logger.log(`Login alert sent to ${supplier.email}`);
    }
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
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) throw new Error('RESEND_API_KEY not configured');
    const from =
      this.config.get<string>('RESEND_FROM') ??
      'Suplr <invoices@marcelinokeyrouz.com>';
    const resend = new Resend(apiKey);
    resend.emails
      .send({
        from,
        to: toEmail,
        replyTo: supplier.email || undefined,
        subject: `Invoice ${invoice.number} from ${supplier.name}`,
        html: this.buildInvoiceHtml(invoice, order, supplier),
        attachments: [
          {
            filename: `${invoice.number}.pdf`,
            content: pdfBytes.toString('base64'),
            contentType: 'application/pdf',
          },
        ],
      })
      .then(({ error }) => {
        if (error) {
          this.logger.warn(`Invoice email failed: ${JSON.stringify(error)}`);
        } else {
          this.logger.log(`Invoice email sent: ${invoice.number} → ${toEmail}`);
        }
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

function parseUserAgent(ua: string): string {
  let browser = 'Unknown browser';
  let os = 'Unknown OS';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  return `${browser} on ${os}`;
}

async function fetchGeoLocation(ip: string): Promise<string> {
  try {
    const isPrivate =
      /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1$|localhost)/.test(ip);
    if (isPrivate) return 'Local network';
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,city,regionName,country`,
    );
    const data = (await res.json()) as {
      status: string;
      city?: string;
      regionName?: string;
      country?: string;
    };
    if (data.status !== 'success') return 'Unknown location';
    return [data.city, data.country].filter(Boolean).join(', ');
  } catch {
    return 'Unknown location';
  }
}

function buildLoginAlertHtml(opts: {
  name: string;
  time: string;
  device: string;
  location: string;
  ip: string;
  revokeUrl: string;
}): string {
  const { name, time, device, location, ip, revokeUrl } = opts;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0">
<tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:28px 32px;">
<p style="margin:0;font-size:22px;font-weight:800;color:#fff;">Suplr</p>
<p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">Security notification</p>
</td></tr>
<tr><td style="background:#f59e0b;height:4px;"></td></tr>
<tr><td style="background:#fff;padding:32px;">
<p style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0f172a;">New sign-in detected</p>
<p style="margin:0 0 24px;font-size:14px;color:#64748b;">Hi ${name}, your Suplr account was just signed into.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:28px;">
<tr><td style="padding:20px 24px;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
  <td width="32" valign="top" style="padding:0 12px 16px 0;">
    <div style="width:32px;height:32px;background:#fef3c7;border-radius:8px;text-align:center;line-height:32px;font-size:16px;">🕐</div>
  </td>
  <td valign="top" style="padding-bottom:16px;">
    <p style="margin:0;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Time</p>
    <p style="margin:4px 0 0;font-size:14px;color:#1e293b;">${time}</p>
  </td>
</tr>
<tr>
  <td width="32" valign="top" style="padding:0 12px 16px 0;">
    <div style="width:32px;height:32px;background:#dbeafe;border-radius:8px;text-align:center;line-height:32px;font-size:16px;">💻</div>
  </td>
  <td valign="top" style="padding-bottom:16px;">
    <p style="margin:0;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Device</p>
    <p style="margin:4px 0 0;font-size:14px;color:#1e293b;">${device}</p>
  </td>
</tr>
<tr>
  <td width="32" valign="top" style="padding:0 12px 16px 0;">
    <div style="width:32px;height:32px;background:#dcfce7;border-radius:8px;text-align:center;line-height:32px;font-size:16px;">📍</div>
  </td>
  <td valign="top" style="padding-bottom:16px;">
    <p style="margin:0;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Location</p>
    <p style="margin:4px 0 0;font-size:14px;color:#1e293b;">${location}</p>
  </td>
</tr>
<tr>
  <td width="32" valign="top" style="padding:0 12px 0 0;">
    <div style="width:32px;height:32px;background:#fce7f3;border-radius:8px;text-align:center;line-height:32px;font-size:16px;">🌐</div>
  </td>
  <td valign="top">
    <p style="margin:0;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">IP Address</p>
    <p style="margin:4px 0 0;font-size:14px;color:#1e293b;font-family:monospace;">${ip}</p>
  </td>
</tr>
</table>
</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;margin-bottom:24px;">
<tr><td style="padding:20px 24px;">
<p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#991b1b;">Not you?</p>
<p style="margin:0 0 16px;font-size:13px;color:#7f1d1d;">If you didn't sign in, your account may be compromised. Click below to immediately log out all devices and secure your account.</p>
<a href="${revokeUrl}" style="display:inline-block;background:#dc2626;color:#fff;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none;">Secure my account →</a>
</td></tr></table>
<p style="margin:0;font-size:12px;color:#94a3b8;">If this was you, no action is needed. This link expires in 48 hours.</p>
</td></tr>
<tr><td style="background:#0f172a;border-radius:0 0 12px 12px;padding:16px 28px;text-align:center;">
<p style="margin:0;font-size:11px;color:#475569;">Suplr · <span style="color:#10b981;">suplr.marcelinokeyrouz.com</span></p>
</td></tr>
</table></td></tr></table></body></html>`;
}
