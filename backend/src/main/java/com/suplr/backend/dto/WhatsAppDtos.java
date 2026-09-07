package com.suplr.backend.dto;

import com.suplr.backend.entity.WhatsAppConnection;
import jakarta.validation.constraints.NotBlank;

public class WhatsAppDtos {

    public record WhatsAppConnectionRequest(
            @NotBlank String bspEndpoint,
            @NotBlank String bspApiKey,
            @NotBlank String phoneNumber
    ) {
    }

    public record WhatsAppConnectionResponse(
            String bspEndpoint,
            String phoneNumber
    ) {
        public static WhatsAppConnectionResponse from(WhatsAppConnection c) {
            return new WhatsAppConnectionResponse(c.getBspEndpoint(), c.getPhoneNumber());
        }
    }
}
