import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../entities/client.entity.js';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
  ) {}

  async create(
    supplierId: number,
    dto: {
      name: string;
      whatsappNumber: string;
      creditTerms?: string;
      notes?: string;
      email?: string;
    },
  ) {
    const client = this.clientRepo.create({ supplierId, ...dto });
    await this.clientRepo.save(client);
    return this.toResponse(client);
  }

  async list(supplierId: number) {
    const clients = await this.clientRepo.find({ where: { supplierId } });
    return clients.map(this.toResponse);
  }

  async adjustCredit(
    clientId: number,
    supplierId: number,
    amount: number,
  ) {
    const client = await this.clientRepo.findOne({
      where: { id: clientId, supplierId },
    });
    if (!client) throw new NotFoundException('Client not found');
    const current = parseFloat(client.creditBalance) || 0;
    client.creditBalance = (current + amount).toFixed(2);
    await this.clientRepo.save(client);
    return this.toResponse(client);
  }

  async delete(clientId: number, supplierId: number): Promise<void> {
    const client = await this.clientRepo.findOne({
      where: { id: clientId, supplierId },
    });
    if (!client) throw new NotFoundException('Client not found');
    await this.clientRepo.remove(client);
  }

  async getOrCreateByWhatsapp(
    supplierId: number,
    whatsappNumber: string,
  ): Promise<Client> {
    let client = await this.clientRepo.findOne({
      where: { supplierId, whatsappNumber },
    });
    if (!client) {
      try {
        client = await this.clientRepo.save(
          this.clientRepo.create({
            supplierId,
            name: whatsappNumber,
            whatsappNumber,
          }),
        );
      } catch {
        const existing = await this.clientRepo.findOne({
          where: { supplierId, whatsappNumber },
        });
        if (!existing)
          throw new BadRequestException('Failed to resolve client');
        client = existing;
      }
    }
    return client;
  }

  toResponse(c: Client) {
    return {
      id: c.id,
      supplier_id: c.supplierId,
      name: c.name,
      whatsapp_number: c.whatsappNumber,
      credit_terms: c.creditTerms,
      notes: c.notes,
      credit_balance: c.creditBalance,
      email: c.email,
    };
  }
}
