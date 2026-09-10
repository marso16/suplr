import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsAppConnection } from '../entities/whatsapp-connection.entity.js';
import { Client } from '../entities/client.entity.js';
import { BroadcastController } from './broadcast.controller.js';
import { WhatsAppModule } from '../whatsapp/whatsapp.module.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([WhatsAppConnection, Client]),
    WhatsAppModule,
    StorageModule,
  ],
  controllers: [BroadcastController],
})
export class BroadcastModule {}
