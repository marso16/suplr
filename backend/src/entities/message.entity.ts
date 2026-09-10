import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'supplier_id' })
  supplierId: number;

  @Column({ name: 'client_id', nullable: true })
  clientId: number | null;

  @Column({ name: 'whatsapp_message_id', length: 200, nullable: true, unique: true })
  whatsappMessageId: string | null;

  @Column({ length: 10 })
  direction: string;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;

  @Column({ name: 'order_id', nullable: true })
  orderId: number | null;
}
