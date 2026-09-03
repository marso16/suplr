package com.suplr.backend.repository;

import com.suplr.backend.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, Integer> {
    List<Product> findBySupplierId(Integer supplierId);

    List<Product> findBySupplierIdAndActiveTrue(Integer supplierId);

    Optional<Product> findByIdAndSupplierId(Integer id, Integer supplierId);
}
