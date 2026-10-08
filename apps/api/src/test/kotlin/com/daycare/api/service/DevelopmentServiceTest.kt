package com.daycare.api.service

import com.daycare.api.domain.DevelopmentMediaKind
import com.daycare.api.domain.Role
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.DevelopmentCategoryConfig
import com.daycare.api.persistence.DevelopmentCategoryConfigRepository
import com.daycare.api.persistence.DevelopmentEntry
import com.daycare.api.persistence.DevelopmentEntryMedia
import com.daycare.api.persistence.DevelopmentEntryMediaRepository
import com.daycare.api.persistence.DevelopmentEntryRepository
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.realtime.RealtimePublisher
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Base64
import java.util.Optional
import java.util.UUID

class DevelopmentServiceTest {
    @Test
    fun `staff can manage tenant categories and record media`() {
        val fixture = fixture()
        val global = DevelopmentCategoryConfig(name = "Global")
        val local = DevelopmentCategoryConfig(id = fixture.categoryId, organizationId = fixture.organizationId, name = "Motorik")
        `when`(fixture.categories.findAllByOrganizationIdIsNullOrderByNameAsc()).thenReturn(listOf(global))
        `when`(fixture.categories.findAllByOrganizationIdOrderByNameAsc(fixture.organizationId)).thenReturn(listOf(local))
        assertEquals(listOf(true, false), fixture.service.categories(fixture.jwt, fixture.organizationId).map { it.system })
        `when`(fixture.categories.existsByOrganizationIdIsNullAndNameIgnoreCase("Bahasa")).thenReturn(false)
        `when`(fixture.categories.existsByOrganizationIdAndNameIgnoreCase(fixture.organizationId, "Bahasa")).thenReturn(false)
        `when`(fixture.categories.save(any(DevelopmentCategoryConfig::class.java))).thenAnswer { it.arguments[0] }
        assertEquals("Bahasa", fixture.service.createCategory(fixture.jwt, fixture.organizationId, CreateDevelopmentCategoryRequest(" Bahasa ")).name)
        `when`(fixture.categories.findById(fixture.categoryId)).thenReturn(Optional.of(local))
        `when`(fixture.categories.existsByOrganizationIdAndNameIgnoreCase(fixture.organizationId, "Baru")).thenReturn(false)
        assertEquals("Baru", fixture.service.updateCategory(fixture.jwt, fixture.organizationId, fixture.categoryId, UpdateDevelopmentCategoryRequest(" Baru ", active = false)).name)
        `when`(fixture.entries.existsByOrganizationIdAndCategory(fixture.organizationId, fixture.categoryId.toString())).thenReturn(false)
        fixture.service.deleteCategory(fixture.jwt, fixture.organizationId, fixture.categoryId)

        `when`(fixture.categories.findById(fixture.categoryId)).thenReturn(Optional.of(DevelopmentCategoryConfig(id = fixture.categoryId, organizationId = fixture.organizationId, name = "Motorik", active = true)))
        `when`(fixture.entries.save(any(DevelopmentEntry::class.java))).thenAnswer { it.arguments[0] }
        `when`(fixture.users.findById(fixture.staff.id)).thenReturn(Optional.of(fixture.staff))
        val png = Base64.getEncoder().encodeToString(byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))
        val entry = fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, CreateDevelopmentEntryRequest(fixture.categoryId.toString(), "  Catatan ", "  Isi ", photo = DevelopmentPhotoInput("image/png", png)))
        assertEquals("Catatan", entry.title)
        assertTrue(entry.hasPhoto)
    }

    @Test
    fun `photo and media content enforce ownership and valid media`() {
        val fixture = fixture()
        val entry = DevelopmentEntry(id = fixture.entryId, organizationId = fixture.organizationId, childId = fixture.child.id, authorUserId = fixture.staff.id, photoContentType = "image/png", photoData = byteArrayOf(1, 2))
        `when`(fixture.entries.findById(fixture.entryId)).thenReturn(Optional.of(entry))
        `when`(fixture.media.findAllByDevelopmentEntryIdOrderByDisplayOrderAsc(fixture.entryId)).thenReturn(listOf(DevelopmentEntryMedia(id = fixture.mediaId, developmentEntryId = fixture.entryId, contentType = "audio/mp4", data = byteArrayOf(3), durationMs = 100)))
        assertEquals("image/png", fixture.service.photo(fixture.jwt, fixture.organizationId, fixture.child.id, fixture.entryId).contentType)
        assertEquals(100, fixture.service.mediaContent(fixture.jwt, fixture.organizationId, fixture.child.id, fixture.entryId, fixture.mediaId).durationMs)
        entry.photoData = null
        assertThrows(IllegalArgumentException::class.java) { fixture.service.photo(fixture.jwt, fixture.organizationId, fixture.child.id, fixture.entryId) }
    }

    private data class Fixture(
        val organizationId: UUID,
        val categoryId: UUID,
        val entryId: UUID,
        val mediaId: UUID,
        val child: Child,
        val staff: UserProfile,
        val jwt: Jwt,
        val categories: DevelopmentCategoryConfigRepository,
        val entries: DevelopmentEntryRepository,
        val media: DevelopmentEntryMediaRepository,
        val users: UserProfileRepository,
        val service: DevelopmentService,
    )

    private fun fixture(): Fixture {
        val organizationId = UUID.randomUUID(); val categoryId = UUID.randomUUID(); val entryId = UUID.randomUUID(); val mediaId = UUID.randomUUID()
        val jwt = mock(Jwt::class.java); val staff = UserProfile(displayName = "Staff"); val child = Child(organizationId = organizationId, firstName = "Ayu")
        val access = mock(AccessService::class.java); val platformAccess = mock(PlatformAccessService::class.java); val childScopes = mock(ChildScopeService::class.java)
        val categories = mock(DevelopmentCategoryConfigRepository::class.java); val entries = mock(DevelopmentEntryRepository::class.java); val media = mock(DevelopmentEntryMediaRepository::class.java)
        val guardians = mock(GuardianLinkRepository::class.java); val users = mock(UserProfileRepository::class.java); val audits = mock(AuditLogRepository::class.java); val notifications = mock(NotificationService::class.java); val realtime = mock(RealtimePublisher::class.java)
        val scope = AccessScope(staff, Membership(organizationId = organizationId, role = Role.STAFF_ADMIN, active = true), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), readOnly = true)).thenReturn(scope)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(scope)
        `when`(access.require(jwt, organizationId, Role.entries.toSet(), readOnly = true)).thenReturn(scope)
        `when`(childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(guardians.findAllByChildId(child.id)).thenReturn(emptyList())
        return Fixture(organizationId, categoryId, entryId, mediaId, child, staff, jwt, categories, entries, media, users, DevelopmentService(access, platformAccess, childScopes, entries, media, categories, guardians, users, audits, notifications, realtime))
    }
}
