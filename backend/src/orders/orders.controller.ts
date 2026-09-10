import { Body, Controller, Get, HttpCode, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentSupplier } from '../common/decorators/current-supplier.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { Supplier } from '../entities/supplier.entity.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async create(@CurrentSupplier() s: Supplier, @Body() body: any) {
    const order = await this.ordersService.create(s.id, body);
    return this.ordersService.toResponse(order);
  }

  @Get()
  async list(@CurrentSupplier() s: Supplier) {
    const orders = await this.ordersService.list(s.id);
    return orders.map(o => this.ordersService.toResponse(o));
  }

  @Get('export')
  async exportCsv(@CurrentSupplier() s: Supplier, @Res() res: Response) {
    const orders = await this.ordersService.list(s.id);
    const lines = ['id,status,currency,total,client,created_at'];
    for (const o of orders) {
      lines.push([o.id, o.status, o.currency, o.total, o.client?.name ?? '', o.createdAt.toISOString()].join(','));
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
    res.send(lines.join('\n'));
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @CurrentSupplier() s: Supplier) {
    const order = await this.ordersService.getOne(Number(id), s.id);
    return this.ordersService.toResponse(order);
  }

  @Patch(':id/confirm')
  async confirm(@Param('id') id: string, @CurrentSupplier() s: Supplier) {
    const order = await this.ordersService.confirm(Number(id), s.id);
    return this.ordersService.toResponse(order);
  }

  @Patch(':id/fulfill')
  async fulfill(@Param('id') id: string, @CurrentSupplier() s: Supplier) {
    const order = await this.ordersService.fulfill(Number(id), s.id);
    return this.ordersService.toResponse(order);
  }

  @Patch(':id/delivery-date')
  async setDeliveryDate(@Param('id') id: string, @CurrentSupplier() s: Supplier, @Body() body: { deliveryDate?: string }) {
    const order = await this.ordersService.setDeliveryDate(Number(id), s.id, body.deliveryDate ?? null);
    return this.ordersService.toResponse(order);
  }

  @Patch(':id/notes')
  async setNotes(@Param('id') id: string, @CurrentSupplier() s: Supplier, @Body() body: { notes?: string }) {
    const order = await this.ordersService.setNotes(Number(id), s.id, body.notes ?? null);
    return this.ordersService.toResponse(order);
  }
}
