package com.suplr.backend.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.OffsetDateTime;

public class BroadcastDtos {

    public record BroadcastRequest(
            @NotBlank String message,
            OffsetDateTime scheduledAt,
            String mediaUrl
    ) {
    }

    public record BroadcastResponse(
            int sent,
            int failed,
            int total,
            boolean scheduled,
            String jobId
    ) {
        public static BroadcastResponse empty() {
            return new BroadcastResponse(0, 0, 0, false, null);
        }
    }
}