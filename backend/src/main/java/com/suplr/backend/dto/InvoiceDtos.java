package com.suplr.backend.dto;

import com.suplr.backend.entity.Invoice;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public class InvoiceDtos {

    public record InvoiceRequest(@NotNull Integer orderId) {
    }

    public record InvoiceResponse(
            Integer id,
            Integer supplierId,
            Integer orderId,
            String number,
            String currency,
            BigDecimal total,
            OffsetDateTime issuedAt,
            OffsetDateTime paidAt,
            String clientName,
            String clientEmail
    ) {
        public static InvoiceResponse from(Invoice inv) {
            return new InvoiceResponse(
                    inv.getId(), inv.getSupplierId(), inv.getOrderId(),
                    inv.getNumber(), inv.getCurrency(), inv.getTotal(),
                    inv.getIssuedAt(), inv.getPaidAt(), null, null
            );
        }

        public static InvoiceResponse from(Invoice inv, String clientName, String clientEmail) {
            return new InvoiceResponse(
                    inv.getId(), inv.getSupplierId(), inv.getOrderId(),
                    inv.getNumber(), inv.getCurrency(), inv.getTotal(),
                    inv.getIssuedAt(), inv.getPaidAt(), clientName, clientEmail
            );
        }
    }
}
