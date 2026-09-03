package com.suplr.backend.controller;

import com.suplr.backend.entity.Message;
import com.suplr.backend.repository.ClientRepository;
import com.suplr.backend.repository.SupplierRepository;
import com.suplr.backend.service.CacheService;
import com.suplr.backend.service.WhatsAppService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/webhook")
@RequiredArgsConstructor
public class WhatsAppWebhookController {

    private final WhatsAppService whatsAppService;
    private final CacheService cacheService;
    private final SupplierRepository supplierRepository;
    private final ClientRepository clientRepository;

    @Value("${app.webhook.verify-token:}")
    private String webhookVerifyToken;

    @GetMapping("/{supplierId}")
    public ResponseEntity<String> verify(
            @PathVariable Integer supplierId,
            @RequestParam(value = "hub.mode", defaultValue = "") String mode,
            @RequestParam(value = "hub.verify_token", defaultValue = "") String token,
            @RequestParam(value = "hub.challenge", defaultValue = "") String challenge
    ) {
        if ("subscribe".equals(mode) && webhookVerifyToken.equals(token)) {
            log.info("Webhook verified for supplier {}", supplierId);
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(challenge);
        }
        log.warn("Webhook verification failed for supplier {} — bad token", supplierId);
        return ResponseEntity.status(403).body("Verification failed");
    }

    @PostMapping("/{supplierId}")
    public Map<String, String> receive(
            @PathVariable Integer supplierId,
            @RequestBody(required = false) Map<String, Object> jsonBody,
            HttpServletRequest request
    ) {
        String contentType = request.getContentType() != null
                ? request.getContentType() : "";

        if (contentType.contains("application/json") && jsonBody != null) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> messages =
                    (List<Map<String, Object>>) jsonBody.getOrDefault("messages", List.of());

            for (Map<String, Object> msg : messages) {
                if (!"text".equals(msg.get("type"))) continue;
                String msgId = (String) msg.get("id");
                String from = (String) msg.get("from");
                @SuppressWarnings("unchecked")
                String body = (String) ((Map<String, Object>) msg.get("text")).get("body");
                if (from != null && body != null) {
                    process(supplierId, msgId, from, body);
                }
            }
        } else {
            String msgId = request.getParameter("MessageSid");
            String from = request.getParameter("From");
            String body = request.getParameter("Body");
            if (from != null) from = from.replace("whatsapp:", "");
            if (from != null && body != null && !body.isBlank()) {
                process(supplierId, msgId != null ? msgId : "", from, body);
            }
        }

        return Map.of("status", "ok");
    }

    private void process(Integer supplierId, String msgId, String fromNumber, String text) {
        try {
            // Idempotency check
            if (msgId != null && !msgId.isBlank() && cacheService.isMessageSeen(supplierId, msgId)) {
                log.info("Duplicate message {} for supplier {} — skipped", msgId, supplierId);
                return;
            }
            if (msgId != null && !msgId.isBlank()) {
                cacheService.markMessageSeen(supplierId, msgId);
            }

            Message message = whatsAppService.storeInboundMessage(
                    supplierId, msgId, fromNumber, text);

            if (whatsAppService.handleNameCollection(
                    supplierId, message.getClientId(), text, fromNumber)) {
                return;
            }

            if (whatsAppService.isHistoryQuery(text)) {
                String lang = clientRepository.findById(message.getClientId())
                        .map(c -> c.getPreferredLanguage() != null ? c.getPreferredLanguage() : "en")
                        .orElse("en");
                whatsAppService.handleHistoryQuery(
                        supplierId, message.getClientId(), fromNumber, lang);
                return;
            }

            if (whatsAppService.handlePendingConfirmation(
                    supplierId, message.getClientId(), fromNumber, text)) {
                return;
            }

            supplierRepository.findById(supplierId).ifPresent(supplier -> {
                if ("pro".equals(supplier.getPlan())) {
                    whatsAppService.parseAndCreateOrder(supplierId, message, fromNumber);
                }
            });

        } catch (Exception e) {
            log.error("Error processing message from {} for supplier {}: {}",
                    fromNumber, supplierId, e.getMessage(), e);
        }
    }
}