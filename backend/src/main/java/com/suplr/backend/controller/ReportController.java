package com.suplr.backend.controller;

import com.suplr.backend.config.Constants;
import com.suplr.backend.dto.ReportDtos.ClientStat;
import com.suplr.backend.dto.ReportDtos.PeriodBucket;
import com.suplr.backend.dto.ReportDtos.ProductStat;
import com.suplr.backend.dto.ReportDtos.ReportResponse;
import com.suplr.backend.entity.Supplier;
import com.suplr.backend.service.CacheService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

@RestController
@RequestMapping("/reports")
@RequiredArgsConstructor
public class ReportController {

    @PersistenceContext
    private EntityManager em;

    private final CacheService cacheService;

    @GetMapping
    public ReportResponse getReport(
            @RequestParam(defaultValue = "30d") String period,
            @AuthenticationPrincipal Supplier supplier
    ) {
        if (!period.matches("^(7d|30d|90d|1y|all)$")) {
            throw new IllegalArgumentException("Invalid period");
        }

        ReportResponse cached = cacheService.getCachedReport(
                supplier.getId(), period, ReportResponse.class);
        if (cached != null) return cached;

        Integer supplierId = supplier.getId();
        OffsetDateTime[] bounds = bounds(period);
        OffsetDateTime start = bounds[0];
        OffsetDateTime end = bounds[1];
        String trunc = trunc(period);

        String whereClause = start != null
                ? "o.supplierId = :sid AND o.status IN :statuses AND o.createdAt >= :start"
                : "o.supplierId = :sid AND o.status IN :statuses";

        var summaryQuery = em.createQuery(
                "SELECT COALESCE(SUM(o.total), 0), COUNT(o.id) FROM com.suplr.backend.entity.Order o WHERE " + whereClause,
                Object[].class);
        summaryQuery.setParameter("sid", supplierId);
        summaryQuery.setParameter("statuses", Constants.SETTLED);
        if (start != null) summaryQuery.setParameter("start", start);

        Object[] summaryRow = summaryQuery.getSingleResult();
        BigDecimal revenue = toBD(summaryRow[0]);
        int orderCount = ((Number) summaryRow[1]).intValue();
        BigDecimal avg = orderCount > 0
                ? revenue.divide(BigDecimal.valueOf(orderCount), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        String bucketSql = """
                SELECT date_trunc(:trunc, o.created_at) AS bucket,
                       COALESCE(SUM(o.total), 0) AS revenue,
                       COUNT(o.id) AS cnt
                FROM orders o
                WHERE o.supplier_id = :sid
                  AND o.status = ANY(:statuses)
                """ + (start != null ? "AND o.created_at >= :start " : "") + """
                GROUP BY bucket ORDER BY bucket
                """;

        var bucketQuery = em.createNativeQuery(bucketSql);
        bucketQuery.setParameter("trunc", trunc);
        bucketQuery.setParameter("sid", supplierId);
        bucketQuery.setParameter("statuses", Constants.SETTLED.toArray(new String[0]));
        if (start != null) bucketQuery.setParameter("start", start);

        @SuppressWarnings("unchecked")
        List<Object[]> bucketRows = bucketQuery.getResultList();
        List<PeriodBucket> buckets = bucketRows.stream().map(r -> {
            OffsetDateTime dt = toODT(r[0]);
            String label = "month".equals(trunc)
                    ? dt.format(Constants.MONTH_FMT) : dt.format(Constants.DAY_FMT);
            return new PeriodBucket(label, toBD(r[1]), ((Number) r[2]).intValue());
        }).toList();

        String prodSql = """
                SELECT COALESCE(p.name, oi.product_name_raw) AS name,
                       SUM(oi.quantity * oi.price) AS revenue,
                       COUNT(DISTINCT oi.order_id) AS cnt
                FROM order_items oi
                JOIN orders o ON o.id = oi.order_id
                LEFT JOIN products p ON p.id = oi.product_id
                WHERE o.supplier_id = :sid
                  AND o.status = ANY(:statuses)
                """ + (start != null ? "AND o.created_at >= :start " : "") + """
                GROUP BY COALESCE(p.name, oi.product_name_raw)
                ORDER BY revenue DESC
                LIMIT 8
                """;

        var prodQuery = em.createNativeQuery(prodSql);
        prodQuery.setParameter("sid", supplierId);
        prodQuery.setParameter("statuses", Constants.SETTLED.toArray(new String[0]));
        if (start != null) prodQuery.setParameter("start", start);

        @SuppressWarnings("unchecked")
        List<Object[]> prodRows = prodQuery.getResultList();
        List<ProductStat> topProducts = prodRows.stream()
                .map(r -> new ProductStat((String) r[0], toBD(r[1]), ((Number) r[2]).intValue()))
                .toList();

        String clientSql = """
                SELECT c.name, SUM(o.total) AS revenue,
                       COUNT(o.id) AS cnt, c.credit_balance
                FROM orders o
                JOIN clients c ON c.id = o.client_id
                WHERE o.supplier_id = :sid
                  AND o.status = ANY(:statuses)
                """ + (start != null ? "AND o.created_at >= :start " : "") + """
                GROUP BY c.id, c.name, c.credit_balance
                ORDER BY revenue DESC
                LIMIT 8
                """;

        var clientQuery = em.createNativeQuery(clientSql);
        clientQuery.setParameter("sid", supplierId);
        clientQuery.setParameter("statuses", Constants.SETTLED.toArray(new String[0]));
        if (start != null) clientQuery.setParameter("start", start);

        @SuppressWarnings("unchecked")
        List<Object[]> clientRows = clientQuery.getResultList();
        List<ClientStat> topClients = clientRows.stream()
                .map(r -> new ClientStat(
                        (String) r[0], toBD(r[1]),
                        ((Number) r[2]).intValue(), toBD(r[3])))
                .toList();

        ReportResponse result = new ReportResponse(
                period, revenue, orderCount, avg, buckets, topProducts, topClients);
        cacheService.setCachedReport(supplier.getId(), period, result);
        return result;
    }

    private OffsetDateTime[] bounds(String period) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        return switch (period) {
            case "7d" -> new OffsetDateTime[]{now.minusDays(7), now};
            case "30d" -> new OffsetDateTime[]{now.minusDays(30), now};
            case "90d" -> new OffsetDateTime[]{now.minusDays(90), now};
            case "1y" -> new OffsetDateTime[]{now.minusDays(365), now};
            default -> new OffsetDateTime[]{null, now};
        };
    }

    private String trunc(String period) {
        return switch (period) {
            case "1y", "all" -> "month";
            case "90d" -> "week";
            default -> "day";
        };
    }

    private BigDecimal toBD(Object o) {
        if (o == null) return BigDecimal.ZERO;
        return new BigDecimal(o.toString());
    }

    private OffsetDateTime toODT(Object o) {
        if (o instanceof java.time.OffsetDateTime odt)
            return odt;
        if (o instanceof java.time.Instant i)
            return i.atOffset(ZoneOffset.UTC);
        if (o instanceof java.sql.Timestamp ts)
            return ts.toInstant().atOffset(ZoneOffset.UTC);
        if (o instanceof java.time.LocalDateTime ldt)
            return ldt.atOffset(ZoneOffset.UTC);
        throw new IllegalArgumentException("Cannot convert to OffsetDateTime: " + o.getClass());
    }
}
