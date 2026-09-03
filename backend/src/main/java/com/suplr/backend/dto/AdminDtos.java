package com.suplr.backend.dto;

import com.suplr.backend.entity.Supplier;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

public class AdminDtos {

    public record CreateSupplierRequest(
            @NotBlank String name,
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8) String password
    ) {
    }

    public record PlanRequest(@NotBlank String plan) {
    }

    public record BroadcastRequest(
            @NotBlank String subject,
            @NotBlank String message
    ) {
    }

    public record SupplierWithStatsResponse(
            Integer id, String name, String email, String plan,
            String logo, String address, String phone,
            boolean isAdmin, boolean suspended, boolean mustChangePassword,
            OffsetDateTime createdAt, OffsetDateTime lastLoginAt,
            int orderCount, int invoiceCount, int clientCount, boolean isActive
    ) {
        public static SupplierWithStatsResponse from(
                Supplier s, int orders, int invoices, int clients, boolean active
        ) {
            return new SupplierWithStatsResponse(
                    s.getId(), s.getName(), s.getEmail(), s.getPlan(),
                    s.getLogo(), s.getAddress(), s.getPhone(),
                    s.isAdmin(), s.isSuspended(), s.isMustChangePassword(),
                    s.getCreatedAt(), s.getLastLoginAt(),
                    orders, invoices, clients, active
            );
        }
    }

    public record ImpersonateResponse(String accessToken) {
    }

    public record AdminOrderRow(
            Integer id, String status, OffsetDateTime createdAt,
            String supplierName, String clientName
    ) {
    }
}
