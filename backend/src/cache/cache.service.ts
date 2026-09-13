import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { TTL_WEBHOOK_SECS, TTL_REPORT_SECS } from '../common/constants.js';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  readonly client: Redis;
  readonly sub: Redis;

  constructor(config: ConfigService) {
    const url = config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.client = new Redis(url, { lazyConnect: true });
    this.sub = new Redis(url, { lazyConnect: true });
    this.client
      .connect()
      .catch((e: Error) =>
        this.logger.warn(`Redis connect failed: ${e.message}`),
      );
    this.sub
      .connect()
      .catch((e: Error) =>
        this.logger.warn(`Redis sub connect failed: ${e.message}`),
      );
  }

  onModuleDestroy() {
    this.client.quit();
    this.sub.quit();
  }

  async isMessageSeen(supplierId: number, msgId: string): Promise<boolean> {
    try {
      return (await this.client.exists(`idem:${supplierId}:${msgId}`)) === 1;
    } catch {
      return false;
    }
  }

  async markMessageSeen(supplierId: number, msgId: string): Promise<void> {
    try {
      await this.client.set(
        `idem:${supplierId}:${msgId}`,
        '1',
        'EX',
        TTL_WEBHOOK_SECS,
      );
    } catch {
      /* silent */
    }
  }

  async getCachedReport<T>(
    supplierId: number,
    period: string,
  ): Promise<T | null> {
    try {
      const raw = await this.client.get(`report:${supplierId}:${period}`);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async setCachedReport(
    supplierId: number,
    period: string,
    data: unknown,
  ): Promise<void> {
    try {
      await this.client.set(
        `report:${supplierId}:${period}`,
        JSON.stringify(data),
        'EX',
        TTL_REPORT_SECS,
      );
    } catch {
      /* silent */
    }
  }

  async invalidateReportCache(supplierId: number): Promise<void> {
    try {
      const keys = await this.client.keys(`report:${supplierId}:*`);
      if (keys.length) await this.client.del(...keys);
    } catch {
      /* silent */
    }
  }

  async publish(channel: string, payload: string): Promise<void> {
    try {
      await this.client.publish(channel, payload);
    } catch (e) {
      this.logger.error(
        `Redis publish failed on ${channel}: ${(e as Error).message}`,
      );
    }
  }
}
