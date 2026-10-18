package com.daycare.api.service

import com.daycare.api.domain.ParentActionType
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test

// Mories Deo Hutapea,S.E.,S.Kom
class TenantAnnouncementActionValidationTest {
    @Test
    fun `none action has no target and browser target must be safe https`() {
        assertNull(validateParentAction(ParentActionType.NONE, null))
        assertEquals("https://example.org/info", validateParentAction(ParentActionType.OPEN_BROWSER, " https://example.org/info "))
        assertThrows(IllegalArgumentException::class.java) { validateParentAction(ParentActionType.NONE, "https://example.org") }
        assertThrows(IllegalArgumentException::class.java) { validateParentAction(ParentActionType.OPEN_BROWSER, "http://example.org") }
        assertThrows(IllegalArgumentException::class.java) { validateParentAction(ParentActionType.OPEN_BROWSER, "https://user:secret@example.org") }
    }

    @Test
    fun `app page target accepts only supported page keys`() {
        assertEquals("BOOKING", validateParentAction(ParentActionType.OPEN_APP_PAGE, "BOOKING"))
        assertThrows(IllegalArgumentException::class.java) { validateParentAction(ParentActionType.OPEN_APP_PAGE, "/children?childId=unsafe") }
        assertThrows(IllegalArgumentException::class.java) { validateParentAction(ParentActionType.OPEN_APP_PAGE, null) }
    }
}
