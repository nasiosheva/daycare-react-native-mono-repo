package com.daycare.api.web

import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.context.support.ResourceBundleMessageSource
import org.springframework.context.i18n.LocaleContextHolder
import org.springframework.security.access.AccessDeniedException
import com.daycare.api.service.InvalidLocalCredentialsException
import java.util.Locale

class ApiExceptionHandlerTest {
    private val handler = ApiExceptionHandler(ResourceBundleMessageSource().apply {
        setBasename("i18n/errors")
        setDefaultEncoding("UTF-8")
    })

    @AfterEach
    fun clearLocale() = LocaleContextHolder.resetLocaleContext()

    @Test
    fun `localizes forbidden details from accept language locale`() {
        LocaleContextHolder.setLocale(Locale.ENGLISH)

        val problem = handler.forbidden(AccessDeniedException("Tenant subscription is not active"))

        assertEquals("The tenant subscription is inactive.", problem.detail)
        assertEquals("FORBIDDEN", problem.properties?.get("code"))
    }

    @Test
    fun `defaults error details to Indonesian`() {
        LocaleContextHolder.setLocale(Locale.of("id"))

        val problem = handler.invalidRequest(IllegalArgumentException("QR token is invalid"))

        assertEquals("Kode QR tidak valid.", problem.detail)
        assertEquals("VALIDATION_ERROR", problem.properties?.get("code"))
    }

    @Test
    fun `returns unauthorized localized detail for invalid local credentials`() {
        LocaleContextHolder.setLocale(Locale.ENGLISH)

        val problem = handler.invalidLocalCredentials(InvalidLocalCredentialsException())

        assertEquals(401, problem.status)
        assertEquals("The email or username, or password is invalid.", problem.detail)
        assertEquals("AUTHENTICATION_FAILED", problem.properties?.get("code"))
    }
}
