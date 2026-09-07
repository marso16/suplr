package com.suplr.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class SseService {

    private final StringRedisTemplate redis;
    private final CacheService cacheService;
    private final ObjectMapper objectMapper;

    public void publishOrderEvent(Integer supplierId, String eventType, Integer orderId) {
        try {
            String channel = "supplier:" + supplierId + ":orders";
            String payload = objectMapper.writeValueAsString(
                    Map.of("type", eventType, "order_id", orderId));

            redis.convertAndSend(channel, payload);
            log.debug("Published {} for order {} on {}", eventType, orderId, channel);
        } catch (Exception e) {
            log.error("Redis publish failed (supplier={}, order={}): {}",
                    supplierId, orderId, e.getMessage());
        }

        cacheService.invalidateReportCache(supplierId);
    }
}