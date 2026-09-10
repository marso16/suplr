import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from '../../entities/supplier.entity.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Supplier) private readonly supplierRepo: Repository<Supplier>,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Record<string, unknown>>();
    const auth = (req.headers as Record<string, string>)?.authorization;
    const token: string | undefined = auth?.startsWith('Bearer ')
      ? auth.slice(7)
      : (req.query as Record<string, string>)?.token;
    if (!token) throw new UnauthorizedException();
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: number }>(token, {
        secret: this.config.get<string>('JWT_SECRET')!,
      });
      const supplier = await this.supplierRepo.findOne({ where: { id: Number(payload.sub) } });
      if (!supplier || supplier.suspended) throw new UnauthorizedException();
      (req as Record<string, unknown>).user = supplier;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
