package com.suplr.backend.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Setter
@Getter
@Component
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private Jwt jwt = new Jwt();
    private Cors cors = new Cors();

    @Setter
    @Getter
    public static class Jwt {
        private String secret;
        private int expirationMinutes = 1440;

    }

    @Setter
    @Getter
    public static class Cors {
        private String allowedOrigins = "http://localhost:3000";

    }
}