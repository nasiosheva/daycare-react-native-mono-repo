// Mories Deo Hutapea,S.E.,S.Kom
package com.daycare.api.service

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.any
import org.mockito.ArgumentMatchers.anyString
import org.mockito.ArgumentMatchers.eq
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.jdbc.core.JdbcTemplate
import java.time.LocalDate

class TenantSubscriptionInvoiceNumberGeneratorTest {
    private val jdbc = mock(JdbcTemplate::class.java)
    private val generator = TenantSubscriptionInvoiceNumberGenerator(jdbc)

    @Test
    fun `next allocates the sequence atomically and formats the monthly invoice number`() {
        `when`(jdbc.queryForObject(anyString(), eq(Int::class.javaObjectType), any<Any>())).thenReturn(7)

        val invoiceNumber = generator.next(LocalDate.of(2026, 10, 15))

        assertEquals("UE-SUB-202610-000007", invoiceNumber)
        verify(jdbc).queryForObject(anyString(), eq(Int::class.javaObjectType), eq("202610"))
    }

    @Test
    fun `next pads the sequence and rolls over the invoice month boundary`() {
        `when`(jdbc.queryForObject(anyString(), eq(Int::class.javaObjectType), any<Any>())).thenReturn(1)

        assertEquals("UE-SUB-202601-000001", generator.next(LocalDate.of(2026, 1, 1)))
    }

    @Test
    fun `next fails fast when the sequence upsert returns no row`() {
        `when`(jdbc.queryForObject(anyString(), eq(Int::class.javaObjectType), any<Any>())).thenReturn(null)

        assertThrows(IllegalStateException::class.java) { generator.next(LocalDate.of(2026, 10, 15)) }
    }
}
