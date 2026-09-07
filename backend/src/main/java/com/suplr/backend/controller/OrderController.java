package com.suplr.backend.controller;

import com.suplr.backend.config.Constants;
import com.suplr.backend.dto.OrderDtos.DeliveryDateRequest;
import com.suplr.backend.dto.OrderDtos.NotesRequest;
import com.suplr.backend.dto.OrderDtos.OrderRequest;
import com.suplr.backend.dto.OrderDtos.OrderResponse;
import com.suplr.backend.entity.Order;
import com.suplr.backend.entity.Supplier;
import com.suplr.backend.service.OrderService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

@RestController
@RequestMapping("/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse create(
            @AuthenticationPrincipal Supplier supplier,
            @Valid @RequestBody OrderRequest req
    ) {
        return OrderResponse.from(orderService.createOrder(supplier.getId(), req));
    }

    @GetMapping
    public List<OrderResponse> list(@AuthenticationPrincipal Supplier supplier) {
        return orderService.listForSupplier(supplier.getId()).stream()
                .map(OrderResponse::from)
                .toList();
    }

    @GetMapping("/export")
    public void exportCsv(
            @AuthenticationPrincipal Supplier supplier,
            HttpServletResponse response
    ) throws IOException {
        List<Order> orders = orderService.listForSupplier(supplier.getId());

        String stamp = java.time.LocalDate.now().toString().replace("-", "");
        response.setContentType("text/csv; charset=UTF-8");
        response.setHeader("Content-Disposition",
                "attachment; filename=\"orders-" + stamp + ".csv\"");

        PrintWriter writer = response.getWriter();
        writer.println("Order ID,Date,Client,Status,Currency,Product,Qty,Unit," +
                "Unit Price,Line Total,Order Total,Delivery Date,Notes");

        for (Order order : orders) {
            String date = order.getCreatedAt().format(Constants.CSV_DATE_FMT);
            String clientName = order.getClient() != null ? order.getClient().getName() : "";
            String deliveryDate = order.getDeliveryDate() != null
                    ? order.getDeliveryDate().toString() : "";
            String notes = order.getNotes() != null ? order.getNotes() : "";

            for (var item : order.getItems()) {
                String lineTotal = item.getPrice()
                        .multiply(item.getQuantity())
                        .setScale(2, java.math.RoundingMode.HALF_UP)
                        .toPlainString();
                writer.printf("%d,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s%n",
                        order.getId(), date, csvEsc(clientName),
                        order.getStatus(), order.getCurrency(),
                        csvEsc(item.getProductName()),
                        item.getQuantity().stripTrailingZeros().toPlainString(),
                        item.getUnit(), item.getPrice().toPlainString(),
                        lineTotal, order.getTotal().toPlainString(),
                        deliveryDate, csvEsc(notes));
            }
        }
        writer.flush();
    }

    @GetMapping("/{orderId}")
    public OrderResponse getOne(
            @AuthenticationPrincipal Supplier supplier,
            @PathVariable Integer orderId
    ) {
        return OrderResponse.from(orderService.getOrder(orderId, supplier.getId()));
    }

    @PatchMapping("/{orderId}/confirm")
    public OrderResponse confirm(
            @AuthenticationPrincipal Supplier supplier,
            @PathVariable Integer orderId
    ) {
        return OrderResponse.from(orderService.confirmOrder(orderId, supplier.getId()));
    }

    @PatchMapping("/{orderId}/fulfill")
    public OrderResponse fulfill(
            @AuthenticationPrincipal Supplier supplier,
            @PathVariable Integer orderId
    ) {
        return OrderResponse.from(orderService.fulfillOrder(orderId, supplier.getId()));
    }

    @PatchMapping("/{orderId}/delivery-date")
    public OrderResponse setDeliveryDate(
            @AuthenticationPrincipal Supplier supplier,
            @PathVariable Integer orderId,
            @RequestBody DeliveryDateRequest req
    ) {
        return OrderResponse.from(
                orderService.setDeliveryDate(orderId, supplier.getId(), req.deliveryDate()));
    }

    @PatchMapping("/{orderId}/notes")
    public OrderResponse setNotes(
            @AuthenticationPrincipal Supplier supplier,
            @PathVariable Integer orderId,
            @RequestBody NotesRequest req
    ) {
        return OrderResponse.from(
                orderService.setNotes(orderId, supplier.getId(), req.notes()));
    }

    private static String csvEsc(String s) {
        if (s == null) return "";
        if (s.contains(",") || s.contains("\"") || s.contains("\n")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }
}
