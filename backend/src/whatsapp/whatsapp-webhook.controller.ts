import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
  ParseIntPipe,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { WhatsAppService } from './whatsapp.service.js';
import { CacheService } from '../cache/cache.service.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from '../entities/supplier.entity.js';
import { Client } from '../entities/client.entity.js';
import { ConfigService } from '@nestjs/config';

@Controller('webhook')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private readonly whatsAppService: WhatsAppService,
    private readonly cache: CacheService,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
    private readonly config: ConfigService,
  ) {}

  @Get(':supplierId')
  verify(
    @Param('supplierId', ParseIntPipe) supplierId: number,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const verifyToken = this.config.get<string>('WEBHOOK_VERIFY_TOKEN', '');
    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log(`Webhook verified for supplier ${supplierId}`);
      return challenge;
    }
    this.logger.warn(`Webhook verification failed for supplier ${supplierId}`);
    return 'Verification failed';
  }

  @Post(':supplierId')
  async receive(
    @Param('supplierId', ParseIntPipe) supplierId: number,
    @Body() jsonBody: Record<string, unknown>,
    @Req() req: Request,
  ) {
    const contentType = req.headers['content-type'] ?? '';

    if (contentType.includes('application/json') && jsonBody) {
      const messages = (jsonBody['messages'] as any[]) ?? [];
      for (const msg of messages) {
        if (msg.type !== 'text') continue;
        const msgId: string = msg.id ?? '';
        const from: string = msg.from ?? '';
        const body: string = (msg.text as any)?.body ?? '';
        if (from && body) await this.process(supplierId, msgId, from, body);
      }
    } else {
      const body = req.body as Record<string, string>;
      const msgId = body['MessageSid'] ?? '';
      let from = body['From'] ?? '';
      const text = body['Body'] ?? '';
      from = from.replace('whatsapp:', '');
      if (from && text) await this.process(supplierId, msgId, from, text);
    }

    return { status: 'ok' };
  }

  private async process(
    supplierId: number,
    msgId: string,
    fromNumber: string,
    text: string,
  ) {
    try {
      if (msgId && (await this.cache.isMessageSeen(supplierId, msgId))) {
        this.logger.log(
          `Duplicate message ${msgId} for supplier ${supplierId} — skipped`,
        );
        return;
      }
      if (msgId) await this.cache.markMessageSeen(supplierId, msgId);

      const message = await this.whatsAppService.storeInboundMessage(
        supplierId,
        msgId,
        fromNumber,
        text,
      );

      if (
        await this.whatsAppService.handleNameCollection(
          supplierId,
          message.clientId!,
          text,
          fromNumber,
        )
      )
        return;

      if (this.whatsAppService.isHistoryQuery(text)) {
        const client = await this.clientRepo.findOne({
          where: { id: message.clientId! },
        });
        const lang = client?.preferredLanguage ?? 'en';
        await this.whatsAppService.handleHistoryQuery(
          supplierId,
          message.clientId!,
          fromNumber,
          lang,
        );
        return;
      }

      if (
        await this.whatsAppService.handlePendingConfirmation(
          supplierId,
          message.clientId!,
          fromNumber,
          text,
        )
      )
        return;

      const supplier = await this.supplierRepo.findOne({
        where: { id: supplierId },
      });
      if (supplier?.plan === 'pro') {
        await this.whatsAppService.parseAndCreateOrder(
          supplierId,
          message,
          fromNumber,
        );
      }
    } catch (e: any) {
      this.logger.error(
        `Error processing message from ${fromNumber} for supplier ${supplierId}: ${e.message}`,
        e.stack,
      );
    }
  }
}
