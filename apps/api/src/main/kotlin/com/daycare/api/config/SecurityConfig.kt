package com.daycare.api.config

import com.daycare.api.service.LOCAL_TOKEN_ISSUER
import com.daycare.api.service.AccessTokenRevocationService
import com.daycare.api.service.LocalJwtService
import com.nimbusds.jwt.SignedJWT
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtDecoders
import org.springframework.security.oauth2.jwt.JwtException
import org.springframework.security.web.SecurityFilterChain
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource
import org.springframework.web.servlet.LocaleResolver
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver
import java.util.Locale

@Configuration
@EnableWebSecurity
class SecurityConfig {
    @Bean
    fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder()

    @Bean
    fun localeResolver(): LocaleResolver = AcceptHeaderLocaleResolver().apply {
        supportedLocales = listOf(Locale.of("id"), Locale.ENGLISH)
        setDefaultLocale(Locale.of("id"))
    }

    @Bean
    fun corsConfigurationSource(@Value("\${daycare.cors-allowed-origins:}") allowedOrigins: String): CorsConfigurationSource {
        val configuration = CorsConfiguration().apply {
            this.allowedOrigins = allowedOrigins.split(",").map { it.trim() }.filter { it.isNotBlank() }
            allowedMethods = listOf("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS")
            allowedHeaders = listOf("Authorization", "Content-Type", "X-Organization-Id", "Accept-Language")
        }
        return UrlBasedCorsConfigurationSource().apply { registerCorsConfiguration("/**", configuration) }
    }

    @Bean
    fun jwtDecoder(
        localJwtService: LocalJwtService,
        tokenRevocations: AccessTokenRevocationService,
        @Value("\${spring.security.oauth2.resourceserver.jwt.issuer-uri}") firebaseIssuer: String,
    ): JwtDecoder {
        val localDecoder: JwtDecoder = localJwtService.decoder()
        val firebaseDecoder: JwtDecoder = JwtDecoders.fromIssuerLocation(firebaseIssuer)
        return JwtDecoder { token ->
            if (tokenRevocations.isRevoked(token)) throw JwtException("Token has been revoked")
            val issuer = try { SignedJWT.parse(token).jwtClaimsSet.issuer } catch (error: Exception) { throw JwtException("Invalid token", error) }
            if (issuer == LOCAL_TOKEN_ISSUER) localDecoder.decode(token) else firebaseDecoder.decode(token)
        }
    }

    @Bean
    fun securityFilterChain(http: HttpSecurity, corsConfigurationSource: CorsConfigurationSource): SecurityFilterChain = http
        .csrf { it.disable() }
        .cors { it.configurationSource(corsConfigurationSource) }
        .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
        .authorizeHttpRequests {
            it.requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/actuator/health", "/v1/auth/local/login", "/v1/auth/local/register", "/v1/realtime").permitAll()
                .anyRequest().authenticated()
        }
        .oauth2ResourceServer { it.jwt {} }
        .build()
}
