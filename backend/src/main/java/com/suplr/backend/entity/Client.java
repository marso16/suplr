package com.suplr.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(
        name = "clients",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_client_supplier_number",
                columnNames = {"supplier_id", "whatsapp_number"}
        )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Client {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "supplier_id", nullable = false)
    private Integer supplierId;

    @Column(length = 200, nullable = false)
    private String name;

    @Column(name = "whatsapp_number", length = 50, nullable = false)
    private String whatsappNumber;

    @Column(name = "credit_terms", length = 100)
    private String creditTerms;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(name = "credit_balance", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal creditBalance = BigDecimal.ZERO;

    @Column(name = "preferred_language", length = 5, nullable = false)
    @Builder.Default
    private String preferredLanguage = "en";

    @Column(name = "name_confirmed", nullable = false)
    @Builder.Default
    private boolean nameConfirmed = false;

    @Column(length = 254)
    private String email;
}
