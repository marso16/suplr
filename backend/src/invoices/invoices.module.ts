import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../entities/client.entity.js';
import { Invoice } from '../entities/invoice.entity.js';
import { Order } from '../entities/order.entity.js';
import { EmailModule } from '../email/email.module.js';
import { PdfModule } from '../pdf/pdf.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { InvoicesController } from './invoices.controller.js';
import { InvoicesService } from './invoices.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, Order, Client]),
    PdfModule,
    EmailModule,
    StorageModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
