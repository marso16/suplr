import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Supplier } from '../entities/supplier.entity.js';
import { EmailService } from '../email/email.service.js';

export interface LoginDto { email: string; password: string; }
export interface RegisterDto { name: string; email: string; password: string; }
export interface ProfileDto { name?: string; address?: string; phone?: string; logo?: string; }
export interface ChangePasswordDto { currentPassword: string; newPassword: string; }

function supplierResponse(s: Supplier) {
  return {
    id: s.id, name: s.name, email: s.email, plan: s.plan,
    logo: s.logo, address: s.address, phone: s.phone,
    is_admin: s.isAdmin, suspended: s.suspended,
    must_change_password: s.mustChangePassword,
    created_at: s.createdAt, last_login_at: s.lastLoginAt,
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Supplier) private readonly supplierRepo: Repository<Supplier>,
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

  async login(dto: LoginDto) {
    const supplier = await this.supplierRepo.findOne({ where: { email: dto.email } });
    if (!supplier || !(await bcrypt.compare(dto.password, supplier.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (supplier.suspended) throw new UnauthorizedException('Account suspended');
    supplier.lastLoginAt = new Date();
    await this.supplierRepo.save(supplier);
    const expiresIn = Number(this.config.get('JWT_EXPIRATION_MINUTES', 1440)) * 60;
    const token = this.jwtService.sign({ sub: String(supplier.id) }, { expiresIn });
    return { access_token: token, token_type: 'bearer' };
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
