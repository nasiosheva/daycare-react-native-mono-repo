package com.daycare.api.config

import com.daycare.api.service.LocalJwtService
import org.springframework.beans.factory.ObjectProvider
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
import org.springframework.security.web.SecurityFilterChain
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
    fun jwtDecoder(
        localJwtService: ObjectProvider<LocalJwtService>,
        @Value("\${daycare.local-auth-enabled:false}") localAuthEnabled: Boolean,
        @Value("\${spring.security.oauth2.resourceserver.jwt.issuer-uri}") firebaseIssuer: String,
    ): JwtDecoder = if (localAuthEnabled) localJwtService.getObject().decoder() else JwtDecoders.fromIssuerLocation(firebaseIssuer)

    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain = http
        .csrf { it.disable() }
        .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
        .authorizeHttpRequests {
            it.requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/actuator/health", "/v1/auth/local/login", "/v1/auth/local/register").permitAll()
                .anyRequest().authenticated()
        }
        .oauth2ResourceServer { it.jwt {} }
        .build()
}
