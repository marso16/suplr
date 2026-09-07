package com.suplr.backend.dto;

import com.suplr.backend.entity.Product;
import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;

public class ProductDtos {

    public record ProductRequest(
            @NotBlank String name,
            String sku,
            @NotBlank String unit,
            BigDecimal priceUsd,
            BigDecimal priceLbp
    ) {
    }

    public record ProductUpdateRequest(
            String name,
            String sku,
            String unit,
            BigDecimal priceUsd,
            BigDecimal priceLbp
    ) {
    }

    public record ProductResponse(
            Integer id,
            Integer supplierId,
            String name,
            String sku,
            String unit,
            BigDecimal priceUsd,
            BigDecimal priceLbp,
            boolean active
    ) {
        public static ProductResponse from(Product p) {
            return new ProductResponse(
                    p.getId(), p.getSupplierId(), p.getName(),
                    p.getSku(), p.getUnit(), p.getPriceUsd(),
                    p.getPriceLbp(), p.isActive()
            );
        }
    }
}
