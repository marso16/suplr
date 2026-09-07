package com.suplr.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "api_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApiLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(length = 10, nullable = false)
    private String method;

    @Column(nullable = false, columnDefinition = "text")
    private String path;

    @Column(name = "query_string", columnDefinition = "text")
    private String queryString;

    @Column(name = "request_body", columnDefinition = "text")
    private String requestBody;

    @Column(name = "client_ip", length = 45, nullable = false)
    private String clientIp;

    @Column(name = "user_agent", columnDefinition = "text")
    private String userAgent;

    @Column(name = "supplier_id")
    private Long supplierId;

    @Column(name = "supplier_name", length = 200)
    private String supplierName;

    @Column(name = "status_code", nullable = false)
    private short statusCode;

    @Column(name = "response_body", columnDefinition = "text")
    private String responseBody;

    @Column(name = "duration_ms", nullable = false)
    private int durationMs;

    // is_error is a generated column — read-only, never set by JPA
    @Column(name = "is_error", insertable = false, updatable = false)
    private Boolean isError;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    @Column(length = 200)
    private String controller;
}
