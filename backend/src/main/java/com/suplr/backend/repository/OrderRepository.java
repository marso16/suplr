package com.suplr.backend.repository;

import com.suplr.backend.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, Integer> {

    List<Order> findBySupplierIdOrderByCreatedAtDesc(Integer supplierId);

    Optional<Order> findByIdAndSupplierId(Integer id, Integer supplierId);

    List<Order> findTop5BySupplierIdAndClientIdAndStatusInOrderByCreatedAtDesc(
            Integer supplierId, Integer clientId, List<String> statuses);
}