// Mories Deo Hutapea,S.E.,S.Kom
package com.daycare.api.service

import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.math.BigDecimal

@Component
class TenantSubscriptionBillingPolicy(
    @Value("\${daycare.tenant-subscription.max-payment-amount:}") configuredMaximum: String,
) {
    private val maximumAmount: BigDecimal? = configuredMaximum.trim().takeIf(String::isNotEmpty)?.toBigDecimalOrNull()

    init {
        require(configuredMaximum.isBlank() || maximumAmount != null && maximumAmount > BigDecimal.ZERO && maximumAmount.stripTrailingZeros().scale() <= 0) {
            "Tenant subscription maximum payment amount must be a positive whole IDR amount"
        }
    }

    fun requireAllowedAmount(amount: BigDecimal) {
        val maximum = maximumAmount ?: throw IllegalStateException("Tenant subscription billing is disabled until the maximum payment amount is configured")
        require(amount > BigDecimal.ZERO && amount.stripTrailingZeros().scale() <= 0) { "Tenant subscription amount must be a positive whole IDR amount" }
        require(amount <= maximum) { "Tenant subscription amount exceeds the configured maximum" }
    }
}
