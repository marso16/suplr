package com.suplr.backend.controller;

import com.suplr.backend.dto.ClientDtos.ClientRequest;
import com.suplr.backend.dto.ClientDtos.ClientResponse;
import com.suplr.backend.entity.Supplier;
import com.suplr.backend.service.ClientService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/clients")
@RequiredArgsConstructor
public class ClientController {

    private final ClientService clientService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ClientResponse create(@AuthenticationPrincipal Supplier supplier, @Valid @RequestBody ClientRequest req) {
        return clientService.create(supplier.getId(), req);
    }

    @GetMapping
    public List<ClientResponse> list(@AuthenticationPrincipal Supplier supplier) {
        return clientService.listForSupplier(supplier.getId());
    }

    @DeleteMapping("/{clientId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Supplier supplier, @PathVariable Integer clientId) {
        clientService.delete(clientId, supplier.getId());
    }
}
