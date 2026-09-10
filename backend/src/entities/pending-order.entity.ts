import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('pending_orders')
@Unique('uq_pending_supplier_client', ['supplierId', 'clientId'])
export class PendingOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'supplier_id' })
  supplierId: number;

  @Column({ name: 'client_id' })
  clientId: number;

  @Column({ length: 5 })
  currency: string;

  @Column({ name: 'items_json', type: 'text' })
  itemsJson: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
