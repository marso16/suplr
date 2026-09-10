import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentSupplier } from '../common/decorators/current-supplier.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { Supplier } from '../entities/supplier.entity.js';
import { ProductsService } from './products.service.js';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post('bulk')
  bulkCreate(@CurrentSupplier() s: Supplier, @Body() items: any[]) {
    return this.productsService.bulkCreate(s.id, items);
  }

  @Post()
  create(@CurrentSupplier() s: Supplier, @Body() body: any) {
    return this.productsService.create(s.id, body);
  }

  @Get()
  list(@CurrentSupplier() s: Supplier) { return this.productsService.list(s.id); }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentSupplier() s: Supplier, @Body() body: any) {
    return this.productsService.update(Number(id), s.id, body);
  }

  @Patch(':id/activate')
  @HttpCode(204)
  activate(@Param('id') id: string, @CurrentSupplier() s: Supplier) {
    return this.productsService.setActive(Number(id), s.id, true);
  }

  @Patch(':id/deactivate')
  @HttpCode(204)
  deactivate(@Param('id') id: string, @CurrentSupplier() s: Supplier) {
    return this.productsService.setActive(Number(id), s.id, false);
  }
}
