import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';
import { ClientsModule } from './clients/clients.module.js';
import { ProductsModule } from './products/products.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { InvoicesModule } from './invoices/invoices.module.js';
import { WhatsAppModule } from './whatsapp/whatsapp.module.js';
import { BroadcastModule } from './broadcast/broadcast.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { AdminModule } from './admin/admin.module.js';
import { SseModule } from './sse/sse.module.js';
import { CacheModule } from './cache/cache.module.js';
import { EmailModule } from './email/email.module.js';
import { StorageModule } from './storage/storage.module.js';
import { PdfModule } from './pdf/pdf.module.js';
import { AiModule } from './ai/ai.module.js';
import { Supplier } from './entities/supplier.entity.js';
import { Client } from './entities/client.entity.js';
import { Product } from './entities/product.entity.js';
import { Order } from './entities/order.entity.js';
import { OrderItem } from './entities/order-item.entity.js';
import { Invoice } from './entities/invoice.entity.js';
import { Message } from './entities/message.entity.js';
import { PendingOrder } from './entities/pending-order.entity.js';
import { WhatsAppConnection } from './entities/whatsapp-connection.entity.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get<string>('DB_HOST', 'localhost'),
        port: cfg.get<number>('DB_PORT', 5432),
        database: cfg.get<string>('DB_NAME', 'whatsapp_orders'),
        username: cfg.get<string>('DB_USER', 'ubuntu'),
        password: cfg.get<string>('DB_PASS', ''),
        entities: [Supplier, Client, Product, Order, OrderItem, Invoice, Message, PendingOrder, WhatsAppConnection],
        synchronize: false,
        logging: false,
      }),
    }),
    CacheModule,
    EmailModule,
    StorageModule,
    PdfModule,
    AiModule,
    AuthModule,
    ClientsModule,
    ProductsModule,
    OrdersModule,
    InvoicesModule,
    WhatsAppModule,
    BroadcastModule,
    ReportsModule,
    AdminModule,
    SseModule,
  ],
})
export class AppModule {}
