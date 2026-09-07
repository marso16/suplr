package com.suplr.backend.service;

import com.suplr.backend.entity.ApiLog;
import com.suplr.backend.repository.ApiLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ApiLogService {

    private final ApiLogRepository apiLogRepository;

    @Async
    public void save(ApiLog log) {
        try {
            apiLogRepository.save(log);
        } catch (Exception e) {
            // never let logging crash the app
        }
    }
}
