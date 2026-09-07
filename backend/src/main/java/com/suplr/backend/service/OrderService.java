package com.suplr.backend.service;

import com.suplr.backend.dto.OrderDtos.OrderRequest;
import com.suplr.backend.entity.Order;
import com.suplr.backend.entity.OrderItem;
import com.suplr.backend.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderService {

    @Autowired
    @Lazy
    private WhatsAppService whatsAppService;

    private final OrderRepository orderRepository;
    private final SseService sseService;

    @Transactional
    public Order createOrder(Integer supplierId, OrderRequest req) {
        String currency = req.currency() != null ? req.currency() : "USD";

        BigDecimal total = req.items().stream()
                .map(i -> i.price().multiply(i.quantity()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Order order = Order.builder()
                .supplierId(supplierId)
                .clientId(req.clientId())
                .currency(currency)
                .total(total)
                .build();

        List<OrderItem> items = req.items().stream().map(i -> OrderItem.builder()
                .order(order)
                .productNameRaw(i.productNameRaw())
                .productId(i.productId())
                .quantity(i.quantity())
                .unit(i.unit())
                .price(i.price())
                .notes(i.notes())
                .build()
        ).toList();

        order.setItems(items);

        Order saved = orderRepository.save(order);
        sseService.publishOrderEvent(supplierId, "order_created", saved.getId());
        return saved;
    }

    public List<Order> listForSupplier(Integer supplierId) {
        return orderRepository.findBySupplierIdOrderByCreatedAtDesc(supplierId);
    }

    public Order getOrder(Integer orderId, Integer supplierId) {
        return orderRepository.findByIdAndSupplierId(orderId, supplierId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
    }

    @Transactional
    public Order confirmOrder(Integer orderId, Integer supplierId) {
        Order order = getOrder(orderId, supplierId);
        order.setStatus("confirmed");
        order.setConfirmedAt(OffsetDateTime.now());

        Order saved = orderRepository.save(order);
        sseService.publishOrderEvent(supplierId, "order_updated", saved.getId());

        if (saved.getClient() != null) {
            String lang = saved.getClient().getPreferredLanguage() != null
                    ? saved.getClient().getPreferredLanguage() : "en";
            whatsAppService.sendOrderConfirmation(
                    supplierId,
                    saved.getClient().getWhatsappNumber(),
                    saved.getId(),
                    lang
            );
        }

        return saved;
    }

    @Transactional
    public Order fulfillOrder(Integer orderId, Integer supplierId) {
        Order order = getOrder(orderId, supplierId);
        order.setStatus("fulfilled");

        Order saved = orderRepository.save(order);
        sseService.publishOrderEvent(supplierId, "order_updated", saved.getId());
        return saved;
    }

    @Transactional
    public Order setDeliveryDate(Integer orderId, Integer supplierId, LocalDate deliveryDate) {
        Order order = getOrder(orderId, supplierId);
        order.setDeliveryDate(deliveryDate);
        return orderRepository.save(order);
    }

    @Transactional
    public Order setNotes(Integer orderId, Integer supplierId, String notes) {
        Order order = getOrder(orderId, supplierId);
        order.setNotes(notes == null || notes.isBlank() ? null : notes);
        return orderRepository.save(order);
    }
}