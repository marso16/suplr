package com.suplr.backend.repository;

import com.suplr.backend.entity.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, Integer> {

    Optional<Invoice> findByOrderId(Integer orderId);

    Optional<Invoice> findByIdAndSupplierId(Integer id, Integer supplierId);

    long countBySupplierId(Integer supplierId);

    @Query("""
            SELECT i, c.name, c.email
            FROM Invoice i
            JOIN Order o ON o.id = i.orderId
            JOIN Client c ON c.id = o.clientId
            WHERE i.supplierId = :supplierId
            ORDER BY i.issuedAt DESC
            """)
    List<Object[]> findWithClientBySupplierId(@Param("supplierId") Integer supplierId);

    @Query("""
            SELECT i, o, c
            FROM Invoice i
            JOIN Order o ON o.id = i.orderId
            JOIN Client c ON c.id = o.clientId
            WHERE i.supplierId = :supplierId
            ORDER BY i.issuedAt DESC
            """)
    List<Object[]> findWithOrderAndClientBySupplierId(@Param("supplierId") Integer supplierId);
}
