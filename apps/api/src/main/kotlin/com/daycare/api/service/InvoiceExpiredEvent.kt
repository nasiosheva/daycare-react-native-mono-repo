package com.daycare.api.service

import java.util.UUID

data class InvoiceExpiredEvent(val invoiceId: UUID)
