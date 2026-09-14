import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { IsString, IsEmail, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { AdminGuard } from '../common/guards/admin.guard.js';
import { Supplier } from '../entities/supplier.entity.js';
import { EmailService } from '../email/email.service.js';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

class CreateSupplierRequest {
  @IsString() name!: string;
  @IsEmail() email!: string;
  @MinLength(8) password!: string;
}
class PlanRequest {
  @IsString() plan!: string;
}
class AdminBroadcastRequest {
  @IsString() subject!: string;
  @IsString() message!: string;
}

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('suppliers')
  @HttpCode(HttpStatus.CREATED)
  async createSupplier(@Body() req: CreateSupplierRequest) {
    const exists = await this.supplierRepo.findOne({
      where: { email: req.email },
    });
    if (exists) throw new BadRequestException('Email already registered');
    const hash = await bcrypt.hash(req.password, 12);
    const supplier = await this.supplierRepo.save(
      this.supplierRepo.create({
        name: req.name,
        email: req.email,
        passwordHash: hash,
        plan: 'pro',
        mustChangePassword: true,
      }),
    );
    await this.emailService.sendWelcomeEmail(req.name, req.email, req.password);
    return this.toResponse(supplier);
  }

  @Get('suppliers')
  async listSuppliers() {
    const rows = (await this.ds.query(`
      SELECT s.id, COUNT(DISTINCT o.id)::int AS order_count,
             COUNT(DISTINCT i.id)::int AS invoice_count,
             COUNT(DISTINCT c.id)::int AS client_count,
             MAX(o.created_at) AS last_order_at
      FROM suppliers s
      LEFT JOIN orders o ON o.supplier_id = s.id
      LEFT JOIN invoices i ON i.supplier_id = s.id
      LEFT JOIN clients c ON c.supplier_id = s.id
      GROUP BY s.id ORDER BY s.created_at DESC
    `)) as {
      id: number;
      order_count: number;
      invoice_count: number;
      client_count: number;
      last_order_at: Date | null;
    }[];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    return Promise.all(
      rows.map(async (r) => {
        const s = await this.supplierRepo.findOne({ where: { id: r.id } });
        if (!s) return null;
        return {
          ...this.toResponse(s),
          orderCount: r.order_count,
          invoiceCount: r.invoice_count,
          clientCount: r.client_count,
          active:
            r.last_order_at != null && new Date(r.last_order_at) > sevenDaysAgo,
        };
      }),
    );
  }

  @Patch('suppliers/:supplierId/plan')
  async setPlan(
    @Param('supplierId', ParseIntPipe) supplierId: number,
    @Body() req: PlanRequest,
  ) {
    if (req.plan !== 'pro') throw new BadRequestException('Plan must be pro');
    const s = await this.getSupplier(supplierId);
    s.plan = req.plan;
    return this.toResponse(await this.supplierRepo.save(s));
  }

  @Patch('suppliers/:supplierId/suspend')
  async toggleSuspend(@Param('supplierId', ParseIntPipe) supplierId: number) {
    const s = await this.getSupplier(supplierId);
    if (s.isAdmin)
      throw new BadRequestException('Cannot suspend an admin account');
    s.suspended = !s.suspended;
    return this.toResponse(await this.supplierRepo.save(s));
  }

  @Delete('suppliers/:supplierId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSupplier(@Param('supplierId', ParseIntPipe) supplierId: number) {
    const s = await this.getSupplier(supplierId);
    if (s.isAdmin)
      throw new BadRequestException('Cannot delete an admin account');
    await this.ds.transaction(async (em) => {
      const q = (sql: string) => em.query(sql, [supplierId]);
      // invoices and order_items must precede orders (FK)
      await Promise.all([
        q('DELETE FROM invoices WHERE supplier_id = $1'),
        q(
          'DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE supplier_id = $1)',
        ),
      ]);
      await q('DELETE FROM orders WHERE supplier_id = $1');
      await Promise.all([
        q('DELETE FROM messages WHERE supplier_id = $1'),
        q('DELETE FROM pending_orders WHERE supplier_id = $1'),
        q('DELETE FROM clients WHERE supplier_id = $1'),
        q('DELETE FROM products WHERE supplier_id = $1'),
        q('DELETE FROM whatsapp_connections WHERE supplier_id = $1'),
      ]);
      await em.query('DELETE FROM suppliers WHERE id = $1', [supplierId]);
    });
  }

  @Post('suppliers/:supplierId/impersonate')
  async impersonate(@Param('supplierId', ParseIntPipe) supplierId: number) {
    const s = await this.getSupplier(supplierId);
    if (s.isAdmin) throw new BadRequestException('Cannot impersonate admin');
    const token = await this.jwtService.signAsync({ sub: supplierId });
    return { token };
  }

  @Get('orders')
  async listAllOrders() {
    const rows = (await this.ds.query(`
      SELECT o.id, o.status, o.created_at, s.name AS supplier_name, c.name AS client_name
      FROM orders o
      JOIN suppliers s ON s.id = o.supplier_id
      JOIN clients c ON c.id = o.client_id
      ORDER BY o.created_at DESC LIMIT 200
    `)) as {
      id: number;
      status: string;
      created_at: Date;
      supplier_name: string;
      client_name: string;
    }[];
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.created_at,
      supplierName: r.supplier_name,
      clientName: r.client_name,
    }));
  }

  @Post('broadcast')
  @HttpCode(HttpStatus.NO_CONTENT)
  async broadcast(@Body() req: AdminBroadcastRequest) {
    const suppliers = await this.supplierRepo.find({
      where: { isAdmin: false, suspended: false },
    });
    await Promise.allSettled(
      suppliers.map((s) =>
        this.emailService.sendBroadcastEmail(s.email, req.subject, req.message),
      ),
    );
  }

  private async getSupplier(id: number): Promise<Supplier> {
    const s = await this.supplierRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Supplier not found');
    return s;
  }

  private toResponse(s: Supplier) {
    return {
      id: s.id,
      name: s.name,
      email: s.email,
      plan: s.plan,
      isAdmin: s.isAdmin,
      suspended: s.suspended,
      mustChangePassword: s.mustChangePassword,
      logo: s.logo,
      createdAt: s.createdAt,
    };
  }
}
