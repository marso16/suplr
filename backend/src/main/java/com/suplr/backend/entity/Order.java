package com.suplr.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "supplier_id", nullable = false)
    private Integer supplierId;

    @Column(name = "client_id", nullable = false)
    private Integer clientId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "client_id", insertable = false, updatable = false)
    private Client client;

    @Column(length = 20, nullable = false)
    @Builder.Default
    private String status = "pending";

    @Column(length = 5, nullable = false)
    @Builder.Default
    private String currency = "USD";

    @Column(precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal total = BigDecimal.ZERO;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "confirmed_at")
    private OffsetDateTime confirmedAt;

    @Column(name = "delivery_date")
    private LocalDate deliveryDate;

    @Column(columnDefinition = "text")
    private String notes;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    @Builder.Default
    private List<OrderItem> items = new ArrayList<>();

    @PrePersist
    private void prePersist() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }
}
