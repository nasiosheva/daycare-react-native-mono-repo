package com.daycare.api.domain

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Test

// Mories Deo Hutapea,S.E.,S.Kom
class TenantSubscriptionInvoiceNumberTest {
    @Test
    fun `invoice number follows the monthly SaaS sequence format`() {
        val first = tenantSubscriptionInvoiceNumber("202610", 1)
        val second = tenantSubscriptionInvoiceNumber("202610", 2)

        assertEquals("UE-SUB-202610-000001", first)
        assertNotEquals(first, second)
    }

    @Test
    fun `invoice number rejects invalid month and sequence values`() {
        org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException::class.java) { tenantSubscriptionInvoiceNumber("2026-10", 1) }
        org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException::class.java) { tenantSubscriptionInvoiceNumber("202610", 0) }
        org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException::class.java) { tenantSubscriptionInvoiceNumber("202610", 1_000_000) }
    }
}
