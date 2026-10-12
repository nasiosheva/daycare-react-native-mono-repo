package com.daycare.api.service

import com.daycare.api.persistence.ScreeningSeedManifestRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.ScreeningSeedManifest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.util.UUID

// Mories Deo Hutapea,S.E.,S.Kom
class ScreeningSeedBatchAdminServiceTest {
    private val platform = mock(PlatformAccessService::class.java)
    private val seed = mock(ScreeningSeedBatchService::class.java)
    private val manifests = mock(ScreeningSeedManifestRepository::class.java)
    private val service = ScreeningSeedBatchAdminService(platform, seed, manifests)
    private val jwt = mock(Jwt::class.java)
    private val admin = UserProfile(id = UUID.randomUUID(), email = "admin@example.com")

    @Test
    fun `list exposes only the approved bundled batch`() {
        `when`(platform.requirePlatformAdmin(jwt)).thenReturn(admin)

        val result = service.list(jwt)

        assertEquals(1, result.size)
        assertEquals(ScreeningInitialDataset.BATCH_ID, result.single().batchId)
        assertEquals(ScreeningSeedBatchAdminStatus.AVAILABLE, result.single().status)
    }

    @Test
    fun `preview is read only and requires platform admin`() {
        `when`(platform.requirePlatformAdmin(jwt)).thenReturn(admin)
        val expected = ScreeningInitialDataset.definition("platform-admin:admin@example.com")
        `when`(seed.preview(expected)).thenReturn(ScreeningSeedBatchResult(ScreeningSeedBatchApplyStatus.PREVIEW, ScreeningInitialDataset.BATCH_ID, 1, 1, 1, 1))

        service.preview(jwt, ScreeningInitialDataset.BATCH_ID)

        verify(seed).preview(expected)
    }

    @Test
    fun `apply requires exact confirmation`() {
        `when`(platform.requirePlatformAdmin(jwt)).thenReturn(admin)

        assertThrows(IllegalArgumentException::class.java) {
            service.apply(jwt, ScreeningInitialDataset.BATCH_ID, ScreeningSeedBatchApplyRequest("apply"))
        }
    }

    @Test
    fun `apply sends actor identity from authenticated admin`() {
        `when`(platform.requirePlatformAdmin(jwt)).thenReturn(admin)
        val expected = ScreeningInitialDataset.definition("platform-admin:admin@example.com")
        `when`(seed.apply(expected)).thenReturn(ScreeningSeedBatchResult(ScreeningSeedBatchApplyStatus.APPLIED, ScreeningInitialDataset.BATCH_ID, 1, 1, 1, 1))

        service.apply(jwt, ScreeningInitialDataset.BATCH_ID, ScreeningSeedBatchApplyRequest("APPLY"))

        verify(seed).apply(expected)
        assertEquals("platform-admin:admin@example.com", expected.appliedBy)
    }

    @Test
    fun `metadata reports an applied manifest and actor identity falls back to username`() {
        val usernameAdmin = UserProfile(id = UUID.randomUUID(), username = "operator")
        `when`(platform.requirePlatformAdmin(jwt)).thenReturn(usernameAdmin)
        val definition = ScreeningInitialDataset.definition("platform-admin:preview")
        `when`(manifests.findByBatchId(ScreeningInitialDataset.BATCH_ID)).thenReturn(
            ScreeningSeedManifest(
                batchId = definition.batchId,
                seedVersion = definition.seedVersion,
                checksum = definition.checksum,
                appliedBy = "operator",
                templateCount = definition.templates.size,
                questionCount = definition.questions.size,
                choiceCount = definition.choices.size,
                translationCount = definition.texts.size,
            ),
        )

        assertEquals(ScreeningSeedBatchAdminStatus.APPLIED, service.list(jwt).single().status)
        val expected = ScreeningInitialDataset.definition("platform-admin:operator")
        `when`(seed.preview(expected)).thenReturn(ScreeningSeedBatchResult(ScreeningSeedBatchApplyStatus.PREVIEW, definition.batchId, 1, 1, 1, 1))
        service.preview(jwt, definition.batchId)
        verify(seed).preview(expected)
    }

    @Test
    fun `unknown seed batch is rejected before preview or apply`() {
        `when`(platform.requirePlatformAdmin(jwt)).thenReturn(admin)
        assertThrows(IllegalArgumentException::class.java) { service.preview(jwt, "unknown") }
        assertThrows(IllegalArgumentException::class.java) { service.apply(jwt, "unknown", ScreeningSeedBatchApplyRequest("APPLY")) }
    }
}
