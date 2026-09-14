import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'supplier_id' })
  supplierId: number;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 100 })
  sku: string;

  @Column({ length: 50 })
  unit: string;

  @Column({
    name: 'price_usd',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  priceUsd: string | null;

  @Column({
    name: 'price_lbp',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  priceLbp: string | null;

  @Column({ name: 'stock_qty', type: 'integer', default: 0 })
  stockQty: number;

  @Column({ default: true })
  active: boolean;
}
