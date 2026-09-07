package com.suplr.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.suplr.backend.config.Constants;
import com.suplr.backend.dto.OrderDtos.OrderItemRequest;
import com.suplr.backend.dto.OrderDtos.OrderRequest;
import com.suplr.backend.entity.*;
import com.suplr.backend.repository.*;
import com.suplr.backend.service.AiParserService.ParsedItem;
import com.suplr.backend.service.AiParserService.ParsedOrder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class WhatsAppService {

    private final MessageRepository messageRepository;
    private final PendingOrderRepository pendingOrderRepository;
    private final ClientRepository clientRepository;
    private final OrderRepository orderRepository;
    private final WhatsAppConnectionRepository connectionRepository;
    private final ProductService productService;
    private final OrderService orderService;
    private final AiParserService aiParserService;
    private final WhatsAppSenderService senderService;
    private final CacheService cacheService;
    private final ObjectMapper objectMapper;
    private final ClientService clientService;

    private String t(String lang, String key) {
        return Constants.MSG.getOrDefault(lang, Constants.MSG.get("en")).getOrDefault(key,
                Constants.MSG.get("en").getOrDefault(key, ""));
    }

    private String t(String lang, String key, Map<String, Object> vars) {
        String tpl = t(lang, key);
        for (Map.Entry<String, Object> e : vars.entrySet())
            tpl = tpl.replace("{" + e.getKey() + "}", String.valueOf(e.getValue()));
        return tpl;
    }

    private Optional<WhatsAppConnection> getConnection(Integer supplierId) {
        return connectionRepository.findBySupplierId(supplierId);
    }

    private void send(Integer supplierId, String to, String text) {
        getConnection(supplierId).ifPresentOrElse(
                conn -> {
                    try {
                        senderService.sendMessage(conn.getBspEndpoint(), conn.getBspApiKey(), to, text);
                    } catch (Exception e) {
                        log.error("Failed to send message to {}: {}", to, e.getMessage());
                    }
                },
                () -> log.warn("No WhatsApp connection for supplier {}", supplierId)
        );
    }

    @Transactional
    public Message storeInboundMessage(Integer supplierId, String msgId,
                                       String fromNumber, String body) {
        Client client = clientService.getOrCreateByWhatsappNumber(supplierId, fromNumber);

        Message message = Message.builder()
                .supplierId(supplierId)
                .clientId(client.getId())
                .whatsappMessageId(msgId)
                .direction("inbound")
                .body(body)
                .build();

        messageRepository.save(message);
        return message;
    }

    @Transactional
    public boolean handleNameCollection(Integer supplierId, Integer clientId,
                                        String body, String fromNumber) {
        Client client = clientRepository.findById(clientId).orElse(null);
        if (client == null || client.isNameConfirmed()) return false;

        long msgCount = messageRepository.countInboundByClientId(clientId);
        String lang = client.getPreferredLanguage() != null
                ? client.getPreferredLanguage() : "en";

        if (msgCount <= 1) {
            send(supplierId, fromNumber, t(lang, "welcome"));
            return true;
        }

        if (msgCount == 2) {
            String name = body.strip().substring(0, Math.min(body.strip().length(), 200));
            client.setName(name);
            clientRepository.save(client);
            send(supplierId, fromNumber, t(lang, "ask_email", Map.of("name", name)));
            log.info("Name collected for client {}: {}", clientId, name);
            return true;
        }

        String word = body.strip().toLowerCase();
        if (!Constants.SKIP_WORDS.contains(word) && body.contains("@")) {
            client.setEmail(body.strip().substring(0, Math.min(body.strip().length(), 254)));
            clientRepository.save(client);
            send(supplierId, fromNumber, t(lang, "email_saved"));
            log.info("Email collected for client {}: {}", clientId, client.getEmail());
        } else {
            send(supplierId, fromNumber, t(lang, "email_skipped"));
        }

        client.setNameConfirmed(true);
        clientRepository.save(client);
        return true;
    }

    public boolean isHistoryQuery(String text) {
        String lower = text.toLowerCase().strip();
        return Constants.HISTORY_PHRASES.stream().anyMatch(lower::contains);
    }

    @Transactional
    public void handleHistoryQuery(Integer supplierId, Integer clientId,
                                   String fromNumber, String lang) {
        List<Order> orders = orderRepository
                .findTop5BySupplierIdAndClientIdAndStatusInOrderByCreatedAtDesc(
                        supplierId, clientId, List.of("confirmed", "fulfilled", "invoiced"));

        if (orders.isEmpty()) {
            send(supplierId, fromNumber, t(lang, "history_empty"));
            return;
        }

        StringBuilder sb = new StringBuilder(t(lang, "history_header"));
        for (Order order : orders) {
            String date = order.getCreatedAt()
                    .format(java.time.format.DateTimeFormatter.ofPattern("dd MMM yyyy"));
            sb.append("\n\n*")
                    .append(t(lang, "history_order", Map.of("id", order.getId(), "date", date)))
                    .append("*");
            for (OrderItem item : order.getItems()) {
                sb.append("\n• ")
                        .append(item.getQuantity().stripTrailingZeros().toPlainString())
                        .append(" ").append(item.getUnit())
                        .append(" ").append(item.getProductName());
            }
            sb.append("\n_").append(String.format("%.2f", order.getTotal()))
                    .append(" ").append(order.getCurrency()).append("_");
        }

        send(supplierId, fromNumber, sb.toString());
        log.info("Sent history to client {} ({} orders)", clientId, orders.size());
    }

    @Transactional
    public boolean handlePendingConfirmation(Integer supplierId, Integer clientId,
                                             String fromNumber, String text) {
        Optional<PendingOrder> maybePending =
                pendingOrderRepository.findBySupplierIdAndClientId(supplierId, clientId);
        if (maybePending.isEmpty()) return false;

        PendingOrder pending = maybePending.get();
        String word = text.strip().toLowerCase();
        String lang = clientRepository.findById(clientId)
                .map(c -> c.getPreferredLanguage() != null ? c.getPreferredLanguage() : "en")
                .orElse("en");

        if (Constants.YES_WORDS.contains(word)) {
            List<OrderItemRequest> items = deserialiseItems(pending.getItemsJson());
            OrderRequest req = new OrderRequest(clientId, pending.getCurrency(), items);
            Order order = orderService.createOrder(supplierId, req);

            pendingOrderRepository.delete(pending);
            cacheService.invalidateReportCache(supplierId);

            send(supplierId, fromNumber, t(lang, "order_received"));
            log.info("Pending order confirmed → order #{}", order.getId());
            return true;
        }

        if (Constants.NO_WORDS.contains(word)) {
            pendingOrderRepository.delete(pending);
            send(supplierId, fromNumber, t(lang, "order_cancelled"));
            log.info("Pending order cancelled for client {}", clientId);
            return true;
        }

        return false;
    }

    @Transactional
    public void parseAndCreateOrder(Integer supplierId, Message message, String fromNumber) {
        List<Product> products = productService.getActiveProducts(supplierId);
        Client client = clientRepository.findById(message.getClientId()).orElse(null);
        if (client == null) return;

        ParsedOrder parsed = aiParserService.parseOrderMessage(message.getBody(), products);

        if (!parsed.isOrder() || "low".equals(parsed.confidence())) return;

        String lang = parsed.language();
        String currency = parsed.currency();

        client.setPreferredLanguage(lang);
        clientRepository.save(client);

        Map<Integer, BigDecimal> priceMap = new java.util.HashMap<>();
        for (Product p : products) {
            BigDecimal price = "LBP".equals(currency) ? p.getPriceLbp() : p.getPriceUsd();
            if (price != null) priceMap.put(p.getId(), price);
        }

        List<ParsedItem> matched = parsed.items().stream()
                .filter(i -> i.productId() != null)
                .toList();

        if (matched.isEmpty()) {
            log.info("No catalog matches for message from {} — skipping", fromNumber);
            return;
        }

        StringBuilder summary = new StringBuilder(t(lang, "summary_header"));
        BigDecimal total = BigDecimal.ZERO;
        List<Map<String, Object>> itemsForJson = new ArrayList<>();

        for (ParsedItem item : matched) {
            BigDecimal price = priceMap.getOrDefault(item.productId(), BigDecimal.ZERO);
            BigDecimal lineTotal = price.multiply(item.quantity());
            total = total.add(lineTotal);

            summary.append("\n• ")
                    .append(item.quantity().stripTrailingZeros().toPlainString())
                    .append(" ").append(item.unit())
                    .append(" ").append(item.productNameRaw())
                    .append(" — ").append(String.format("%.2f", lineTotal))
                    .append(" ").append(currency);

            itemsForJson.add(Map.of(
                    "product_name_raw", item.productNameRaw(),
                    "product_id", item.productId(),
                    "quantity", item.quantity(),
                    "unit", item.unit(),
                    "price", price,
                    "notes", item.notes() != null ? item.notes() : ""
            ));
        }

        summary.append(t(lang, "total",
                Map.of("total", String.format("%.2f", total), "currency", currency)));
        summary.append(t(lang, "confirm_prompt"));

        pendingOrderRepository.findBySupplierIdAndClientId(supplierId, client.getId())
                .ifPresent(pendingOrderRepository::delete);

        PendingOrder pending = PendingOrder.builder()
                .supplierId(supplierId)
                .clientId(client.getId())
                .currency(currency)
                .itemsJson(serialise(itemsForJson))
                .build();
        pendingOrderRepository.save(pending);

        send(supplierId, fromNumber, summary.toString());
        log.info("Pending order created for client {}, awaiting confirmation", client.getId());
    }

    public void sendOrderConfirmation(Integer supplierId, String clientWhatsapp,
                                      Integer orderId, String lang) {
        getConnection(supplierId).ifPresent(conn -> {
            try {
                senderService.sendMessage(
                        conn.getBspEndpoint(), conn.getBspApiKey(), clientWhatsapp,
                        t(lang, "order_confirmed", Map.of("order_id", orderId)));
                log.info("Sent order confirmation for #{} to {}", orderId, clientWhatsapp);
            } catch (Exception e) {
                log.error("Failed to send order confirmation for #{}: {}", orderId, e.getMessage());
            }
        });
    }

    public void sendInvoicePdf(Integer supplierId, String clientWhatsapp,
                               byte[] pdfBytes, String invoiceNumber) {
        getConnection(supplierId).ifPresent(conn -> {
            try {
                senderService.sendDocument(
                        conn.getBspEndpoint(), conn.getBspApiKey(),
                        clientWhatsapp, pdfBytes, invoiceNumber + ".pdf");
                log.info("Sent invoice PDF {} to {}", invoiceNumber, clientWhatsapp);
            } catch (Exception e) {
                log.error("Failed to send invoice PDF {}: {}", invoiceNumber, e.getMessage());
            }
        });
    }

    private String serialise(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("JSON serialisation failed", e);
        }
    }

    private List<OrderItemRequest> deserialiseItems(String json) {
        try {
            List<Map<String, Object>> raw = objectMapper.readValue(
                    json, new TypeReference<>() {
                    });
            return raw.stream().map(m -> new OrderItemRequest(
                    (String) m.get("product_name_raw"),
                    m.get("product_id") != null ? ((Number) m.get("product_id")).intValue() : null,
                    new BigDecimal(m.get("quantity").toString()),
                    (String) m.get("unit"),
                    new BigDecimal(m.get("price").toString()),
                    m.get("notes") instanceof String s && !s.isBlank() ? s : null
            )).toList();
        } catch (Exception e) {
            log.error("Failed to deserialise pending order items: {}", e.getMessage());
            return List.of();
        }
    }
}