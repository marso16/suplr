package com.suplr.backend.controller;

import com.suplr.backend.config.Constants;
import com.suplr.backend.dto.BroadcastDtos.BroadcastRequest;
import com.suplr.backend.dto.BroadcastDtos.BroadcastResponse;
import com.suplr.backend.entity.Client;
import com.suplr.backend.entity.Supplier;
import com.suplr.backend.repository.ClientRepository;
import com.suplr.backend.repository.WhatsAppConnectionRepository;
import com.suplr.backend.service.StorageService;
import com.suplr.backend.service.WhatsAppSenderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@Slf4j
@RestController
@RequestMapping("/broadcast")
@RequiredArgsConstructor
public class BroadcastController {

    private final WhatsAppConnectionRepository connectionRepository;
    private final ClientRepository clientRepository;
    private final WhatsAppSenderService senderService;
    private final StorageService storageService;

    @PostMapping
    public BroadcastResponse sendBroadcast(
            @AuthenticationPrincipal Supplier supplier,
            @Valid @RequestBody BroadcastRequest req
    ) {
        var conn = connectionRepository.findBySupplierId(supplier.getId()).orElse(null);
        if (conn == null) return BroadcastResponse.empty();

        var clients = clientRepository.findBySupplierId(supplier.getId());
        if (clients.isEmpty()) return BroadcastResponse.empty();

        List<String> numbers = clients.stream()
                .map(Client::getWhatsappNumber)
                .toList();

        if (req.scheduledAt() != null) {
            String jobId = senderService.enqueueBroadcast(
                    conn.getBspEndpoint(), conn.getBspApiKey(),
                    numbers, req.message(), req.scheduledAt(), req.mediaUrl());

            log.info("Broadcast scheduled for {} — job {} (supplier {})",
                    req.scheduledAt(), jobId, supplier.getId());

            return new BroadcastResponse(0, 0, clients.size(), true, jobId);
        }

        List<CompletableFuture<Boolean>> futures = numbers.stream()
                .map(number -> CompletableFuture.supplyAsync(() -> {
                    try {
                        senderService.sendMessage(
                                conn.getBspEndpoint(), conn.getBspApiKey(),
                                number, req.message(), req.mediaUrl());
                        return true;
                    } catch (Exception e) {
                        log.error("Broadcast failed for {}: {}", number, e.getMessage());
                        return false;
                    }
                }, Constants.EXECUTOR))
                .toList();

        List<Boolean> results = futures.stream()
                .map(CompletableFuture::join)
                .toList();

        int sent = (int) results.stream().filter(r -> r).count();
        int failed = results.size() - sent;

        log.info("Broadcast: {}/{} sent (supplier {})", sent, clients.size(), supplier.getId());
        return new BroadcastResponse(sent, failed, clients.size(), false, null);
    }

    @PostMapping("/upload")
    public java.util.Map<String, String> uploadMedia(
            @AuthenticationPrincipal Supplier supplier,
            @RequestParam("file") MultipartFile file
    ) throws IOException {
        byte[] data = file.getBytes();
        String ext = getExtension(file.getOriginalFilename());
        String key = "broadcasts/" + supplier.getId() + "/"
                + UUID.randomUUID().toString().replace("-", "") + ext;
        String url = storageService.upload(
                key, data,
                file.getContentType() != null ? file.getContentType() : "application/octet-stream");
        return java.util.Map.of("url", url);
    }

    private static String getExtension(String filename) {
        if (filename == null || filename.isBlank()) return ".bin";
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(dot).toLowerCase() : ".bin";
    }
}