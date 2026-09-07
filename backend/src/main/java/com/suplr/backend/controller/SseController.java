package com.suplr.backend.controller;

import com.suplr.backend.entity.Supplier;
import com.suplr.backend.repository.SupplierRepository;
import com.suplr.backend.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Optional;

@Slf4j
@RestController
@RequiredArgsConstructor
public class SseController {

    private final RedisMessageListenerContainer listenerContainer;
    private final JwtService jwtService;
    private final SupplierRepository supplierRepository;

    @GetMapping(value = "/sse/orders", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter orderStream(@AuthenticationPrincipal Supplier supplier) {
        SseEmitter emitter = new SseEmitter(-1L);
        Integer supplierId = supplier.getId();
        String channel = "supplier:" + supplierId + ":orders";

        MessageListener listener = (message, pattern) -> {
            try {
                String data = new String(message.getBody());
                emitter.send(SseEmitter.event().data(data));
                log.debug("SSE → supplier {}: {}", supplierId, data);
            } catch (IOException e) {
                listenerContainer.removeMessageListener(this::noOp,
                        new ChannelTopic(channel));
                emitter.completeWithError(e);
            }
        };

        listenerContainer.addMessageListener(listener, new ChannelTopic(channel));
        log.info("SSE stream opened for supplier {} on {}", supplierId, channel);

        emitter.onCompletion(() -> {
            listenerContainer.removeMessageListener(listener, new ChannelTopic(channel));
            log.info("SSE stream closed for supplier {}", supplierId);
        });
        emitter.onTimeout(() -> {
            listenerContainer.removeMessageListener(listener, new ChannelTopic(channel));
            log.info("SSE stream timed out for supplier {}", supplierId);
        });
        emitter.onError(e -> {
            listenerContainer.removeMessageListener(listener, new ChannelTopic(channel));
            log.warn("SSE stream error for supplier {}: {}", supplierId, e.getMessage());
        });

        return emitter;
    }

    private void noOp(org.springframework.data.redis.connection.Message m, byte[] p) {
    }

    @org.springframework.stereotype.Component
    @RequiredArgsConstructor
    public static class OrdersWebSocketHandler extends TextWebSocketHandler {

        private final JwtService jwtService;
        private final SupplierRepository supplierRepository;
        private final RedisMessageListenerContainer listenerContainer;

        @Override
        public void afterConnectionEstablished(WebSocketSession session) {
            String token = extractToken(session);
            if (token == null || !jwtService.isTokenValid(token)) {
                closeUnauthorised(session);
                return;
            }

            Integer supplierId = jwtService.extractSupplierId(token);
            Optional<Supplier> supplier = supplierRepository.findById(supplierId);

            if (supplier.isEmpty() || supplier.get().isSuspended()) {
                closeUnauthorised(session);
                return;
            }

            String channel = "supplier:" + supplierId + ":orders";

            MessageListener listener = (message, pattern) -> {
                try {
                    if (session.isOpen()) {
                        session.sendMessage(new TextMessage(new String(message.getBody())));
                    }
                } catch (IOException e) {
                    listenerContainer.removeMessageListener(this::noOp,
                            new ChannelTopic(channel));
                }
            };

            listenerContainer.addMessageListener(listener, new ChannelTopic(channel));
            session.getAttributes().put("listener", listener);
            session.getAttributes().put("channel", channel);
            session.getAttributes().put("supplierId", supplierId);
            log.info("WS opened for supplier {}", supplierId);
        }

        @Override
        public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
            cleanup(session);
        }

        @Override
        public void handleTransportError(WebSocketSession session, Throwable exception) {
            log.warn("WS error for session {}: {}", session.getId(), exception.getMessage());
            cleanup(session);
        }

        private void cleanup(WebSocketSession session) {
            MessageListener listener = (MessageListener) session.getAttributes().get("listener");
            String channel = (String) session.getAttributes().get("channel");
            Integer supplierId = (Integer) session.getAttributes().get("supplierId");
            if (listener != null && channel != null) {
                listenerContainer.removeMessageListener(listener, new ChannelTopic(channel));
            }
            if (supplierId != null) log.info("WS closed for supplier {}", supplierId);
        }

        private String extractToken(WebSocketSession session) {
            String query = session.getUri() != null ? session.getUri().getQuery() : null;
            if (query == null) return null;
            for (String param : query.split("&")) {
                if (param.startsWith("token=")) return param.substring(6);
            }
            return null;
        }

        private void closeUnauthorised(WebSocketSession session) {
            try {
                session.close(CloseStatus.NOT_ACCEPTABLE);
            } catch (IOException ignored) {
            }
        }

        private void noOp(org.springframework.data.redis.connection.Message m, byte[] p) {
        }
    }
}
