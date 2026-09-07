package com.suplr.backend.controller;

import com.suplr.backend.dto.AdminDtos.*;
import com.suplr.backend.dto.AuthDtos.SupplierResponse;
import com.suplr.backend.entity.Supplier;
import com.suplr.backend.repository.SupplierRepository;
import com.suplr.backend.security.JwtService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import com.suplr.backend.service.EmailService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminController {

    private final SupplierRepository supplierRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EmailService emailService;

    @PersistenceContext
    private EntityManager em;


    @PostMapping("/suppliers")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public SupplierResponse createSupplier(@Valid @RequestBody CreateSupplierRequest req) {
        if (supplierRepository.existsByEmail(req.email())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email already registered");
        }
        String rawPassword = req.password();
        Supplier supplier = Supplier.builder()
                .name(req.name())
                .email(req.email())
                .passwordHash(passwordEncoder.encode(rawPassword))
                .plan("pro")
                .mustChangePassword(true)
                .build();
        supplier = supplierRepository.save(supplier);
        emailService.sendWelcomeEmail(req.name(), req.email(), rawPassword);
        return SupplierResponse.from(supplier);
    }


    @GetMapping("/suppliers")
    public List<SupplierWithStatsResponse> listSuppliers() {
        OffsetDateTime sevenDaysAgo = OffsetDateTime.now(ZoneOffset.UTC).minusDays(7);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
                SELECT s.id,
                       COUNT(DISTINCT o.id)  AS order_count,
                       COUNT(DISTINCT i.id)  AS invoice_count,
                       COUNT(DISTINCT c.id)  AS client_count,
                       MAX(o.created_at)     AS last_order_at
                FROM suppliers s
                LEFT JOIN orders   o ON o.supplier_id = s.id
                LEFT JOIN invoices i ON i.supplier_id = s.id
                LEFT JOIN clients  c ON c.supplier_id = s.id
                GROUP BY s.id
                ORDER BY s.created_at DESC
                """).getResultList();

        return rows.stream().map(r -> {
            Integer sid = ((Number) r[0]).intValue();
            Supplier s = supplierRepository.findById(sid)
                    .orElseThrow();
            int orders = ((Number) r[1]).intValue();
            int invoices = ((Number) r[2]).intValue();
            int clients = ((Number) r[3]).intValue();
            boolean active = r[4] != null &&
                    toODT(r[4]).isAfter(sevenDaysAgo);
            return SupplierWithStatsResponse.from(s, orders, invoices, clients, active);
        }).toList();
    }


    @PatchMapping("/suppliers/{supplierId}/plan")
    @Transactional
    public SupplierResponse setPlan(
            @PathVariable Integer supplierId,
            @Valid @RequestBody PlanRequest req
    ) {
        if (!"pro".equals(req.plan())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Plan must be 'pro'");
        }
        Supplier supplier = getSupplier(supplierId);
        supplier.setPlan(req.plan());
        return SupplierResponse.from(supplierRepository.save(supplier));
    }


    @PatchMapping("/suppliers/{supplierId}/suspend")
    @Transactional
    public SupplierResponse toggleSuspend(@PathVariable Integer supplierId) {
        Supplier supplier = getSupplier(supplierId);
        if (supplier.isAdmin()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot suspend an admin account");
        }
        supplier.setSuspended(!supplier.isSuspended());
        return SupplierResponse.from(supplierRepository.save(supplier));
    }


    @DeleteMapping("/suppliers/{supplierId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteSupplier(@PathVariable Integer supplierId) {
        Supplier supplier = getSupplier(supplierId);
        if (supplier.isAdmin()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot delete an admin account");
        }
        em.createNativeQuery("DELETE FROM invoices WHERE supplier_id = :sid")
                .setParameter("sid", supplierId).executeUpdate();
        em.createNativeQuery("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE supplier_id = :sid)")
                .setParameter("sid", supplierId).executeUpdate();
        em.createNativeQuery("DELETE FROM orders WHERE supplier_id = :sid")
                .setParameter("sid", supplierId).executeUpdate();
        em.createNativeQuery("DELETE FROM messages WHERE supplier_id = :sid")
                .setParameter("sid", supplierId).executeUpdate();
        em.createNativeQuery("DELETE FROM pending_orders WHERE supplier_id = :sid")
                .setParameter("sid", supplierId).executeUpdate();
        em.createNativeQuery("DELETE FROM clients WHERE supplier_id = :sid")
                .setParameter("sid", supplierId).executeUpdate();
        em.createNativeQuery("DELETE FROM products WHERE supplier_id = :sid")
                .setParameter("sid", supplierId).executeUpdate();
        em.createNativeQuery("DELETE FROM whatsapp_connections WHERE supplier_id = :sid")
                .setParameter("sid", supplierId).executeUpdate();
        em.createNativeQuery("DELETE FROM suppliers WHERE id = :sid")
                .setParameter("sid", supplierId).executeUpdate();
    }

    @PostMapping("/suppliers/{supplierId}/impersonate")
    public ImpersonateResponse impersonate(@PathVariable Integer supplierId) {
        Supplier supplier = getSupplier(supplierId);
        if (supplier.isAdmin()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot impersonate admin");
        }
        return new ImpersonateResponse(jwtService.generateToken(supplierId));
    }

    @GetMapping("/orders")
    public List<AdminOrderRow> listAllOrders() {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
                SELECT o.id, o.status, o.created_at,
                       s.name AS supplier_name,
                       c.name AS client_name
                FROM orders o
                JOIN suppliers s ON s.id = o.supplier_id
                JOIN clients   c ON c.id = o.client_id
                ORDER BY o.created_at DESC
                LIMIT 200
                """).getResultList();

        return rows.stream().map(r -> new AdminOrderRow(
                ((Number) r[0]).intValue(),
                (String) r[1],
                toODT(r[2]),
                (String) r[3],
                (String) r[4]
        )).toList();
    }

    @PostMapping("/broadcast")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void broadcast(@Valid @RequestBody BroadcastRequest req) {
        List<Supplier> suppliers = supplierRepository
                .findByIsAdminFalseAndSuspendedFalse();
        if (suppliers.isEmpty()) return;
        for (Supplier s : suppliers) {
            emailService.sendBroadcastEmail(s.getEmail(), req.subject(), req.message());
        }
    }


    private Supplier getSupplier(Integer id) {
        return supplierRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Supplier not found"));
    }

    private OffsetDateTime toODT(Object o) {
        if (o instanceof java.sql.Timestamp ts)
            return ts.toInstant().atOffset(java.time.ZoneOffset.UTC);
        if (o instanceof java.time.LocalDateTime ldt)
            return ldt.atOffset(java.time.ZoneOffset.UTC);
        return null;
    }
}
