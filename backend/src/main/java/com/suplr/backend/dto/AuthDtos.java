package com.suplr.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.suplr.backend.entity.Supplier;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

public class AuthDtos {

    public record TokenResponse(
            @JsonProperty("access_token") String accessToken,
            @JsonProperty("token_type") String tokenType
    ) {
        public TokenResponse(String accessToken) {
            this(accessToken, "bearer");
        }
    }

    public record SupplierResponse(
            Integer id,
            String name,
            String email,
            String plan,
            String logo,
            String address,
            String phone,
            boolean isAdmin,
            boolean suspended,
            boolean mustChangePassword,
            OffsetDateTime createdAt,
            OffsetDateTime lastLoginAt
    ) {
        public static SupplierResponse from(Supplier s) {
            return new SupplierResponse(
                    s.getId(), s.getName(), s.getEmail(), s.getPlan(),
                    s.getLogo(), s.getAddress(), s.getPhone(),
                    s.isAdmin(), s.isSuspended(), s.isMustChangePassword(),
                    s.getCreatedAt(), s.getLastLoginAt()
            );
        }
    }

    public record ProfileRequest(
            String name,
            String address,
            String phone,
            String logo
    ) {
    }

    public record ChangePasswordRequest(
            @NotBlank String currentPassword,
            @NotBlank @Size(min = 8, message = "Password must be at least 8 characters")
            String newPassword
    ) {
    }
}
