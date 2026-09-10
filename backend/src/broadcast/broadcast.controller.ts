import {
  Controller, Post, UseGuards, Body, UseInterceptors, UploadedFile,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsOptional, IsString, IsDateString } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentSupplier } from '../common/decorators/current-supplier.decorator.js';
import { Supplier } from '../entities/supplier.entity.js';
import { Client } from '../entities/client.entity.js';
import { WhatsAppConnection } from '../entities/whatsapp-connection.entity.js';
import { WhatsAppSenderService } from '../whatsapp/whatsapp-sender.service.js';
import { StorageService } from '../storage/storage.service.js';
import { randomBytes } from 'node:crypto';

class BroadcastRequest {
  @IsString() message!: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsString() mediaUrl?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('broadcast')
export class BroadcastController {
  private readonly logger = new Logger(BroadcastController.name);

  constructor(
    @InjectRepository(WhatsAppConnection) private readonly connRepo: Repository<WhatsAppConnection>,
    @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
    private readonly sender: WhatsAppSenderService,
    private readonly storage: StorageService,
  ) {}

  @Post()
  async sendBroadcast(@CurrentSupplier() supplier: Supplier, @Body() req: BroadcastRequest) {
    const conn = await this.connRepo.findOne({ where: { supplierId: supplier.id } });
    if (!conn) return { sent: 0, failed: 0, total: 0, scheduled: false, jobId: null };

    const clients = await this.clientRepo.find({ where: { supplierId: supplier.id } });
    if (clients.length === 0) return { sent: 0, failed: 0, total: 0, scheduled: false, jobId: null };

    const numbers = clients.map(c => c.whatsappNumber);

    if (req.scheduledAt) {
      const jobId = await this.sender.enqueueBroadcast(
        conn.bspEndpoint, conn.bspApiKey,
        numbers, req.message,
        new Date(req.scheduledAt),
        req.mediaUrl,
      );
      this.logger.log(`Broadcast scheduled for ${req.scheduledAt} — job ${jobId} (supplier ${supplier.id})`);
      return { sent: 0, failed: 0, total: clients.length, scheduled: true, jobId };
    }

    const results = await Promise.allSettled(
      numbers.map(number =>
        this.sender.sendMessage(conn.bspEndpoint, conn.bspApiKey, number, req.message, req.mediaUrl)
      )
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - sent;
    this.logger.log(`Broadcast: ${sent}/${clients.length} sent (supplier ${supplier.id})`);
    return { sent, failed, total: clients.length, scheduled: false, jobId: null };
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMedia(@CurrentSupplier() supplier: Supplier, @UploadedFile() file: Express.Multer.File & { buffer: Buffer }) {
    const ext = getExtension(file.originalname);
    const key = `broadcasts/${supplier.id}/${randomBytes(16).toString('hex')}${ext}`;
    const url = await this.storage.upload(key, file.buffer, file.mimetype ?? 'application/octet-stream');
    return { url };
  }
}

function getExtension(filename?: string): string {
  if (!filename) return '.bin';
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.substring(dot).toLowerCase() : '.bin';
}
