package com.suplr.backend.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class WhatsAppSenderService {

    private WebClient client(String bspEndpoint, String bspApiKey) {
        return WebClient.builder()
                .baseUrl(bspEndpoint.replaceAll("/+$", ""))
                .defaultHeader("Content-Type", "application/json")
                .defaultHeader("Authorization", "Bearer " + bspApiKey)
                .build();
    }

    public void sendMessage(String bspEndpoint, String bspApiKey, String to, String text) {
        sendMessage(bspEndpoint, bspApiKey, to, text, null);
    }

    public void sendMessage(String bspEndpoint, String bspApiKey,
                            String to, String text, String mediaUrl) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("to", to);
        payload.put("message", text);
        if (mediaUrl != null) payload.put("mediaUrl", mediaUrl);

        try {
            client(bspEndpoint, bspApiKey)
                    .post().uri("/send")
                    .bodyValue(payload)
                    .retrieve()
                    .toBodilessEntity()
                    .timeout(Duration.ofSeconds(10))
                    .block();
        } catch (WebClientResponseException e) {
            log.error("BSP send failed to {}: {} {}", to, e.getStatusCode(), e.getResponseBodyAsString());
            throw new RuntimeException("BSP send failed: " + e.getMessage(), e);
        } catch (Exception e) {
            log.error("BSP send error to {}: {}", to, e.getMessage());
            throw new RuntimeException("BSP send error: " + e.getMessage(), e);
        }
    }

    public void sendDocument(String bspEndpoint, String bspApiKey,
                             String to, byte[] pdfBytes, String filename) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("to", to);
        payload.put("filename", filename);
        payload.put("base64", Base64.getEncoder().encodeToString(pdfBytes));

        try {
            client(bspEndpoint, bspApiKey)
                    .post().uri("/send-document")
                    .bodyValue(payload)
                    .retrieve()
                    .toBodilessEntity()
                    .timeout(Duration.ofSeconds(30))
                    .block();
        } catch (Exception e) {
            log.error("BSP send-document failed to {}: {}", to, e.getMessage());
            throw new RuntimeException("BSP send-document failed: " + e.getMessage(), e);
        }
    }

    public String enqueueBroadcast(String bspEndpoint, String bspApiKey,
                                   List<String> numbers, String message,
                                   OffsetDateTime scheduledAt, String mediaUrl) {
        long delayMs = 0;
        if (scheduledAt != null) {
            long seconds = Duration.between(OffsetDateTime.now(), scheduledAt).toSeconds();
            delayMs = Math.max(0, seconds * 1000);
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("numbers", numbers);
        payload.put("message", message);
        payload.put("delayMs", delayMs);
        if (mediaUrl != null) payload.put("mediaUrl", mediaUrl);

        try {
            Map<?, ?> response = client(bspEndpoint, bspApiKey)
                    .post().uri("/queue/broadcast")
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .timeout(Duration.ofSeconds(10))
                    .block();
            return (response != null && response.get("jobId") != null)
                    ? response.get("jobId").toString()
                    : "";
        } catch (Exception e) {
            log.error("BSP enqueue-broadcast failed: {}", e.getMessage());
            throw new RuntimeException("BSP enqueue-broadcast failed: " + e.getMessage(), e);
        }
    }

    public String enqueueReminder(String bspEndpoint, String bspApiKey,
                                  String number, String message,
                                  OffsetDateTime fireAt, String jobId) {
        long seconds = Duration.between(OffsetDateTime.now(), fireAt).toSeconds();
        long delayMs = Math.max(0, seconds * 1000);

        Map<String, Object> payload = new HashMap<>();
        payload.put("number", number);
        payload.put("message", message);
        payload.put("delayMs", delayMs);
        if (jobId != null) payload.put("jobId", jobId);

        try {
            Map<?, ?> response = client(bspEndpoint, bspApiKey)
                    .post().uri("/queue/reminder")
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .timeout(Duration.ofSeconds(10))
                    .block();
            return (response != null && response.get("jobId") != null)
                    ? response.get("jobId").toString()
                    : "";
        } catch (Exception e) {
            log.error("BSP enqueue-reminder failed: {}", e.getMessage());
            throw new RuntimeException("BSP enqueue-reminder failed: " + e.getMessage(), e);
        }
    }
}