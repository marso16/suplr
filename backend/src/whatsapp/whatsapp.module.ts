import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from '../entities/message.entity.js';
import { PendingOrder } from '../entities/pending-order.entity.js';
import { Client } from '../entities/client.entity.js';
import { Order } from '../entities/order.entity.js';
import { WhatsAppConnection } from '../entities/whatsapp-connection.entity.js';
import { Product } from '../entities/product.entity.js';
import { Supplier } from '../entities/supplier.entity.js';
import { WhatsAppService } from './whatsapp.service.js';
import { WhatsAppSenderService } from './whatsapp-sender.service.js';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller.js';
import { WhatsAppConnectionController } from './whatsapp-connection.controller.js';
import { ClientsModule } from '../clients/clients.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { AiModule } from '../ai/ai.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Message,
      PendingOrder,
      Client,
      Order,
      WhatsAppConnection,
      Product,
      Supplier,
    ]),
    ClientsModule,
    OrdersModule,
    AiModule,
  ],
  controllers: [WhatsAppWebhookController, WhatsAppConnectionController],
  providers: [WhatsAppService, WhatsAppSenderService],
  exports: [WhatsAppService, WhatsAppSenderService],
})
export class WhatsAppModule {}
