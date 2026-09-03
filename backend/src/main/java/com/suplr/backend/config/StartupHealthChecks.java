package com.suplr.backend.config;

import com.suplr.backend.service.StorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.sql.Connection;

@Slf4j
@Component
@RequiredArgsConstructor
public class StartupHealthChecks {

    private final DataSource dataSource;
    private final StringRedisTemplate redisTemplate;
    private final StorageService storageService;

    @Value("${app.email.smtp-host:smtp.gmail.com}")
    private String smtpHost;

    @Value("${app.email.smtp-port:587}")
    private int smtpPort;

    @Value("${app.groq.api-key:}")
    private String groqApiKey;

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        checkDb();
        checkRedis();
        checkR2();
        checkSmtp();
        checkGroq();
    }

    private void checkDb() {
        try (Connection conn = dataSource.getConnection()) {
            conn.createStatement().execute("SELECT 1");
            log.info("DB: OK");
        } catch (Exception e) {
            log.warn("DB: FAILED — {}", e.getMessage());
        }
    }

    private void checkRedis() {
        try {
            redisTemplate.getConnectionFactory().getConnection().ping();
            log.info("Redis: OK");
        } catch (Exception e) {
            log.warn("Redis: FAILED — {}", e.getMessage());
        }
    }

    private void checkR2() {
        try {
            storageService.pingBucket();
            log.info("R2: OK");
        } catch (Exception e) {
            log.warn("R2: FAILED — {}", e.getMessage());
        }
    }

    private void checkSmtp() {
        try (Socket s = new Socket()) {
            s.connect(new InetSocketAddress(smtpHost, smtpPort), 5000);
            log.info("SMTP: OK ({}:{})", smtpHost, smtpPort);
        } catch (Exception e) {
            log.warn("SMTP: FAILED — {}", e.getMessage());
        }
    }

    private void checkGroq() {
        if (groqApiKey == null || groqApiKey.isBlank()) {
            log.warn("Groq: API key not set");
        } else {
            log.info("Groq: API key set");
        }
    }
}
