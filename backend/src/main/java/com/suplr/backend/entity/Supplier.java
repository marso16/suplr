package com.suplr.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;

@Entity
@Table(name = "suppliers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Supplier implements UserDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(length = 200, nullable = false)
    private String name;

    @Column(length = 200, nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", length = 200, nullable = false)
    private String passwordHash;

    @Column(length = 20, nullable = false)
    @Builder.Default
    private String plan = "pro";

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(columnDefinition = "text")
    private String logo;

    @Column(columnDefinition = "text")
    private String address;

    @Column(length = 50)
    private String phone;

    @Column(name = "is_admin", nullable = false)
    @Builder.Default
    private boolean isAdmin = false;

    @Column(nullable = false)
    @Builder.Default
    private boolean suspended = false;

    @Column(name = "must_change_password", nullable = false)
    @Builder.Default
    private boolean mustChangePassword = false;

    @Column(name = "last_login_at")
    private OffsetDateTime lastLoginAt;

    @PrePersist
    private void prePersist() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return isAdmin
                ? List.of(new SimpleGrantedAuthority("ROLE_ADMIN"),
                new SimpleGrantedAuthority("ROLE_SUPPLIER"))
                : List.of(new SimpleGrantedAuthority("ROLE_SUPPLIER"));
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return !suspended;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return !suspended;
    }
}