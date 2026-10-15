// Mories Deo Hutapea,S.E.,S.Kom
package com.daycare.api.service

import com.daycare.api.domain.tenantSubscriptionInvoiceNumber
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component
import java.time.LocalDate

@Component
class TenantSubscriptionInvoiceNumberGenerator(private val jdbc: JdbcTemplate) {
    fun next(date: LocalDate = LocalDate.now(BILLING_TIME_ZONE)): String {
        val month = "%04d%02d".format(date.year, date.monthValue)
        val sequence = jdbc.queryForObject(
            """
            INSERT INTO tenant_subscription_invoice_sequences (invoice_month, last_sequence)
            VALUES (?, 1)
            ON CONFLICT (invoice_month) DO UPDATE
            SET last_sequence = tenant_subscription_invoice_sequences.last_sequence + 1
            RETURNING last_sequence
            """.trimIndent(),
            Int::class.javaObjectType,
            month,
        ) ?: error("Tenant subscription invoice sequence was not allocated")
        return tenantSubscriptionInvoiceNumber(month, sequence.toLong())
    }
}
