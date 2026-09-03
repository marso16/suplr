package com.suplr.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.suplr.backend.entity.Product;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiParserService {

    @Value("${app.groq.api-key:}")
    private String groqApiKey;

    private final ObjectMapper objectMapper;

    public record ParsedItem(
            String productNameRaw,
            BigDecimal quantity,
            String unit,
            Integer productId,
            String notes
    ) {
    }

    public record ParsedOrder(
            boolean isOrder,
            String confidence,   // "high" | "medium" | "low"
            String currency,     // "USD" | "LBP"
            String language,     // "en" | "fr" | "ar"
            List<ParsedItem> items
    ) {
        public static ParsedOrder empty() {
            return new ParsedOrder(false, "low", "USD", "en", List.of());
        }
    }

    public ParsedOrder parseOrderMessage(String text, List<Product> products) {
        if (groqApiKey == null || groqApiKey.isBlank()) {
            log.warn("Groq API key not configured — skipping AI parse");
            return ParsedOrder.empty();
        }

        try {
            String systemPrompt = buildSystemPrompt(products);
            String userPrompt = "Client message: " + text;

            Map<String, Object> body = Map.of(
                    "model", "openai/gpt-oss-20b",
                    "temperature", 0,
                    "max_tokens", 500,
                    "response_format", Map.of("type", "json_object"),
                    "messages", List.of(
                            Map.of("role", "system", "content", systemPrompt),
                            Map.of("role", "user", "content", userPrompt)
                    )
            );

            String raw = WebClient.builder()
                    .baseUrl("https://api.groq.com")
                    .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + groqApiKey)
                    .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .build()
                    .post().uri("/openai/v1/chat/completions")
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(15))
                    .block();

            JsonNode root = objectMapper.readTree(raw);
            String content = root.path("choices").get(0)
                    .path("message").path("content").asText();
            JsonNode data = objectMapper.readTree(content);

            List<ParsedItem> items = new ArrayList<>();
            for (JsonNode item : data.path("items")) {
                items.add(new ParsedItem(
                        item.path("product_name_raw").asText(),
                        new BigDecimal(item.path("quantity").asText("0")),
                        item.path("unit").asText("unit"),
                        item.has("product_id") && !item.path("product_id").isNull()
                                ? item.path("product_id").asInt() : null,
                        item.has("notes") && !item.path("notes").isNull()
                                ? item.path("notes").asText() : null
                ));
            }

            return new ParsedOrder(
                    data.path("is_order").asBoolean(false),
                    data.path("confidence").asText("low"),
                    data.path("currency").asText("USD"),
                    data.path("language").asText("en"),
                    items
            );

        } catch (Exception e) {
            log.warn("AI parse failed: {}", e.getMessage());
            return ParsedOrder.empty();
        }
    }

    private String buildSystemPrompt(List<Product> products) {
        StringBuilder catalog = new StringBuilder();
        for (Product p : products) {
            catalog.append(String.format("- ID:%d | %s | SKU:%s | unit:%s",
                    p.getId(), p.getName(), p.getSku(), p.getUnit()));
            if (p.getPriceUsd() != null) catalog.append(" | price_usd:").append(p.getPriceUsd());
            if (p.getPriceLbp() != null) catalog.append(" | price_lbp:").append(p.getPriceLbp());
            catalog.append("\n");
        }
        if (catalog.isEmpty()) catalog.append("(empty catalog — use product_id: null)");

        return """
                You are an order extraction assistant for a B2B supplier. Extract structured order data from client WhatsApp messages.
                
                SUPPLIER PRODUCT CATALOG:
                %s
                Rules:
                - If the message is an order, set is_order to true
                - Match product_name_raw to catalog items when possible; set product_id to the matching ID or null
                - quantity must be a number
                - Detect the currency the client wants:
                  - Set currency to "LBP" if the message contains: lira, lbp, ل.ل, ليرة, or large numbers typical for LBP
                  - Set currency to "USD" for: dollar, usd, $, or by default
                - If unsure whether this is an order, set confidence to "low"
                - Detect the language of the client message:
                  - Set language to "ar" for Arabic
                  - Set language to "fr" for French
                  - Set language to "en" for English or anything else
                - Respond ONLY with valid JSON matching this exact schema:
                
                {
                  "is_order": boolean,
                  "confidence": "high" | "medium" | "low",
                  "currency": "USD" | "LBP",
                  "language": "en" | "fr" | "ar",
                  "items": [
                    {
                      "product_name_raw": "string",
                      "product_id": integer | null,
                      "quantity": number,
                      "unit": "string",
                      "notes": "string | null"
                    }
                  ]
                }""".formatted(catalog.toString());
    }
}