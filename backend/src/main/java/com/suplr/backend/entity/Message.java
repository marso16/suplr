package com.suplr.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "supplier_id", nullable = false)
    private Integer supplierId;

    @Column(name = "client_id")
    private Integer clientId;

    @Column(name = "whatsapp_message_id", length = 200, unique = true)
    private String whatsappMessageId;

    @Column(length = 10, nullable = false)
    private String direction;

    @Column(columnDefinition = "text", nullable = false)
    private String body;

    @Column(name = "received_at", nullable = false, updatable = false)
    private OffsetDateTime receivedAt;

    @Column(name = "order_id")
    private Integer orderId;

    @PrePersist
    private void prePersist() {
        if (receivedAt == null) receivedAt = OffsetDateTime.now();
    }
}