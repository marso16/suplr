package com.suplr.backend.controller;

import com.suplr.backend.dto.ProductDtos.ProductRequest;
import com.suplr.backend.dto.ProductDtos.ProductResponse;
import com.suplr.backend.dto.ProductDtos.ProductUpdateRequest;
import com.suplr.backend.entity.Supplier;
import com.suplr.backend.service.ProductService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    @PostMapping("/bulk")
    @ResponseStatus(HttpStatus.CREATED)
    public List<ProductResponse> bulkCreate(
            @AuthenticationPrincipal Supplier supplier,
            @RequestBody List<@Valid ProductRequest> items
    ) {
        return productService.bulkCreate(supplier.getId(), items);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductResponse create(
            @AuthenticationPrincipal Supplier supplier,
            @Valid @RequestBody ProductRequest req
    ) {
        return productService.create(supplier.getId(), req);
    }

    @GetMapping
    public List<ProductResponse> list(@AuthenticationPrincipal Supplier supplier) {
        return productService.listForSupplier(supplier.getId());
    }

    @PutMapping("/{productId}")
    public ProductResponse update(
            @AuthenticationPrincipal Supplier supplier,
            @PathVariable Integer productId,
            @RequestBody ProductUpdateRequest req
    ) {
        return productService.update(productId, supplier.getId(), req);
    }

    @PatchMapping("/{productId}/activate")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void activate(
            @AuthenticationPrincipal Supplier supplier,
            @PathVariable Integer productId
    ) {
        productService.setActive(productId, supplier.getId(), true);
    }

    @PatchMapping("/{productId}/deactivate")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivate(
            @AuthenticationPrincipal Supplier supplier,
            @PathVariable Integer productId
    ) {
        productService.setActive(productId, supplier.getId(), false);
    }
}
