package com.suplr.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(
        name = "pending_orders",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_pending_supplier_client",
                columnNames = {"supplier_id", "client_id"}
        )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PendingOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "supplier_id", nullable = false)
    private Integer supplierId;

    @Column(name = "client_id", nullable = false)
    private Integer clientId;

    @Column(length = 5, nullable = false)
    private String currency;

    @Column(name = "items_json", columnDefinition = "text", nullable = false)
    private String itemsJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    private void prePersist() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }
}