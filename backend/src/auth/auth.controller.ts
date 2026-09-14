import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentSupplier } from '../common/decorators/current-supplier.decorator.js';
import { AdminGuard } from '../common/guards/admin.guard.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { Supplier } from '../entities/supplier.entity.js';
import { StorageService } from '../storage/storage.service.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly storageService: StorageService,
  ) {}

  @Post('register')
  @UseGuards(JwtAuthGuard, AdminGuard)
  register(@Body() body: { name: string; email: string; password: string }) {
    return this.authService.register(body);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() body: { email: string; password: string }, @Req() req: Request) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      '';
    const ua = req.headers['user-agent'] ?? '';
    return this.authService.login(body, { ip, ua });
  }

  @Get('revoke')
  async revokeAll(
    @Query('t') token: string,
    @Res() res: Response,
  ) {
    const frontendUrl =
      process.env.FRONTEND_URL ?? 'https://suplr.marcelinokeyrouz.com';
    const ok = await this.authService.revokeAllSessions(token ?? '');
    if (ok) {
      res.redirect(`${frontendUrl}/login?revoked=1`);
    } else {
      res.redirect(`${frontendUrl}/login?revoked=invalid`);
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentSupplier() supplier: Supplier) {
    return {
      id: supplier.id,
      name: supplier.name,
      email: supplier.email,
      plan: supplier.plan,
      logo: supplier.logo,
      address: supplier.address,
      phone: supplier.phone,
      isAdmin: supplier.isAdmin,
      suspended: supplier.suspended,
      mustChangePassword: supplier.mustChangePassword,
      createdAt: supplier.createdAt,
      lastLoginAt: supplier.lastLoginAt,
    };
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  updateProfile(
    @CurrentSupplier() supplier: Supplier,
    @Body()
    body: { name?: string; address?: string; phone?: string; logo?: string },
  ) {
    return this.authService.updateProfile(supplier, body);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  changePassword(
    @CurrentSupplier() supplier: Supplier,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(supplier, body);
  }

  @Patch('plan')
  @UseGuards(JwtAuthGuard, AdminGuard)
  updatePlan(
    @CurrentSupplier() supplier: Supplier,
    @Body() body: { plan: string },
  ) {
    return this.authService.updatePlan(supplier, body.plan);
  }

  @Post('upload-logo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @CurrentSupplier() supplier: Supplier,
    @UploadedFile() file: Express.Multer.File & { buffer: Buffer },
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const ext = (
      file.originalname.match(/\.[^.]+$/)?.[0] ?? '.bin'
    ).toLowerCase();
    const key = `logos/${supplier.id}/${Date.now()}${ext}`;
    const url = this.storageService.upload(key, file.buffer, file.mimetype);
    return { url };
  }
}
