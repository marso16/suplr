package com.suplr.backend.dto;

import com.suplr.backend.entity.Order;
import com.suplr.backend.entity.OrderItem;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public class OrderDtos {

    public record OrderItemRequest(
            @NotBlank String productNameRaw,
            Integer productId,
            @NotNull @Positive BigDecimal quantity,
            @NotBlank String unit,
            @NotNull BigDecimal price,
            String notes
    ) {
    }

    public record OrderRequest(
            @NotNull Integer clientId,
            String currency,
            @NotNull @Valid List<OrderItemRequest> items
    ) {
    }

    public record DeliveryDateRequest(LocalDate deliveryDate) {
    }

    public record NotesRequest(String notes) {
    }


    public record ClientSummary(Integer id, String name, String whatsappNumber) {
    }

    public record OrderItemResponse(
            Integer id,
            String productName,
            String productNameRaw,
            Integer productId,
            String quantity,
            String unit,
            BigDecimal price,
            String notes
    ) {
        public static OrderItemResponse from(OrderItem item) {
            return new OrderItemResponse(
                    item.getId(),
                    item.getProductName(),
                    item.getProductNameRaw(),
                    item.getProductId(),
                    formatQuantity(item.getQuantity()),
                    item.getUnit(),
                    item.getPrice(),
                    item.getNotes()
            );
        }

        private static String formatQuantity(BigDecimal qty) {
            return qty.stripTrailingZeros().toPlainString();
        }
    }

    public record OrderResponse(
            Integer id,
            Integer supplierId,
            Integer clientId,
            ClientSummary client,
            String status,
            String currency,
            BigDecimal total,
            OffsetDateTime createdAt,
            OffsetDateTime confirmedAt,
            LocalDate deliveryDate,
            String notes,
            List<OrderItemResponse> items
    ) {
        public static OrderResponse from(Order o) {
            ClientSummary clientSummary = o.getClient() == null ? null :
                    new ClientSummary(
                            o.getClient().getId(),
                            o.getClient().getName(),
                            o.getClient().getWhatsappNumber()
                    );
            return new OrderResponse(
                    o.getId(), o.getSupplierId(), o.getClientId(),
                    clientSummary, o.getStatus(), o.getCurrency(),
                    o.getTotal(), o.getCreatedAt(), o.getConfirmedAt(),
                    o.getDeliveryDate(), o.getNotes(),
                    o.getItems().stream().map(OrderItemResponse::from).toList()
            );
        }
    }
}
