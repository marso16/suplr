package com.suplr.backend.service;

import com.suplr.backend.config.Constants;
import com.suplr.backend.entity.Invoice;
import com.suplr.backend.entity.Order;
import com.suplr.backend.repository.ClientRepository;
import com.suplr.backend.repository.InvoiceRepository;
import com.suplr.backend.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class InvoiceService {


    private final InvoiceRepository invoiceRepository;
    private final OrderRepository orderRepository;
    private final ClientRepository clientRepository;

    @Transactional
    public Invoice createInvoice(Integer orderId, Integer supplierId) {
        Order order = orderRepository.findByIdAndSupplierId(orderId, supplierId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));

        if (!Constants.INVOICEABLE_STATUSES.contains(order.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Order must be confirmed before invoicing");
        }

        if (invoiceRepository.findByOrderId(orderId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invoice already exists for this order");
        }

        long count = invoiceRepository.countBySupplierId(supplierId) + 1;
        OffsetDateTime now = OffsetDateTime.now();
        String number = String.format("INV-%d-%02d%02d-%04d",
                now.getYear(), now.getMonthValue(), now.getDayOfMonth(), count);

        Invoice invoice = Invoice.builder()
                .supplierId(supplierId)
                .orderId(orderId)
                .number(number)
                .currency(order.getCurrency())
                .total(order.getTotal())
                .build();

        invoiceRepository.save(invoice);

        order.setStatus("invoiced");
        orderRepository.save(order);

        clientRepository.findByIdAndSupplierId(order.getClientId(), supplierId)
                .ifPresent(client -> {
                    BigDecimal current = client.getCreditBalance() != null
                            ? client.getCreditBalance() : BigDecimal.ZERO;
                    client.setCreditBalance(current.add(invoice.getTotal()));
                    clientRepository.save(client);
                });

        log.info("Created invoice {} for order {}", number, orderId);
        return invoice;
    }

    @Transactional
    public Invoice markPaid(Integer invoiceId, Integer supplierId) {
        Invoice invoice = invoiceRepository.findByIdAndSupplierId(invoiceId, supplierId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found"));

        if (invoice.getPaidAt() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invoice already paid");
        }

        invoice.setPaidAt(OffsetDateTime.now());
        invoiceRepository.save(invoice);

        orderRepository.findById(invoice.getOrderId()).flatMap(
                order -> clientRepository.findByIdAndSupplierId(order.getClientId(), supplierId)).ifPresent(
                client -> {
                    BigDecimal current = client.getCreditBalance() != null
                            ? client.getCreditBalance() : BigDecimal.ZERO;
                    BigDecimal reduced = current.subtract(invoice.getTotal())
                            .max(BigDecimal.ZERO);
                    client.setCreditBalance(reduced);
                    clientRepository.save(client);
                });

        return invoice;
    }

    public List<Object[]> listWithClient(Integer supplierId) {
        return invoiceRepository.findWithClientBySupplierId(supplierId);
    }

    public List<Object[]> listWithOrderAndClient(Integer supplierId) {
        return invoiceRepository.findWithOrderAndClientBySupplierId(supplierId);
    }

    public Invoice getOwned(Integer invoiceId, Integer supplierId) {
        return invoiceRepository.findByIdAndSupplierId(invoiceId, supplierId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found"));
    }
}
