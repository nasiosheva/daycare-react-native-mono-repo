package com.daycare.api.service

import com.daycare.api.domain.ParentActionType
import com.daycare.api.domain.ParentActionPage

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
