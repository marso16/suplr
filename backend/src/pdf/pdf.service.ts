import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import type { Invoice } from '../entities/invoice.entity.js';
import type { Order } from '../entities/order.entity.js';
import type { Supplier } from '../entities/supplier.entity.js';

const C_DARK = '#0F172A';
const C_ACCENT = '#10B981';
const C_MUTED = '#64748B';
const C_LIGHT = '#F8FAFC';
const C_NAVY = '#1E293B';
const C_BORDER = '#E2E8F0';
const C_WHITE = '#FFFFFF';
const C_PAID_BG = '#DCFCE7';
const C_PAID_FG = '#166534';
const C_DUE_BG = '#FEF3C7';
const C_DUE_FG = '#92400E';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private readonly lbpRate: number;

  constructor(config: ConfigService) {
    this.lbpRate = Number(config.get('LBP_RATE', '90000'));
  }

  renderInvoicePdf(invoice: Invoice, order: Order, supplier: Supplier): Buffer {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.on('data', (c: Buffer) => chunks.push(c));

    const W = 515;
    const left = 40;

    doc.rect(left - 40, 0, 595, 80).fill(C_DARK);
    doc
      .fillColor(C_WHITE)
      .font('Helvetica-Bold')
      .fontSize(17)
      .text(supplier.name, left, 20, { width: W * 0.6 });
    doc
      .font('Helvetica-Bold')
      .fontSize(22)
      .fillColor(C_WHITE)
      .text('INVOICE', left, 20, { width: W, align: 'right' });

    const contact = [supplier.email, supplier.phone]
      .filter(Boolean)
      .join('  ·  ');
    if (contact) {
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(C_MUTED)
        .text(contact, left, 44, { width: W * 0.6 });
    }
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(C_ACCENT)
      .text(invoice.number, left, 44, { width: W, align: 'right' });

    doc.rect(left - 40, 80, 595, 4).fill(C_ACCENT);

    const metaY = 100;
    const halfW = (W - 10) / 2;
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

    doc.rect(left, metaY, halfW, 70).fill(C_LIGHT);
    doc.rect(left, metaY, 3, 70).fill(C_ACCENT);
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(C_MUTED)
      .text('BILL TO', left + 12, metaY + 10);
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(C_NAVY)
      .text(clientName, left + 12, metaY + 22, { width: halfW - 15 });
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(C_MUTED)
      .text(clientPhone, left + 12, metaY + 40, { width: halfW - 15 });

    const metaX = left + halfW + 10;
    doc.rect(metaX, metaY, halfW, 70).fill(C_LIGHT);
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(C_MUTED)
      .text('INVOICE DATE', metaX, metaY + 10, {
        width: halfW,
        align: 'right',
      });
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(C_NAVY)
      .text(issued, metaX, metaY + 20, { width: halfW, align: 'right' });
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(C_MUTED)
      .text('ORDER REFERENCE', metaX, metaY + 36, {
        width: halfW,
        align: 'right',
      });
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(C_NAVY)
      .text(`#${order.id}`, metaX, metaY + 46, {
        width: halfW,
        align: 'right',
      });

    let y = metaY + 82;
    const cols = [
      left,
      left + W * 0.46,
      left + W * 0.62,
      left + W * 0.82,
      left + W,
    ];
    const colWidths = [W * 0.46, W * 0.16, W * 0.2, W * 0.18];
    const headers = ['Description', 'Qty', 'Unit Price', 'Amount'];
    const hAligns: ('left' | 'center' | 'right')[] = [
      'left',
      'center',
      'right',
      'right',
    ];

    doc.rect(left, y, W, 22).fill(C_DARK);
    headers.forEach((h, i) => {
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(C_WHITE)
        .text(h, cols[i] + 4, y + 7, {
          width: colWidths[i] - 8,
          align: hAligns[i],
        });
    });
    y += 22;

    let alt = false;
    for (const item of order.items) {
      const lineTotal = (
        parseFloat(item.price) * parseFloat(item.quantity)
      ).toFixed(2);
      if (alt) doc.rect(left, y, W, 24).fill(C_LIGHT);
      doc
        .moveTo(left, y + 24)
        .lineTo(left + W, y + 24)
        .strokeColor(C_BORDER)
        .lineWidth(0.4)
        .stroke();
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(C_NAVY)
        .text(item.productName, cols[0] + 4, y + 8, {
          width: colWidths[0] - 8,
          align: 'left',
        });
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(C_MUTED)
        .text(`${parseFloat(item.quantity)} ${item.unit}`, cols[1] + 4, y + 8, {
          width: colWidths[1] - 8,
          align: 'center',
        });
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(C_NAVY)
        .text(
          `${parseFloat(item.price).toFixed(2)} ${invoice.currency}`,
          cols[2] + 4,
          y + 8,
          { width: colWidths[2] - 8, align: 'right' },
        );
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(C_NAVY)
        .text(lineTotal, cols[3] + 4, y + 8, {
          width: colWidths[3] - 8,
          align: 'right',
        });
      y += 24;
      alt = !alt;
    }

    doc.rect(left, y, W, 32).fill(C_DARK);
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(C_WHITE)
      .text('Total', left + 4, y + 10, { width: W * 0.82 - 8, align: 'right' });
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(C_WHITE)
      .text(
        `${parseFloat(invoice.total).toFixed(2)} ${invoice.currency}`,
        cols[3] + 4,
        y + 10,
        { width: colWidths[3] - 8, align: 'right' },
      );
    y += 32;

    if (invoice.currency === 'USD') {
      const lbpAmt = Math.floor(parseFloat(invoice.total) * this.lbpRate);
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(C_MUTED)
        .text(`≈ ${lbpAmt.toLocaleString()} LBP`, left, y + 4, {
          width: W,
          align: 'right',
        });
      y += 18;
    }

    if (order.notes?.trim()) {
      y += 12;
      doc.rect(left, y, W, 50).fill(C_LIGHT);
      doc.rect(left, y, W, 50).strokeColor(C_BORDER).lineWidth(0.5).stroke();
      doc
        .font('Helvetica-Bold')
        .fontSize(7)
        .fillColor(C_MUTED)
        .text('SPECIAL INSTRUCTIONS', left + 12, y + 10);
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(C_NAVY)
        .text(order.notes.trim(), left + 12, y + 22, { width: W - 24 });
      y += 62;
    }

    y += 16;
    const isPaid = !!invoice.paidAt;
    const badgeBg = isPaid ? C_PAID_BG : C_DUE_BG;
    const badgeFg = isPaid ? C_PAID_FG : C_DUE_FG;
    const badgeTxt = isPaid ? 'PAID IN FULL' : 'PAYMENT OUTSTANDING';

    doc.rect(left, y, W, 44).strokeColor(C_BORDER).lineWidth(0.5).stroke();
    doc.rect(left, y, W * 0.3, 44).fill(badgeBg);
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(badgeFg)
      .text(badgeTxt, left + 4, y + 18, {
        width: W * 0.3 - 8,
        align: 'center',
      });
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(C_MUTED)
      .text(
        `Thank you for your business, ${clientName}!`,
        left + W * 0.3 + 8,
        y + 10,
        { width: W * 0.7 - 12, align: 'right' },
      );
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(C_MUTED)
      .text('Generated with Suplr', left + W * 0.3 + 8, y + 26, {
        width: W * 0.7 - 12,
        align: 'right',
      });

    doc.end();
    return Buffer.concat(chunks);
  }
}
