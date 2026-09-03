package com.suplr.backend.service;

import com.suplr.backend.dto.ProductDtos.ProductRequest;
import com.suplr.backend.dto.ProductDtos.ProductResponse;
import com.suplr.backend.dto.ProductDtos.ProductUpdateRequest;
import com.suplr.backend.entity.Product;
import com.suplr.backend.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;

    private String deriveSku(String name, String sku) {
        if (sku != null && !sku.isBlank()) return sku;
        return name.toUpperCase().replaceAll("\\s+", "-").substring(0, Math.min(name.length(), 50));
    }

    @Transactional
    public ProductResponse create(Integer supplierId, ProductRequest req) {
        Product product = Product.builder()
                .supplierId(supplierId)
                .name(req.name())
                .sku(deriveSku(req.name(), req.sku()))
                .unit(req.unit())
                .priceUsd(req.priceUsd())
                .priceLbp(req.priceLbp())
                .build();
        return ProductResponse.from(productRepository.save(product));
    }

    @Transactional
    public List<ProductResponse> bulkCreate(Integer supplierId, List<ProductRequest> items) {
        List<Product> products = items.stream().map(req -> Product.builder()
                .supplierId(supplierId)
                .name(req.name())
                .sku(deriveSku(req.name(), req.sku()))
                .unit(req.unit())
                .priceUsd(req.priceUsd())
                .priceLbp(req.priceLbp())
                .build()
        ).toList();
        return productRepository.saveAll(products).stream()
                .map(ProductResponse::from)
                .toList();
    }

    public List<ProductResponse> listForSupplier(Integer supplierId) {
        return productRepository.findBySupplierId(supplierId).stream()
                .map(ProductResponse::from)
                .toList();
    }

    public List<Product> getActiveProducts(Integer supplierId) {
        return productRepository.findBySupplierIdAndActiveTrue(supplierId);
    }

    @Transactional
    public ProductResponse update(Integer productId, Integer supplierId, ProductUpdateRequest req) {
        Product product = getOwnedProduct(productId, supplierId);
        if (req.name() != null) product.setName(req.name());
        if (req.sku() != null) product.setSku(req.sku());
        if (req.unit() != null) product.setUnit(req.unit());
        if (req.priceUsd() != null) product.setPriceUsd(req.priceUsd());
        if (req.priceLbp() != null) product.setPriceLbp(req.priceLbp());
        return ProductResponse.from(productRepository.save(product));
    }

    @Transactional
    public void setActive(Integer productId, Integer supplierId, boolean active) {
        Product product = getOwnedProduct(productId, supplierId);
        product.setActive(active);
        productRepository.save(product);
    }

    private Product getOwnedProduct(Integer productId, Integer supplierId) {
        return productRepository.findByIdAndSupplierId(productId, supplierId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));
    }
}
