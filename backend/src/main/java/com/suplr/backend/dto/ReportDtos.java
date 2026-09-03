package com.suplr.backend.dto;

import java.math.BigDecimal;
import java.util.List;

public class ReportDtos {

    public record PeriodBucket(String label, BigDecimal revenue, int orderCount) {
    }

    public record ProductStat(String name, BigDecimal revenue, int orderCount) {
    }

    public record ClientStat(
            String name,
            BigDecimal revenue,
            int orderCount,
            BigDecimal creditBalance
    ) {
    }

    public record ReportResponse(
            String period,
            BigDecimal revenue,
            int orderCount,
            BigDecimal avgOrderValue,
            List<PeriodBucket> buckets,
            List<ProductStat> topProducts,
            List<ClientStat> topClients
    ) {
    }
}
