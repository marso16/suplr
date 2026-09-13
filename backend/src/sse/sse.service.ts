import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';
import { CacheService } from '../cache/cache.service.js';

interface SseEvent {
  type: string;
  order_id: number;
}

@Injectable()
export class SseService {
  private readonly logger = new Logger(SseService.name);
  private readonly subjects = new Map<number, Subject<SseEvent>>();

  constructor(private readonly cacheService: CacheService) {
    this.cacheService.sub.on('message', (channel: string, payload: string) => {
      const match = channel.match(/^supplier:(\d+):orders$/);
      if (!match) return;
      const supplierId = Number(match[1]);
      const subject = this.subjects.get(supplierId);
      if (subject) {
        try {
          subject.next(JSON.parse(payload) as SseEvent);
        } catch {
          /* ignore */
        }
      }
    });
  }

  getSubject(supplierId: number): Subject<SseEvent> {
    if (!this.subjects.has(supplierId)) {
      this.subjects.set(supplierId, new Subject<SseEvent>());
      const channel = `supplier:${supplierId}:orders`;
      this.cacheService.sub.subscribe(
        channel,
        (err: Error | null | undefined) => {
          if (err) this.logger.error(`Redis subscribe error: ${err.message}`);
        },
      );
    }
    return this.subjects.get(supplierId)!;
  }

  async publishOrderEvent(
    supplierId: number,
    eventType: string,
    orderId: number,
  ): Promise<void> {
    const channel = `supplier:${supplierId}:orders`;
    const payload = JSON.stringify({ type: eventType, order_id: orderId });
    await this.cacheService.publish(channel, payload);
    await this.cacheService.invalidateReportCache(supplierId);
  }
}
