import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('whatsapp_connections')
export class WhatsAppConnection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'supplier_id', unique: true })
  supplierId: number;

  @Column({ name: 'phone_number', length: 20 })
  phoneNumber: string;

  @Column({ name: 'bsp_api_key', length: 500 })
  bspApiKey: string;

  @Column({ name: 'bsp_endpoint', length: 500 })
  bspEndpoint: string;

  @CreateDateColumn({ name: 'connected_at', type: 'timestamptz' })
  connectedAt: Date;
}
