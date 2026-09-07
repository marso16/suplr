package com.suplr.backend.repository;

import com.suplr.backend.entity.Client;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClientRepository extends JpaRepository<Client, Integer> {
    List<Client> findBySupplierId(Integer supplierId);

    Optional<Client> findBySupplierIdAndWhatsappNumber(Integer supplierId, String whatsappNumber);

    Optional<Client> findByIdAndSupplierId(Integer id, Integer supplierId);
}
