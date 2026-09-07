package com.suplr.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.suplr.backend.config.Constants;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class CacheService {

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    public boolean isMessageSeen(Integer supplierId, String msgId) {
        try {
            Boolean exists = redis.hasKey("idem:" + supplierId + ":" + msgId);
            return Boolean.TRUE.equals(exists);
        } catch (Exception e) {
            log.warn("Redis idempotency check failed: {}", e.getMessage());
            return false;
        }
    }

    public void markMessageSeen(Integer supplierId, String msgId) {
        try {
            redis.opsForValue().set("idem:" + supplierId + ":" + msgId, "1", Constants.TTL_WEBHOOK);
        } catch (Exception e) {
            log.warn("Redis mark-seen failed: {}", e.getMessage());
        }
    }

    public <T> T getCachedReport(Integer supplierId, String period, Class<T> type) {
        try {
            String raw = redis.opsForValue().get("report:" + supplierId + ":" + period);
            if (raw == null) return null;
            return objectMapper.readValue(raw, type);
        } catch (Exception e) {
            log.warn("Redis report cache read failed: {}", e.getMessage());
            return null;
        }
    }

    public void setCachedReport(Integer supplierId, String period, Object data) {
        try {
            redis.opsForValue().set(
                    "report:" + supplierId + ":" + period,
                    objectMapper.writeValueAsString(data),
                    Constants.TTL_REPORT
            );
        } catch (Exception e) {
            log.warn("Redis report cache write failed: {}", e.getMessage());
        }
    }

    public void invalidateReportCache(Integer supplierId) {
        try {
            var keys = redis.keys("report:" + supplierId + ":*");
            if (!keys.isEmpty()) {
                redis.delete(keys);
            }
        } catch (Exception e) {
            log.warn("Redis report cache invalidation failed: {}", e.getMessage());
        }
    }
}
