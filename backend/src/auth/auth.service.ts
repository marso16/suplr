import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHmac, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { Supplier } from '../entities/supplier.entity.js';
import { EmailService } from '../email/email.service.js';

export interface LoginDto {
  email: string;
  password: string;
}
export interface RegisterDto {
  name: string;
  email: string;
  password: string;
}
export interface ProfileDto {
  name?: string;
  address?: string;
  phone?: string;
  logo?: string;
}
export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

function supplierResponse(s: Supplier) {
  return {
    id: s.id,
    name: s.name,
    email: s.email,
    plan: s.plan,
    logo: s.logo,
    address: s.address,
    phone: s.phone,
    is_admin: s.isAdmin,
    suspended: s.suspended,
    must_change_password: s.mustChangePassword,
    created_at: s.createdAt,
    last_login_at: s.lastLoginAt,
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    if (await this.supplierRepo.existsBy({ email: dto.email })) {
      throw new BadRequestException('Email already registered');
    }
    const supplier = this.supplierRepo.create({
      name: dto.name,
      email: dto.email,
      passwordHash: await bcrypt.hash(dto.password, 12),
      plan: 'pro',
      mustChangePassword: true,
    });
    await this.supplierRepo.save(supplier);
    this.emailService.sendWelcomeEmail(dto.name, dto.email, dto.password);
    return supplierResponse(supplier);
  }

  async login(dto: LoginDto, meta: { ip: string; ua: string } = { ip: '', ua: '' }) {
    const supplier = await this.supplierRepo.findOne({
      where: { email: dto.email },
    });
    if (
      !supplier ||
      !(await bcrypt.compare(dto.password, supplier.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (supplier.suspended)
      throw new UnauthorizedException('Account suspended');
    supplier.lastLoginAt = new Date();
    await this.supplierRepo.save(supplier);
    const expiresIn =
      Number(this.config.get('JWT_EXPIRATION_MINUTES', 1440)) * 60;
    const token = this.jwtService.sign(
      { sub: String(supplier.id), tv: supplier.tokenVersion },
      { expiresIn },
    );

    // Fire login alert email in background (don't block the response)
    const revokeUrl = this.buildRevokeUrl(supplier.id);
    this.emailService
      .sendLoginAlertEmail(supplier, meta.ip, meta.ua, revokeUrl)
      .catch(() => {});

    return { access_token: token, token_type: 'bearer' };
  }

  async revokeAllSessions(token: string): Promise<boolean> {
    const payload = this.verifyRevokeToken(token);
    if (!payload) return false;
    const supplier = await this.supplierRepo.findOne({
      where: { id: payload.supplierId },
    });
    if (!supplier) return false;
    supplier.tokenVersion = (supplier.tokenVersion ?? 1) + 1;
    await this.supplierRepo.save(supplier);
    return true;
  }

  private buildRevokeUrl(supplierId: number): string {
    const ts = Date.now();
    const payload = `${supplierId}:${ts}`;
    const secret = this.config.get<string>('JWT_SECRET') ?? '';
    const sig = createHmac('sha256', secret).update(payload).digest('hex');
    const t = Buffer.from(`${payload}:${sig}`).toString('base64url');
    const base = this.config.get<string>('FRONTEND_URL', 'https://suplr.marcelinokeyrouz.com');
    return `${base}/api/auth/revoke?t=${t}`;
  }

  private verifyRevokeToken(token: string): { supplierId: number } | null {
    try {
      const decoded = Buffer.from(token, 'base64url').toString();
      const idx = decoded.lastIndexOf(':');
      const payload = decoded.slice(0, idx);
      const sig = decoded.slice(idx + 1);
      const parts = payload.split(':');
      if (parts.length !== 2) return null;
      const ts = Number(parts[1]);
      if (Date.now() - ts > 48 * 60 * 60 * 1000) return null;
      const secret = this.config.get<string>('JWT_SECRET') ?? '';
      const expected = createHmac('sha256', secret).update(payload).digest('hex');
      if (!timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
      return { supplierId: Number(parts[0]) };
    } catch {
      return null;
    }
  }

  async updateProfile(supplier: Supplier, dto: ProfileDto) {
    if (dto.name != null) supplier.name = dto.name;
    if (dto.address != null) supplier.address = dto.address;
    if (dto.phone != null) supplier.phone = dto.phone;
    if (dto.logo != null) supplier.logo = dto.logo;
    await this.supplierRepo.save(supplier);
    return supplierResponse(supplier);
  }

  async changePassword(supplier: Supplier, dto: ChangePasswordDto) {
    if (!(await bcrypt.compare(dto.currentPassword, supplier.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    supplier.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    supplier.mustChangePassword = false;
    await this.supplierRepo.save(supplier);
    return supplierResponse(supplier);
  }

  async updatePlan(supplier: Supplier, plan: string) {
    if (plan !== 'pro') throw new BadRequestException("Plan must be 'pro'");
    supplier.plan = plan;
    await this.supplierRepo.save(supplier);
    return supplierResponse(supplier);
  }
}
