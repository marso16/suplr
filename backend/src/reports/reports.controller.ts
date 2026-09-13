import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentSupplier } from '../common/decorators/current-supplier.decorator.js';
import { Supplier } from '../entities/supplier.entity.js';
import { CacheService } from '../cache/cache.service.js';
import { SETTLED } from '../common/constants.js';

interface PeriodBucket {
  label: string;
  revenue: number;
  order_count: number;
}
interface ProductStat {
  name: string;
  revenue: number;
  order_count: number;
}
interface ClientStat {
  name: string;
  revenue: number;
  order_count: number;
  creditBalance: number;
}
interface ReportResponse {
  period: string;
  revenue: number;
  order_count: number;
  avg_order_value: number;
  buckets: PeriodBucket[];
  top_products: ProductStat[];
  top_clients: ClientStat[];
}

function bounds(period: string): [Date | null, Date] {
  const now = new Date();
  switch (period) {
    case '7d':
      return [new Date(Date.now() - 7 * 86400000), now];
    case '30d':
      return [new Date(Date.now() - 30 * 86400000), now];
    case '90d':
      return [new Date(Date.now() - 90 * 86400000), now];
    case '1y':
      return [new Date(Date.now() - 365 * 86400000), now];
    default:
      return [null, now];
  }
}

function trunc(period: string): string {
  if (period === '1y' || period === 'all') return 'month';
  if (period === '90d') return 'week';
  return 'day';
}

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly cache: CacheService,
  ) {}

  @Get()
  async getReport(
    @Query('period') period = '30d',
    @CurrentSupplier() supplier: Supplier,
  ): Promise<ReportResponse> {
    if (!/^(7d|30d|90d|1y|all)$/.test(period))
      throw new Error('Invalid period');

    const cached = await this.cache.getCachedReport<ReportResponse>(
      supplier.id,
      period,
    );
    if (cached) return cached;

    const supplierId = supplier.id;
    const [start] = bounds(period);
    const truncPart = trunc(period);
    const statusArray = SETTLED;

    const startClause = start ? `AND o.created_at >= $3` : '';

    const summaryParams: unknown[] = [supplierId, statusArray];
    if (start) summaryParams.push(start);
    const summaryRows = (await this.ds.query(
      `SELECT COALESCE(SUM(o.total), 0) AS revenue, COUNT(o.id)::int AS cnt
       FROM orders o
       WHERE o.supplier_id = $1 AND o.status = ANY($2) ${startClause}`,
      summaryParams,
    )) as { revenue: string; cnt: number }[];

    const revenue = Number(summaryRows[0]?.revenue ?? 0);
    const orderCount = Number(summaryRows[0]?.cnt ?? 0);
    const avgOrderValue =
      orderCount > 0 ? Math.round((revenue / orderCount) * 100) / 100 : 0;

    const bucketParams: unknown[] = [supplierId, statusArray];
    if (start) bucketParams.push(start);
    const bucketRows = (await this.ds.query(
      `SELECT date_trunc('${truncPart}', o.created_at) AS bucket,
              COALESCE(SUM(o.total), 0) AS revenue,
              COUNT(o.id)::int AS cnt
       FROM orders o
       WHERE o.supplier_id = $1 AND o.status = ANY($2) ${startClause}
       GROUP BY bucket ORDER BY bucket`,
      bucketParams,
    )) as { bucket: Date; revenue: string; cnt: number }[];

    const DAY_FMT = (d: Date) =>
      d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const MON_FMT = (d: Date) =>
      d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    const buckets: PeriodBucket[] = bucketRows.map((r) => ({
      label:
        truncPart === 'month'
          ? MON_FMT(new Date(r.bucket))
          : DAY_FMT(new Date(r.bucket)),
      revenue: Number(r.revenue),
      order_count: Number(r.cnt),
    }));

    const prodParams: unknown[] = [supplierId, statusArray];
    if (start) prodParams.push(start);
    const prodRows = (await this.ds.query(
      `SELECT COALESCE(p.name, oi.product_name_raw) AS name,
              SUM(oi.quantity * oi.price) AS revenue,
              COUNT(DISTINCT oi.order_id)::int AS cnt
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE o.supplier_id = $1 AND o.status = ANY($2) ${startClause}
       GROUP BY COALESCE(p.name, oi.product_name_raw)
       ORDER BY revenue DESC LIMIT 8`,
      prodParams,
    )) as { name: string; revenue: string; cnt: number }[];

    const topProducts: ProductStat[] = prodRows.map((r) => ({
      name: r.name,
      revenue: Number(r.revenue),
      order_count: Number(r.cnt),
    }));

    const clientParams: unknown[] = [supplierId, statusArray];
    if (start) clientParams.push(start);
    const clientRows = (await this.ds.query(
      `SELECT c.name, SUM(o.total) AS revenue,
              COUNT(o.id)::int AS cnt, c.credit_balance
       FROM orders o
       JOIN clients c ON c.id = o.client_id
       WHERE o.supplier_id = $1 AND o.status = ANY($2) ${startClause}
       GROUP BY c.id, c.name, c.credit_balance
       ORDER BY revenue DESC LIMIT 8`,
      clientParams,
    )) as {
      name: string;
      revenue: string;
      cnt: number;
      credit_balance: string;
    }[];

    const topClients: ClientStat[] = clientRows.map((r) => ({
      name: r.name,
      revenue: Number(r.revenue),
      order_count: Number(r.cnt),
      creditBalance: Number(r.credit_balance ?? 0),
    }));

    const result: ReportResponse = {
      period,
      revenue,
      order_count: orderCount,
      avg_order_value: avgOrderValue,
      buckets,
      top_products: topProducts,
      top_clients: topClients,
    };
    await this.cache.setCachedReport(supplier.id, period, result);
    return result;
  }
}
