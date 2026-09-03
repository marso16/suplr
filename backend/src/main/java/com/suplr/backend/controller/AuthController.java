package com.suplr.backend.controller;

import com.suplr.backend.dto.AuthDtos.ChangePasswordRequest;
import com.suplr.backend.dto.AuthDtos.ProfileRequest;
import com.suplr.backend.dto.AuthDtos.SupplierResponse;
import com.suplr.backend.dto.AuthDtos.TokenResponse;
import com.suplr.backend.dto.LoginRequest;
import com.suplr.backend.dto.RegisterRequest;
import com.suplr.backend.entity.Supplier;
import com.suplr.backend.service.AuthService;
import com.suplr.backend.service.StorageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final StorageService storageService;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public SupplierResponse register(@Valid @RequestBody RegisterRequest req) {
        return authService.register(req);
    }

    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest req) {
        return authService.login(req);
    }

    @GetMapping("/me")
    public SupplierResponse me(@AuthenticationPrincipal Supplier supplier) {
        return SupplierResponse.from(supplier);
    }

    @PutMapping("/profile")
    public SupplierResponse updateProfile(
            @AuthenticationPrincipal Supplier supplier,
            @RequestBody ProfileRequest req
    ) {
        return authService.updateProfile(supplier, req);
    }

    @PutMapping("/me/password")
    public SupplierResponse changePassword(
            @AuthenticationPrincipal Supplier supplier,
            @Valid @RequestBody ChangePasswordRequest req
    ) {
        return authService.changePassword(supplier, req);
    }

    @PatchMapping("/me/plan")
    @PreAuthorize("hasRole('ADMIN')")
    public SupplierResponse updatePlan(
            @AuthenticationPrincipal Supplier supplier,
            @RequestParam String plan
    ) {
        return authService.updatePlan(supplier, plan);
    }

    @PostMapping(value = "/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, String> uploadLogo(
            @AuthenticationPrincipal Supplier supplier,
            @RequestParam("file") MultipartFile file
    ) throws IOException {
        byte[] data = file.getBytes();
        String ext = file.getOriginalFilename() != null
                ? file.getOriginalFilename().substring(
                file.getOriginalFilename().lastIndexOf('.')) : ".png";
        String key = "logos/" + supplier.getId() + ext;
        String url = storageService.upload(key, data,
                file.getContentType() != null ? file.getContentType() : "image/png");
        return Map.of("url", url);
    }
}
