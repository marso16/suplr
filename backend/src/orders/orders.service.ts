import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity.js';
import { OrderItem } from '../entities/order-item.entity.js';
import { SseService } from '../sse/sse.service.js';

interface OrderItemDto {
  productNameRaw: string;
  productId?: number | null;
  quantity: string;
  unit: string;
  price: string;
  notes?: string;
}

interface OrderDto {
  clientId: number;
  currency?: string;
  items: OrderItemDto[];
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private readonly itemRepo: Repository<OrderItem>,
    private readonly sseService: SseService,
  ) {}

  async create(supplierId: number, dto: OrderDto): Promise<Order> {
    const currency = dto.currency ?? 'USD';
    const total = dto.items.reduce((s, i) => s + parseFloat(i.price) * parseFloat(i.quantity), 0);

    const order = this.orderRepo.create({
      supplierId, clientId: dto.clientId, currency, total: total.toString(),
    });

    const items = dto.items.map(i => this.itemRepo.create({
      productNameRaw: i.productNameRaw,
      productId: i.productId ?? null,
      quantity: i.quantity,
      unit: i.unit,
      price: i.price,
      notes: i.notes ?? null,
    }));
    order.items = items;

    const saved = await this.orderRepo.save(order);
    await this.sseService.publishOrderEvent(supplierId, 'order_created', saved.id);
    // reload with relations
    return this.orderRepo.findOne({ where: { id: saved.id }, relations: ['client', 'items', 'items.product'] }) as Promise<Order>;
  }

  async list(supplierId: number): Promise<Order[]> {
    return this.orderRepo.find({
      where: { supplierId },
      relations: ['client', 'items', 'items.product'],
      order: { createdAt: 'DESC' },
    });
  }

  async getOne(orderId: number, supplierId: number): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, supplierId },
      relations: ['client', 'items', 'items.product'],
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async confirm(orderId: number, supplierId: number): Promise<Order> {
    const order = await this.getOne(orderId, supplierId);
    order.status = 'confirmed';
    order.confirmedAt = new Date();
    const saved = await this.orderRepo.save(order);
    await this.sseService.publishOrderEvent(supplierId, 'order_updated', saved.id);
    return saved;
  }

  async fulfill(orderId: number, supplierId: number): Promise<Order> {
    const order = await this.getOne(orderId, supplierId);
    order.status = 'fulfilled';
    const saved = await this.orderRepo.save(order);
    await this.sseService.publishOrderEvent(supplierId, 'order_updated', saved.id);
    return saved;
  }

  async setDeliveryDate(orderId: number, supplierId: number, deliveryDate: string | null): Promise<Order> {
    const order = await this.getOne(orderId, supplierId);
    order.deliveryDate = deliveryDate;
    return this.orderRepo.save(order);
  }

  async setNotes(orderId: number, supplierId: number, notes: string | null): Promise<Order> {
    const order = await this.getOne(orderId, supplierId);
    order.notes = notes?.trim() || null;
    return this.orderRepo.save(order);
  }

  toResponse(o: Order) {
    return {
      id: o.id, supplier_id: o.supplierId, client_id: o.clientId,
      client: o.client ? { id: o.client.id, name: o.client.name, whatsapp_number: o.client.whatsappNumber } : null,
      status: o.status, currency: o.currency, total: o.total,
      created_at: o.createdAt, confirmed_at: o.confirmedAt,
      delivery_date: o.deliveryDate, notes: o.notes,
      items: (o.items ?? []).map(i => ({
        id: i.id, product_name: i.productName, product_name_raw: i.productNameRaw,
        product_id: i.productId, quantity: parseFloat(i.quantity).toString(),
        unit: i.unit, price: i.price, notes: i.notes,
      })),
    };
  }
}
