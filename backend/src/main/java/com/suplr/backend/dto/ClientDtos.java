package com.suplr.backend.dto;

import com.suplr.backend.entity.Client;
import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;

public class ClientDtos {

    public record ClientRequest(
            @NotBlank String name,
            @NotBlank String whatsappNumber,
            String creditTerms,
            String notes,
            String email
    ) {
    }

    public record ClientResponse(
            Integer id,
            Integer supplierId,
            String name,
            String whatsappNumber,
            String creditTerms,
            String notes,
            BigDecimal creditBalance,
            String email
    ) {
        public static ClientResponse from(Client c) {
            return new ClientResponse(
                    c.getId(), c.getSupplierId(), c.getName(),
                    c.getWhatsappNumber(), c.getCreditTerms(),
                    c.getNotes(), c.getCreditBalance(), c.getEmail()
            );
        }
    }
}
