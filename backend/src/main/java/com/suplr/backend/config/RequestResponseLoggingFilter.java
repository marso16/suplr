package com.suplr.backend.config;

import com.suplr.backend.entity.ApiLog;
import com.suplr.backend.entity.Supplier;
import com.suplr.backend.service.ApiLogService;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerMapping;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Component
@RequiredArgsConstructor
public class RequestResponseLoggingFilter implements Filter {

    private static final Logger log = LoggerFactory.getLogger(RequestResponseLoggingFilter.class);

    private final ApiLogService apiLogService;

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {

        ContentCachingRequestWrapper request = new ContentCachingRequestWrapper((HttpServletRequest) req);
        ContentCachingResponseWrapper response = new ContentCachingResponseWrapper((HttpServletResponse) res);

        long start = System.currentTimeMillis();
        try {
            chain.doFilter(request, response);
        } finally {
            long duration = System.currentTimeMillis() - start;

            String requestUri   = request.getRequestURI();
            String method       = request.getMethod();
            boolean isGet       = "GET".equalsIgnoreCase(method);
            boolean isAuth      = requestUri.contains("/auth");

            if (!isGet && !isAuth) {

                String requestBody  = new String(request.getContentAsByteArray(), StandardCharsets.UTF_8);
                String responseBody = new String(response.getContentAsByteArray(), StandardCharsets.UTF_8);
                int    status       = response.getStatus();

                String controller = null;
                Object handler = request.getAttribute(HandlerMapping.BEST_MATCHING_HANDLER_ATTRIBUTE);
                if (handler instanceof HandlerMethod hm) {
                    controller = hm.getBeanType().getSimpleName() + "#" + hm.getMethod().getName();
                }

                Long   supplierId   = null;
                String supplierName = null;
                Authentication auth = SecurityContextHolder.getContext().getAuthentication();
                if (auth != null && auth.getPrincipal() instanceof Supplier supplier) {
                    supplierId   = supplier.getId().longValue();
                    supplierName = supplier.getName();
                }

                String errorMessage = null;
                if (status >= 400 && !responseBody.isBlank()) {
                    errorMessage = extractDetail(responseBody);
                }

                ApiLog apiLog = ApiLog.builder()
                        .method(method)
                        .path(requestUri)
                        .queryString(request.getQueryString())
                        .requestBody(requestBody.isBlank() ? null : requestBody)
                        .clientIp(getClientIp(request))
                        .userAgent(request.getHeader("User-Agent"))
                        .supplierId(supplierId)
                        .supplierName(supplierName)
                        .statusCode((short) status)
                        .responseBody(responseBody.isBlank() ? null : responseBody)
                        .durationMs((int) duration)
                        .errorMessage(errorMessage)
                        .controller(controller)
                        .build();

                apiLogService.save(apiLog);
            }

            response.copyBodyToResponse();
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private String extractDetail(String json) {
        for (String key : new String[]{"detail", "message", "error"}) {
            String search = "\"" + key + "\"";
            int idx = json.indexOf(search);
            if (idx >= 0) {
                int colon = json.indexOf(':', idx + search.length());
                if (colon >= 0) {
                    int start = json.indexOf('"', colon + 1);
                    if (start >= 0) {
                        int end = json.indexOf('"', start + 1);
                        if (end > start) return json.substring(start + 1, end);
                    }
                }
            }
        }
        return null;
    }
}