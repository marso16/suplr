import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentSupplier } from '../common/decorators/current-supplier.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { Supplier } from '../entities/supplier.entity.js';
import { EmailService } from '../email/email.service.js';
import { PdfService } from '../pdf/pdf.service.js';
import { StorageService } from '../storage/storage.service.js';
import { InvoicesService } from './invoices.service.js';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly pdfService: PdfService,
    private readonly emailService: EmailService,
    private readonly storageService: StorageService,
  ) {}

  @Post()
  async create(
    @Body() body: { orderId?: number; order_id?: number },
    @CurrentSupplier() s: Supplier,
  ) {
    const orderId = body.orderId ?? body.order_id;
    if (!orderId) throw new Error('order_id is required');
    const invoice = await this.invoicesService.create(orderId, s.id);
    return this.invoicesService.toResponse(invoice);
  }

  @Get()
  async list(@CurrentSupplier() s: Supplier) {
    const rows = (await this.invoicesService.listWithClient(s.id)) as any[];
    return rows.map((r) =>
      this.invoicesService.toResponse(
        {
          id: r.id,
          supplierId: r.supplier_id,
          orderId: r.order_id,
          number: r.number,
          currency: r.currency,
          total: r.total,
          issuedAt: r.issued_at,
          paidAt: r.paid_at,
        } as any,
        r.client_name,
        r.client_email,
      ),
    );
  }

  @Get('export')
  async exportCsv(@CurrentSupplier() s: Supplier, @Res() res: Response) {
    const rows = (await this.invoicesService.listWithClient(s.id)) as any[];
    const lines = ['number,total,currency,issued_at,paid_at,client'];
    for (const r of rows) {
      lines.push(
        [
          r.number,
          r.total,
          r.currency,
          r.issued_at,
          r.paid_at ?? '',
          r.client_name ?? '',
        ].join(','),
      );
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="invoices.csv"');
    res.send(lines.join('\n'));
  }

  @Patch(':id/mark-paid')
  async markPaid(@Param('id') id: string, @CurrentSupplier() s: Supplier) {
    const invoice = await this.invoicesService.markPaid(Number(id), s.id);
    return this.invoicesService.toResponse(invoice);
  }

  @Post(':id/send-email')
  async sendEmail(
    @Param('id') id: string,
    @CurrentSupplier() s: Supplier,
    @Body() body: { email?: string },
  ) {
    const invoice = await this.invoicesService.getOwned(Number(id), s.id);
    const order = await this.invoicesService.getOrderForInvoice(invoice, s.id);
    if (!order) throw new Error('Order not found');
    const toEmail = body.email || order.client?.email;
    if (!toEmail) throw new Error('No email address');
    const pdfBytes = this.pdfService.renderInvoicePdf(invoice, order, s);
    this.emailService.sendInvoiceEmail(invoice, order, s, toEmail, pdfBytes);
    return { sent: true };
  }

  @Get(':id/pdf')
  async getPdf(
    @Param('id') id: string,
    @CurrentSupplier() s: Supplier,
    @Res() res: Response,
  ) {
    const invoice = await this.invoicesService.getOwned(Number(id), s.id);
    const order = await this.invoicesService.getOrderForInvoice(invoice, s.id);
    if (!order) throw new Error('Order not found');
    const pdfBytes = this.pdfService.renderInvoicePdf(invoice, order, s);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${invoice.number}.pdf"`,
    );
    res.status(HttpStatus.OK).send(pdfBytes);
  }
}
