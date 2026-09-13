import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsAppConnection } from '../entities/whatsapp-connection.entity.js';
import { Supplier } from '../entities/supplier.entity.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentSupplier } from '../common/decorators/current-supplier.decorator.js';
import { IsString, IsUrl } from 'class-validator';

class WhatsAppConnectionRequest {
  @IsUrl() bspEndpoint!: string;
  @IsString() bspApiKey!: string;
  @IsString() phoneNumber!: string;
}

@UseGuards(JwtAuthGuard)
@Controller('auth/whatsapp-connection')
export class WhatsAppConnectionController {
  constructor(
    @InjectRepository(WhatsAppConnection)
    private readonly connRepo: Repository<WhatsAppConnection>,
  ) {}

  @Put()
  async upsert(
    @CurrentSupplier() supplier: Supplier,
    @Body() req: WhatsAppConnectionRequest,
  ) {
    let conn = await this.connRepo.findOne({
      where: { supplierId: supplier.id },
    });
    if (!conn) {
      conn = this.connRepo.create({ supplierId: supplier.id });
    }
    conn.bspEndpoint = req.bspEndpoint;
    conn.bspApiKey = req.bspApiKey;
    conn.phoneNumber = req.phoneNumber;
    conn = await this.connRepo.save(conn);
    return {
      id: conn.id,
      bspEndpoint: conn.bspEndpoint,
      phoneNumber: conn.phoneNumber,
      connectedAt: conn.connectedAt,
    };
  }

  @Get()
  async get(@CurrentSupplier() supplier: Supplier) {
    const conn = await this.connRepo.findOne({
      where: { supplierId: supplier.id },
    });
    if (!conn) return null;
    return {
      id: conn.id,
      bspEndpoint: conn.bspEndpoint,
      phoneNumber: conn.phoneNumber,
      connectedAt: conn.connectedAt,
    };
  }
}
