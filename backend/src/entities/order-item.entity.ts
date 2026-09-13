import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Order } from './order.entity.js';
import { Product } from './product.entity.js';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'order_id' })
  orderId: number;

  @ManyToOne('Order', 'items')
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ type: 'int', name: 'product_id', nullable: true })
  productId: number | null;

  @ManyToOne(() => Product, { nullable: true, eager: false })
  @JoinColumn({ name: 'product_id' })
  product: Product | null;

  @Column({ name: 'product_name_raw', length: 200 })
  productNameRaw: string;

  @Column({ type: 'numeric', precision: 12, scale: 3 })
  quantity: string;

  @Column({ length: 50 })
  unit: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  price: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  get productName(): string {
    return this.product?.name ?? this.productNameRaw;
  }
}
