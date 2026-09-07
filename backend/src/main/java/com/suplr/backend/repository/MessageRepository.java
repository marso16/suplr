package com.suplr.backend.repository;

import com.suplr.backend.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface MessageRepository extends JpaRepository<Message, Integer> {

    @Query("SELECT COUNT(m) FROM Message m WHERE m.clientId = :clientId AND m.direction = 'inbound'")
    long countInboundByClientId(@Param("clientId") Integer clientId);
}