package com.suplr.backend.controller;

import com.suplr.backend.dto.WhatsAppDtos.WhatsAppConnectionRequest;
import com.suplr.backend.dto.WhatsAppDtos.WhatsAppConnectionResponse;
import com.suplr.backend.entity.Supplier;
import com.suplr.backend.entity.WhatsAppConnection;
import com.suplr.backend.repository.WhatsAppConnectionRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/auth/whatsapp-connection")
@RequiredArgsConstructor
public class WhatsAppConnectionController {

    private final WhatsAppConnectionRepository connectionRepository;

    @PutMapping
    public WhatsAppConnectionResponse upsert(
            @AuthenticationPrincipal Supplier supplier,
            @Valid @RequestBody WhatsAppConnectionRequest req
    ) {
        WhatsAppConnection conn = connectionRepository
                .findBySupplierId(supplier.getId())
                .orElseGet(() -> WhatsAppConnection.builder()
                        .supplierId(supplier.getId())
                        .build());

        conn.setBspEndpoint(req.bspEndpoint());
        conn.setBspApiKey(req.bspApiKey());
        conn.setPhoneNumber(req.phoneNumber());

        conn = connectionRepository.save(conn);
        return WhatsAppConnectionResponse.from(conn);
    }

    @GetMapping
    public ResponseEntity<WhatsAppConnectionResponse> get(
            @AuthenticationPrincipal Supplier supplier
    ) {
        Optional<WhatsAppConnection> conn = connectionRepository
                .findBySupplierId(supplier.getId());

        return conn.map(c -> ResponseEntity.ok(WhatsAppConnectionResponse.from(c)))
                .orElse(ResponseEntity.noContent().build());
    }
}
