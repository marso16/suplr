package com.suplr.backend.service;

import com.suplr.backend.dto.AuthDtos.ChangePasswordRequest;
import com.suplr.backend.dto.AuthDtos.ProfileRequest;
import com.suplr.backend.dto.AuthDtos.SupplierResponse;
import com.suplr.backend.dto.AuthDtos.TokenResponse;
import com.suplr.backend.dto.LoginRequest;
import com.suplr.backend.dto.RegisterRequest;
import com.suplr.backend.entity.Supplier;
import com.suplr.backend.repository.SupplierRepository;
import com.suplr.backend.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final SupplierRepository supplierRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EmailService emailService;

    @Transactional
    public SupplierResponse register(RegisterRequest req) {
        if (supplierRepository.existsByEmail(req.email())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email already registered");
        }

        String rawPassword = req.password();
        Supplier supplier = Supplier.builder()
                .name(req.name())
                .email(req.email())
                .passwordHash(passwordEncoder.encode(rawPassword))
                .plan("pro")
                .mustChangePassword(true)
                .build();

        supplier = supplierRepository.save(supplier);
        log.info("Registered new supplier: {}", supplier.getEmail());
        emailService.sendWelcomeEmail(req.name(), req.email(), rawPassword);

        return SupplierResponse.from(supplier);
    }

    @Transactional
    public TokenResponse login(LoginRequest req) {
        Supplier supplier = supplierRepository.findByEmail(req.email())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Invalid credentials"
                ));

        if (!passwordEncoder.matches(req.password(), supplier.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        if (supplier.isSuspended()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account suspended");
        }

        supplier.setLastLoginAt(OffsetDateTime.now());
        supplierRepository.save(supplier);

        String token = jwtService.generateToken(supplier.getId());
        return new TokenResponse(token);
    }

    @Transactional
    public SupplierResponse updateProfile(Supplier supplier, ProfileRequest req) {
        if (req.name() != null) supplier.setName(req.name());
        if (req.address() != null) supplier.setAddress(req.address());
        if (req.phone() != null) supplier.setPhone(req.phone());
        if (req.logo() != null) supplier.setLogo(req.logo());

        supplier = supplierRepository.save(supplier);
        return SupplierResponse.from(supplier);
    }

    @Transactional
    public SupplierResponse changePassword(Supplier supplier, ChangePasswordRequest req) {
        if (!passwordEncoder.matches(req.currentPassword(), supplier.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is incorrect");
        }
        supplier.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        supplier.setMustChangePassword(false);
        supplier = supplierRepository.save(supplier);
        return SupplierResponse.from(supplier);
    }

    @Transactional
    public SupplierResponse updatePlan(Supplier supplier, String plan) {
        if (!"pro".equals(plan)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Plan must be 'pro'");
        }
        supplier.setPlan(plan);
        supplier = supplierRepository.save(supplier);
        return SupplierResponse.from(supplier);
    }
}
