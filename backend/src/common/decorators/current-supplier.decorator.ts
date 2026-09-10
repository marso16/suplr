import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { Supplier } from '../../entities/supplier.entity.js';

export const CurrentSupplier = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Supplier => {
    const req = ctx.switchToHttp().getRequest<Request & { user: Supplier }>();
    return req.user;
  },
);
