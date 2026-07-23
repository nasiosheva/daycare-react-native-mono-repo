package com.daycare.api.realtime

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Configuration
import org.springframework.web.socket.config.annotation.EnableWebSocket
import org.springframework.web.socket.config.annotation.WebSocketConfigurer
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry

@Configuration
@EnableWebSocket
class RealtimeWebSocketConfig(
    private val handler: RealtimeWebSocketHandler,
    @Value("\${daycare.cors-allowed-origins:}") private val allowedOrigins: String,
) : WebSocketConfigurer {
    override fun registerWebSocketHandlers(registry: WebSocketHandlerRegistry) {
        registry.addHandler(handler, "/v1/realtime")
            .setAllowedOriginPatterns(*allowedOrigins.split(',').map(String::trim).filter(String::isNotBlank).toTypedArray())
    }
}
