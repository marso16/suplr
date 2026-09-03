package com.suplr.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "invoices")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Invoice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "supplier_id", nullable = false)
    private Integer supplierId;

    @Column(name = "order_id", nullable = false, unique = true)
    private Integer orderId;

    @Column(length = 50, nullable = false)
    private String number;

    @Column(length = 5, nullable = false)
    private String currency;

    @Column(precision = 12, scale = 2, nullable = false)
    private BigDecimal total;

    @Column(name = "issued_at", nullable = false, updatable = false)
    private OffsetDateTime issuedAt;

    @Column(name = "paid_at")
    private OffsetDateTime paidAt;

    @PrePersist
    private void prePersist() {
        if (issuedAt == null) issuedAt = OffsetDateTime.now();
    }
}
