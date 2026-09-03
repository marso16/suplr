package com.suplr.backend.repository;

import com.suplr.backend.entity.PendingOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PendingOrderRepository extends JpaRepository<PendingOrder, Integer> {

    Optional<PendingOrder> findBySupplierIdAndClientId(Integer supplierId, Integer clientId);

    void deleteBySupplierIdAndClientId(Integer supplierId, Integer clientId);
}