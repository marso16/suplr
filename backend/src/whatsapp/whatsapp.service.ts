import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Message } from '../entities/message.entity.js';
import { PendingOrder } from '../entities/pending-order.entity.js';
import { Client } from '../entities/client.entity.js';
import { Order } from '../entities/order.entity.js';
import { WhatsAppConnection } from '../entities/whatsapp-connection.entity.js';
import { Product } from '../entities/product.entity.js';
import { ClientsService } from '../clients/clients.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { AiParserService } from '../ai/ai-parser.service.js';
import { WhatsAppSenderService } from './whatsapp-sender.service.js';
import { CacheService } from '../cache/cache.service.js';
import { HISTORY_PHRASES, YES_WORDS, NO_WORDS, SKIP_WORDS, MSG } from '../common/constants.js';

function t(lang: string, key: string, vars?: Record<string, unknown>): string {
  const map = MSG[lang] ?? MSG['en'];
  let tpl = map?.[key] ?? MSG['en']?.[key] ?? '';
  if (vars) for (const [k, v] of Object.entries(vars)) tpl = tpl.replaceAll(`{${k}}`, String(v));
  return tpl;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    @InjectRepository(Message) private readonly messageRepo: Repository<Message>,
    @InjectRepository(PendingOrder) private readonly pendingRepo: Repository<PendingOrder>,
    @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(WhatsAppConnection) private readonly connRepo: Repository<WhatsAppConnection>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    private readonly clientsService: ClientsService,
    private readonly ordersService: OrdersService,
    private readonly aiParser: AiParserService,
    private readonly sender: WhatsAppSenderService,
    private readonly cache: CacheService,
  ) {}

  private async getConnection(supplierId: number) {
    return this.connRepo.findOne({ where: { supplierId } });
  }

  private async send(supplierId: number, to: string, text: string) {
    const conn = await this.getConnection(supplierId);
    if (!conn) { this.logger.warn(`No WhatsApp connection for supplier ${supplierId}`); return; }
    try {
      await this.sender.sendMessage(conn.bspEndpoint, conn.bspApiKey, to, text);
    } catch (e: any) {
      this.logger.error(`Failed to send message to ${to}: ${e.message}`);
    }
  }

  async storeInboundMessage(supplierId: number, msgId: string, fromNumber: string, body: string): Promise<Message> {
    const client = await this.clientsService.getOrCreateByWhatsapp(supplierId, fromNumber);
    const message = this.messageRepo.create({ supplierId, clientId: client.id, whatsappMessageId: msgId, direction: 'inbound', body });
    return this.messageRepo.save(message);
  }

  async handleNameCollection(supplierId: number, clientId: number, body: string, fromNumber: string): Promise<boolean> {
    const client = await this.clientRepo.findOne({ where: { id: clientId } });
    if (!client || client.nameConfirmed) return false;

    const msgCount = await this.messageRepo.count({ where: { clientId, direction: 'inbound' } });
    const lang = client.preferredLanguage ?? 'en';

    if (msgCount <= 1) {
      await this.send(supplierId, fromNumber, t(lang, 'welcome'));
      return true;
    }
    if (msgCount === 2) {
      client.name = body.trim().substring(0, 200);
      await this.clientRepo.save(client);
      await this.send(supplierId, fromNumber, t(lang, 'ask_email', { name: client.name }));
      return true;
    }

    const word = body.trim().toLowerCase();
    if (!SKIP_WORDS.has(word) && body.includes('@')) {
      client.email = body.trim().substring(0, 254);
      await this.clientRepo.save(client);
      await this.send(supplierId, fromNumber, t(lang, 'email_saved'));
    } else {
      await this.send(supplierId, fromNumber, t(lang, 'email_skipped'));
    }
    client.nameConfirmed = true;
    await this.clientRepo.save(client);
    return true;
  }

  isHistoryQuery(text: string): boolean {
    const lower = text.toLowerCase().trim();
    return HISTORY_PHRASES.some(p => lower.includes(p));
  }

  async handleHistoryQuery(supplierId: number, clientId: number, fromNumber: string, lang: string) {
    const orders = await this.orderRepo.find({
      where: { supplierId, clientId, status: In(['confirmed', 'fulfilled', 'invoiced']) },
      order: { createdAt: 'DESC' },
      take: 5,
      relations: ['items'],
    });

    if (orders.length === 0) { await this.send(supplierId, fromNumber, t(lang, 'history_empty')); return; }

    let sb = t(lang, 'history_header');
    for (const order of orders) {
      const date = new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      sb += `\n\n*${t(lang, 'history_order', { id: order.id, date })}*`;
      for (const item of (order.items ?? [])) {
        sb += `\n• ${item.quantity} ${item.unit} ${item.productName}`;
      }
      sb += `\n_${Number(order.total).toFixed(2)} ${order.currency}_`;
    }
    await this.send(supplierId, fromNumber, sb);
  }

  async handlePendingConfirmation(supplierId: number, clientId: number, fromNumber: string, text: string): Promise<boolean> {
    const pending = await this.pendingRepo.findOne({ where: { supplierId, clientId } });
    if (!pending) return false;

    const word = text.trim().toLowerCase();
    const client = await this.clientRepo.findOne({ where: { id: clientId } });
    const lang = client?.preferredLanguage ?? 'en';

    if (YES_WORDS.has(word)) {
      const items = JSON.parse(pending.itemsJson ?? '[]') as any[];
      await this.ordersService.create(supplierId, {
        clientId,
        currency: pending.currency,
        items: items.map(i => ({
          productNameRaw: i.product_name_raw,
          productId: i.product_id,
          quantity: i.quantity,
          unit: i.unit,
          price: i.price,
          notes: i.notes || undefined,
        })),
      });
      await this.pendingRepo.remove(pending);
      await this.cache.invalidateReportCache(supplierId);
      await this.send(supplierId, fromNumber, t(lang, 'order_received'));
      return true;
    }

    if (NO_WORDS.has(word)) {
      await this.pendingRepo.remove(pending);
      await this.send(supplierId, fromNumber, t(lang, 'order_cancelled'));
      return true;
    }

    return false;
  }

  async parseAndCreateOrder(supplierId: number, message: Message, fromNumber: string) {
    const products = await this.productRepo.find({ where: { supplierId, active: true } });
    const client = await this.clientRepo.findOne({ where: { id: message.clientId! } });
    if (!client) return;

    const parsed = await this.aiParser.parseOrderMessage(message.body, products);
    if (!parsed.isOrder || parsed.confidence === 'low') return;

    const { language: lang, currency, items } = parsed;
    client.preferredLanguage = lang;
    await this.clientRepo.save(client);

    const priceMap = new Map<number, number>();
    for (const p of products) {
      const price = currency === 'LBP' ? p.priceLbp : p.priceUsd;
      if (price != null && p.id != null) priceMap.set(p.id, Number(price));
    }

    const matched = items.filter(i => i.productId != null);
    if (matched.length === 0) return;

    let sb = t(lang, 'summary_header');
    let total = 0;
    const itemsForJson: any[] = [];

    for (const item of matched) {
      const price = priceMap.get(item.productId!) ?? 0;
      const lineTotal = price * Number(item.quantity);
      total += lineTotal;
      sb += `\n• ${item.quantity} ${item.unit} ${item.productNameRaw} — ${lineTotal.toFixed(2)} ${currency}`;
      itemsForJson.push({ product_name_raw: item.productNameRaw, product_id: item.productId, quantity: item.quantity, unit: item.unit, price, notes: item.notes ?? '' });
    }

    sb += t(lang, 'total', { total: total.toFixed(2), currency });
    sb += t(lang, 'confirm_prompt');

    const existing = await this.pendingRepo.findOne({ where: { supplierId, clientId: client.id } });
    if (existing) await this.pendingRepo.remove(existing);

    await this.pendingRepo.save(this.pendingRepo.create({ supplierId, clientId: client.id, currency, itemsJson: JSON.stringify(itemsForJson) }));
    await this.send(supplierId, fromNumber, sb);
  }

  async sendOrderConfirmation(supplierId: number, clientWhatsapp: string, orderId: number, lang: string) {
    const conn = await this.getConnection(supplierId);
    if (!conn) return;
    try {
      await this.sender.sendMessage(conn.bspEndpoint, conn.bspApiKey, clientWhatsapp, t(lang, 'order_confirmed', { order_id: orderId }));
    } catch (e: any) {
      this.logger.error(`Failed to send order confirmation for #${orderId}: ${e.message}`);
    }
  }

  async sendInvoicePdf(supplierId: number, clientWhatsapp: string, pdfBytes: Buffer, invoiceNumber: string) {
    const conn = await this.getConnection(supplierId);
    if (!conn) return;
    try {
      await this.sender.sendDocument(conn.bspEndpoint, conn.bspApiKey, clientWhatsapp, pdfBytes, `${invoiceNumber}.pdf`);
    } catch (e: any) {
      this.logger.error(`Failed to send invoice PDF ${invoiceNumber}: ${e.message}`);
    }
  }
}
