package com.suplr.backend.service;

import com.suplr.backend.dto.ClientDtos.ClientRequest;
import com.suplr.backend.dto.ClientDtos.ClientResponse;
import com.suplr.backend.entity.Client;
import com.suplr.backend.repository.ClientRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ClientService {

    private final ClientRepository clientRepository;

    @Transactional
    public ClientResponse create(Integer supplierId, ClientRequest req) {
        Client client = Client.builder()
                .supplierId(supplierId)
                .name(req.name())
                .whatsappNumber(req.whatsappNumber())
                .creditTerms(req.creditTerms())
                .notes(req.notes())
                .email(req.email())
                .build();
        return ClientResponse.from(clientRepository.save(client));
    }

    public List<ClientResponse> listForSupplier(Integer supplierId) {
        return clientRepository.findBySupplierId(supplierId)
                .stream()
                .map(ClientResponse::from)
                .toList();
    }

    @Transactional
    public void delete(Integer clientId, Integer supplierId) {
        Client client = clientRepository.findByIdAndSupplierId(clientId, supplierId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Client not found"));
        clientRepository.delete(client);
    }

    @Transactional
    public Client getOrCreateByWhatsappNumber(Integer supplierId, String whatsappNumber) {
        return clientRepository
                .findBySupplierIdAndWhatsappNumber(supplierId, whatsappNumber)
                .orElseGet(() -> {
                    try {
                        Client newClient = Client.builder()
                                .supplierId(supplierId)
                                .name(whatsappNumber)
                                .whatsappNumber(whatsappNumber)
                                .build();
                        return clientRepository.save(newClient);
                    } catch (DataIntegrityViolationException e) {
                        return clientRepository
                                .findBySupplierIdAndWhatsappNumber(supplierId, whatsappNumber)
                                .orElseThrow(() -> new ResponseStatusException(
                                        HttpStatus.INTERNAL_SERVER_ERROR, "Failed to resolve client"));
                    }
                });
    }
}
