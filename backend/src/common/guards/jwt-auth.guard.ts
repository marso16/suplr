import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Supplier } from '../../entities/supplier.entity.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwtSecret: string;

  constructor(
    private readonly jwtService: JwtService,
    @InjectDataSource() private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.jwtSecret = config.get<string>('JWT_SECRET')!;
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Record<string, unknown>>();
    const auth = (req.headers as Record<string, string>)?.authorization;
    const token: string | undefined = auth?.startsWith('Bearer ')
      ? auth.slice(7)
      : (req.query as Record<string, string>)?.token;
    if (!token) throw new UnauthorizedException();

    let payload: { sub: number };
    try {
      payload = await this.jwtService.verifyAsync<{ sub: number }>(token, {
        secret: this.jwtSecret,
      });
    } catch {
      throw new UnauthorizedException();
    }

    const supplier = await this.dataSource
      .getRepository(Supplier)
      .findOne({ where: { id: Number(payload.sub) } });
    if (!supplier || supplier.suspended) throw new UnauthorizedException();
    (req as Record<string, unknown>).user = supplier;
    return true;
  }
}
