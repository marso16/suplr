import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('clients')
@Unique('uq_client_supplier_number', ['supplierId', 'whatsappNumber'])
export class Client {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'supplier_id' })
  supplierId: number;

  @Column({ length: 200 })
  name: string;

  @Column({ name: 'whatsapp_number', length: 50 })
  whatsappNumber: string;

  @Column({ type: 'varchar', name: 'credit_terms', length: 100, nullable: true })
  creditTerms: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'credit_balance', type: 'numeric', precision: 12, scale: 2, default: 0 })
  creditBalance: string;

  @Column({ name: 'preferred_language', length: 5, default: 'en' })
  preferredLanguage: string;

  @Column({ name: 'name_confirmed', default: false })
  nameConfirmed: boolean;

  @Column({ type: 'varchar', length: 254, nullable: true })
  email: string | null;
}
