package com.suplr.backend.controller;

import com.suplr.backend.config.Constants;
import com.suplr.backend.dto.InvoiceDtos.InvoiceRequest;
import com.suplr.backend.dto.InvoiceDtos.InvoiceResponse;
import com.suplr.backend.entity.Client;
import com.suplr.backend.entity.Invoice;
import com.suplr.backend.entity.Order;
import com.suplr.backend.entity.Supplier;
import com.suplr.backend.repository.OrderRepository;
import com.suplr.backend.service.EmailService;
import com.suplr.backend.service.InvoiceService;
import com.suplr.backend.service.PdfService;
import com.suplr.backend.service.StorageService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/invoices")
@RequiredArgsConstructor
public class InvoiceController {

    private final InvoiceService invoiceService;
    private final PdfService pdfService;
    private final EmailService emailService;
    private final OrderRepository orderRepository;
    private final StorageService storageService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public InvoiceResponse create(
            @AuthenticationPrincipal Supplier supplier,
            @Valid @RequestBody InvoiceRequest req
    ) {
        Invoice invoice = invoiceService.createInvoice(req.orderId(), supplier.getId());

        orderRepository.findByIdAndSupplierId(req.orderId(), supplier.getId())
                .ifPresent(order -> {
                    if (order.getClient() == null) return;
                    try {
                        byte[] pdfBytes = pdfService.renderInvoicePdf(invoice, order, supplier);

                        try {
                            storageService.upload(
                                    "invoices/" + invoice.getId() + ".pdf", pdfBytes, "application/pdf");
                        } catch (Exception e) {
                            log.warn("R2 PDF upload skipped: {}", e.getMessage());
                        }

                        String clientEmail = order.getClient().getEmail();
                        if (clientEmail != null && emailService.isConfigured()) {
                            emailService.sendInvoiceEmail(invoice, order, supplier, clientEmail, pdfBytes);
                        }
                    } catch (Exception e) {
                        log.warn("Post-invoice actions failed for invoice {}: {}", invoice.getNumber(), e.getMessage());
                    }
                });

        return InvoiceResponse.from(invoice);
    }

    @GetMapping
    public List<InvoiceResponse> list(@AuthenticationPrincipal Supplier supplier) {
        return invoiceService.listWithClient(supplier.getId()).stream()
                .map(row -> {
                    Invoice inv = (Invoice) row[0];
                    String clientName = (String) row[1];
                    String clientEmail = (String) row[2];
                    return InvoiceResponse.from(inv, clientName, clientEmail);
                })
                .toList();
    }

    @GetMapping("/export")
    public void exportCsv(
            @AuthenticationPrincipal Supplier supplier,
            HttpServletResponse response
    ) throws IOException {
        List<Object[]> rows = invoiceService.listWithOrderAndClient(supplier.getId());

        String stamp = java.time.LocalDate.now().toString().replace("-", "");
        response.setContentType("text/csv; charset=UTF-8");
        response.setHeader("Content-Disposition",
                "attachment; filename=\"invoices-" + stamp + ".csv\"");

        PrintWriter writer = response.getWriter();
        writer.println("Invoice Number,Order ID,Client,Issued Date,Paid Date,Currency,Total,Status");

        for (Object[] row : rows) {
            Invoice inv = (Invoice) row[0];
            Order order = (Order) row[1];
            Client client = (Client) row[2];

            String paidDate = inv.getPaidAt() != null
                    ? inv.getPaidAt().format(Constants.CSV_DATE) : "";
            String status = inv.getPaidAt() != null ? "Paid" : "Outstanding";

            writer.printf("%s,%d,%s,%s,%s,%s,%s,%s%n",
                    inv.getNumber(), order.getId(),
                    csvEsc(client.getName()),
                    inv.getIssuedAt().format(Constants.CSV_DATE),
                    paidDate,
                    inv.getCurrency(), inv.getTotal().toPlainString(),
                    status);
        }
        writer.flush();
    }

    @PatchMapping("/{invoiceId}/mark-paid")
    public InvoiceResponse markPaid(
            @AuthenticationPrincipal Supplier supplier,
            @PathVariable Integer invoiceId
    ) {
        return InvoiceResponse.from(invoiceService.markPaid(invoiceId, supplier.getId()));
    }

    @PostMapping("/{invoiceId}/send-email")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void sendEmail(
            @AuthenticationPrincipal Supplier supplier,
            @PathVariable Integer invoiceId
    ) {
        Invoice invoice = invoiceService.getOwned(invoiceId, supplier.getId());

        Order order = orderRepository.findByIdAndSupplierId(invoice.getOrderId(), supplier.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));

        if (order.getClient() == null || order.getClient().getEmail() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Client has no email address");
        }

        byte[] pdfBytes = pdfService.renderInvoicePdf(invoice, order, supplier);
        emailService.sendInvoiceEmail(invoice, order, supplier, order.getClient().getEmail(), pdfBytes);
    }

    @GetMapping("/{invoiceId}/pdf")
    public void getPdf(
            @AuthenticationPrincipal Supplier supplier,
            @PathVariable Integer invoiceId,
            HttpServletResponse response
    ) throws IOException {
        Invoice invoice = invoiceService.getOwned(invoiceId, supplier.getId());

        String r2Key = "invoices/" + invoiceId + ".pdf";
        if (storageService.exists(r2Key)) {
            response.sendRedirect(storageService.publicUrl(r2Key));
            return;
        }

        Order order = orderRepository.findByIdAndSupplierId(invoice.getOrderId(), supplier.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));

        byte[] pdfBytes = pdfService.renderInvoicePdf(invoice, order, supplier);

        response.setContentType("application/pdf");
        response.setHeader("Content-Disposition",
                "inline; filename=\"" + invoice.getNumber() + ".pdf\"");
        response.getOutputStream().write(pdfBytes);
    }

    private static String csvEsc(String s) {
        if (s == null) return "";
        if (s.contains(",") || s.contains("\"") || s.contains("\n"))
            return "\"" + s.replace("\"", "\"\"") + "\"";
        return s;
    }
}
