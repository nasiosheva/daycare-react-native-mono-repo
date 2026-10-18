package com.daycare.api.service

import com.daycare.api.domain.ParentActionType
import com.daycare.api.domain.ParentActionPage
import com.daycare.api.domain.PlatformBannerAudience
import com.daycare.api.domain.PlatformBannerParentActionPage
import com.daycare.api.domain.StaffAdminBannerActionPage

// Mories Deo Hutapea,S.E.,S.Kom
internal fun validateParentAction(type: ParentActionType, target: String?): String? = when (type) {
    ParentActionType.NONE -> {
        require(target.isNullOrBlank()) { DaycareOperationError.INVALID }
        null
    }
    ParentActionType.OPEN_BROWSER -> requireHttpsUrl(target)
        ?: throw IllegalArgumentException(DaycareOperationError.INVALID)
    ParentActionType.OPEN_APP_PAGE -> {
        val page = runCatching { ParentActionPage.valueOf(target?.trim().orEmpty()) }.getOrNull()
        requireNotNull(page) { DaycareOperationError.INVALID }
        page.name
    }
}

internal fun validatePlatformBannerAction(audience: PlatformBannerAudience, type: ParentActionType, target: String?): String? = when (audience) {
    PlatformBannerAudience.PARENT_GLOBAL -> when (type) {
        ParentActionType.NONE, ParentActionType.OPEN_BROWSER -> validateParentAction(type, target)
        ParentActionType.OPEN_APP_PAGE -> {
            val page = runCatching { PlatformBannerParentActionPage.valueOf(target?.trim().orEmpty()) }.getOrNull()
            requireNotNull(page) { DaycareOperationError.INVALID }
            page.name
        }
    }
    PlatformBannerAudience.STAFF_ADMIN_GLOBAL, PlatformBannerAudience.TENANT_STAFF_ADMIN -> when (type) {
        ParentActionType.NONE -> {
            require(target.isNullOrBlank()) { DaycareOperationError.INVALID }
            null
        }
        ParentActionType.OPEN_BROWSER -> requireHttpsUrl(target)
            ?: throw IllegalArgumentException(DaycareOperationError.INVALID)
        ParentActionType.OPEN_APP_PAGE -> {
            val page = runCatching { StaffAdminBannerActionPage.valueOf(target?.trim().orEmpty()) }.getOrNull()
            requireNotNull(page) { DaycareOperationError.INVALID }
            page.name
        }
    }
}
