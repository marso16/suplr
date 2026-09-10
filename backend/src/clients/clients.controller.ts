import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentSupplier } from '../common/decorators/current-supplier.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { Supplier } from '../entities/supplier.entity.js';
import { ClientsService } from './clients.service.js';

@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  create(
    @CurrentSupplier() supplier: Supplier,
    @Body() body: { name: string; whatsappNumber: string; creditTerms?: string; notes?: string; email?: string },
  ) { return this.clientsService.create(supplier.id, body); }

  @Get()
  list(@CurrentSupplier() supplier: Supplier) {
    return this.clientsService.list(supplier.id);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id') id: string, @CurrentSupplier() supplier: Supplier) {
    return this.clientsService.delete(Number(id), supplier.id);
  }
}
