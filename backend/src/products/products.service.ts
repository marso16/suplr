import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity.js';

interface ProductDto { name: string; sku?: string; unit: string; priceUsd?: string; priceLbp?: string; }
interface ProductUpdateDto { name?: string; sku?: string; unit?: string; priceUsd?: string; priceLbp?: string; }

@Injectable()
export class ProductsService {
  constructor(@InjectRepository(Product) private readonly productRepo: Repository<Product>) {}

  private deriveSku(name: string, sku?: string): string {
    if (sku?.trim()) return sku.trim();
    return name.toUpperCase().replace(/\s+/g, '-').substring(0, 50);
  }

  async create(supplierId: number, dto: ProductDto) {
    const product = this.productRepo.create({
      supplierId, name: dto.name, sku: this.deriveSku(dto.name, dto.sku),
      unit: dto.unit, priceUsd: dto.priceUsd ?? null, priceLbp: dto.priceLbp ?? null,
    });
    return this.toResponse(await this.productRepo.save(product));
  }

  async bulkCreate(supplierId: number, items: ProductDto[]) {
    const products = items.map(dto => this.productRepo.create({
      supplierId, name: dto.name, sku: this.deriveSku(dto.name, dto.sku),
      unit: dto.unit, priceUsd: dto.priceUsd ?? null, priceLbp: dto.priceLbp ?? null,
    }));
    const saved = await this.productRepo.save(products);
    return saved.map(this.toResponse);
  }

  async list(supplierId: number) {
    const products = await this.productRepo.find({ where: { supplierId } });
    return products.map(this.toResponse);
  }

  async getActive(supplierId: number): Promise<Product[]> {
    return this.productRepo.find({ where: { supplierId, active: true } });
  }

  async update(productId: number, supplierId: number, dto: ProductUpdateDto) {
    const product = await this.getOwned(productId, supplierId);
    if (dto.name != null) product.name = dto.name;
    if (dto.sku != null) product.sku = dto.sku;
    if (dto.unit != null) product.unit = dto.unit;
    if (dto.priceUsd !== undefined) product.priceUsd = dto.priceUsd ?? null;
    if (dto.priceLbp !== undefined) product.priceLbp = dto.priceLbp ?? null;
    return this.toResponse(await this.productRepo.save(product));
  }

  async setActive(productId: number, supplierId: number, active: boolean): Promise<void> {
    const product = await this.getOwned(productId, supplierId);
    product.active = active;
    await this.productRepo.save(product);
  }

  private async getOwned(productId: number, supplierId: number): Promise<Product> {
    const p = await this.productRepo.findOne({ where: { id: productId, supplierId } });
    if (!p) throw new NotFoundException('Product not found');
    return p;
  }

  toResponse(p: Product) {
    return { id: p.id, supplier_id: p.supplierId, name: p.name, sku: p.sku, unit: p.unit, price_usd: p.priceUsd, price_lbp: p.priceLbp, active: p.active };
  }
}
