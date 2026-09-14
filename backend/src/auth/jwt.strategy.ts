import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { Supplier } from '../entities/supplier.entity.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => req?.query?.token as string | null,
      ]),
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: { sub: string; tv?: number }): Promise<Supplier> {
    const supplier = await this.supplierRepo.findOne({
      where: { id: Number(payload.sub) },
    });
    if (!supplier || supplier.suspended) throw new UnauthorizedException();
    if (payload.tv !== undefined && payload.tv !== supplier.tokenVersion) {
      throw new UnauthorizedException('Session revoked');
    }
    return supplier;
  }
}
