import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Client } from './client.entity.js';
import { OrderItem } from './order-item.entity.js';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'supplier_id' })
  supplierId: number;

  @Column({ name: 'client_id' })
  clientId: number;

  @ManyToOne(() => Client, { eager: true, nullable: true })
  @JoinColumn({ name: 'client_id' })
  client: Client | null;

  @Column({ length: 20, default: 'pending' })
  status: string;

  @Column({ length: 5, default: 'USD' })
  currency: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  total: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({ name: 'delivery_date', type: 'date', nullable: true })
  deliveryDate: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true, eager: true })
  items: OrderItem[];
}
