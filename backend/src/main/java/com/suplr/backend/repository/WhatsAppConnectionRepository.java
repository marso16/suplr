package com.suplr.backend.repository;

import com.suplr.backend.entity.WhatsAppConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface WhatsAppConnectionRepository extends JpaRepository<WhatsAppConnection, Integer> {
    Optional<WhatsAppConnection> findBySupplierId(Integer supplierId);
}
