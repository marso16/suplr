import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { INVOICEABLE_STATUSES } from '../common/constants.js';
import { Client } from '../entities/client.entity.js';
import { Invoice } from '../entities/invoice.entity.js';
import { Order } from '../entities/order.entity.js';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
  ) {}

  async create(orderId: number, supplierId: number): Promise<Invoice> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, supplierId },
      relations: ['client', 'items', 'items.product'],
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!INVOICEABLE_STATUSES.has(order.status)) {
      throw new BadRequestException('Order must be confirmed before invoicing');
    }
    const existing = await this.invoiceRepo.findOne({ where: { orderId } });
    if (existing) throw new BadRequestException('Invoice already exists for this order');

    const count = (await this.invoiceRepo.count({ where: { supplierId } })) + 1;
    const now = new Date();
    const number = `INV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(count).padStart(4, '0')}`;

    const invoice = this.invoiceRepo.create({
      supplierId, orderId, number, currency: order.currency, total: order.total,
    });
    await this.invoiceRepo.save(invoice);

    order.status = 'invoiced';
    await this.orderRepo.save(order);

    if (order.clientId) {
      const client = await this.clientRepo.findOne({ where: { id: order.clientId, supplierId } });
      if (client) {
        client.creditBalance = (parseFloat(client.creditBalance ?? '0') + parseFloat(order.total)).toString();
        await this.clientRepo.save(client);
      }
    }
    return invoice;
  }

  async markPaid(invoiceId: number, supplierId: number): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId, supplierId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.paidAt) throw new BadRequestException('Invoice already paid');

    invoice.paidAt = new Date();
    await this.invoiceRepo.save(invoice);

    const order = await this.orderRepo.findOne({ where: { id: invoice.orderId } });
    if (order) {
      const client = await this.clientRepo.findOne({ where: { id: order.clientId, supplierId } });
      if (client) {
        const reduced = Math.max(0, parseFloat(client.creditBalance ?? '0') - parseFloat(invoice.total));
        client.creditBalance = reduced.toString();
        await this.clientRepo.save(client);
      }
    }
    return invoice;
  }

  async list(supplierId: number) {
    return this.invoiceRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('orders', 'o', 'o.id = i.order_id')
      .leftJoinAndSelect('clients', 'c', 'c.id = o.client_id')
      .where('i.supplier_id = :supplierId', { supplierId })
      .orderBy('i.issued_at', 'DESC')
      .getRawAndEntities()
      .then(({ entities }) => entities);
  }

  async listWithClient(supplierId: number) {
    return this.invoiceRepo.query(
      `SELECT i.*, c.name AS client_name, c.email AS client_email
       FROM invoices i
       LEFT JOIN orders o ON o.id = i.order_id
       LEFT JOIN clients c ON c.id = o.client_id
       WHERE i.supplier_id = $1
       ORDER BY i.issued_at DESC`,
      [supplierId],
    );
  }

  async getOwned(invoiceId: number, supplierId: number): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId, supplierId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async getOrderForInvoice(invoice: Invoice, supplierId: number): Promise<Order | null> {
    return this.orderRepo.findOne({
      where: { id: invoice.orderId, supplierId },
      relations: ['client', 'items', 'items.product'],
    });
  }

  toResponse(inv: Invoice, clientName?: string, clientEmail?: string) {
    return {
      id: inv.id, supplier_id: inv.supplierId, order_id: inv.orderId,
      number: inv.number, currency: inv.currency, total: inv.total,
      issued_at: inv.issuedAt, paid_at: inv.paidAt,
      client_name: clientName ?? null, client_email: clientEmail ?? null,
    };
  }
}
