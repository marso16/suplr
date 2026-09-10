import { Controller, MessageEvent, Sse, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CurrentSupplier } from '../common/decorators/current-supplier.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { Supplier } from '../entities/supplier.entity.js';
import { SseService } from './sse.service.js';

@Controller()
export class SseController {
  constructor(private readonly sseService: SseService) {}

  @Sse('sse/orders')
  @UseGuards(JwtAuthGuard)
  stream(@CurrentSupplier() supplier: Supplier): Observable<MessageEvent> {
    return this.sseService.getSubject(supplier.id).pipe(
      map((data) => ({ data }) as MessageEvent),
    );
  }
}
