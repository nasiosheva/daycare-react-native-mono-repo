package com.daycare.api.service

import java.net.URI

// Mories Deo Hutapea,S.E.,S.Kom
internal fun requireHttpsImageUrl(value: String?): String? {
    return requireHttpsUrl(value)
}

internal fun requireHttpsUrl(value: String?): String? {
    if (value == null) return null
    val normalized = value.trim()
    val uri = runCatching { URI(normalized) }.getOrNull()
    require(normalized.length in 1..2048 && uri?.scheme.equals("https", ignoreCase = true) && !uri?.host.isNullOrBlank() && uri?.userInfo == null) {
        DaycareOperationError.INVALID
    }
    return normalized
}
