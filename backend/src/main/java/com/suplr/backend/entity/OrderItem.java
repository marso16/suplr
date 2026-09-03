package com.suplr.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;


@Entity
@Table(name = "order_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @Column(name = "product_id")
    private Integer productId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "product_id", insertable = false, updatable = false)
    private Product product;

    @Column(name = "product_name_raw", length = 200, nullable = false)
    private String productNameRaw;

    @Column(precision = 12, scale = 3, nullable = false)
    private BigDecimal quantity;

    @Column(length = 50, nullable = false)
    private String unit;

    @Column(precision = 12, scale = 2, nullable = false)
    private BigDecimal price;

    @Column(columnDefinition = "text")
    private String notes;

    public String getProductName() {
        return (product != null) ? product.getName() : productNameRaw;
    }
}
