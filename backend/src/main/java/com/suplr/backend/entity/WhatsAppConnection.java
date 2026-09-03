package com.suplr.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "whatsapp_connections")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WhatsAppConnection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "supplier_id", nullable = false, unique = true)
    private Integer supplierId;

    @Column(name = "phone_number", length = 20, nullable = false)
    private String phoneNumber;

    @Column(name = "bsp_api_key", length = 500, nullable = false)
    private String bspApiKey;

    @Column(name = "bsp_endpoint", length = 500, nullable = false)
    private String bspEndpoint;

    @Column(name = "connected_at", nullable = false, updatable = false)
    private OffsetDateTime connectedAt;

    @PrePersist
    private void prePersist() {
        if (connectedAt == null) connectedAt = OffsetDateTime.now();
    }
}
