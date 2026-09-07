package com.suplr.backend.security;

import com.suplr.backend.repository.SupplierRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class SupplierDetailsService implements UserDetailsService {

    private final SupplierRepository supplierRepository;

    @Override
    public UserDetails loadUserByUsername(String supplierId) throws UsernameNotFoundException {
        return supplierRepository.findById(Integer.parseInt(supplierId))
                .orElseThrow(() -> new UsernameNotFoundException(
                        "Supplier not found with id: " + supplierId
                ));
    }
}