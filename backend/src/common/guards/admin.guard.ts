import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { Supplier } from '../../entities/supplier.entity.js';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { user: Supplier }>();
    if (!req.user?.isAdmin) throw new ForbiddenException('Forbidden');
    return true;
  }
}
