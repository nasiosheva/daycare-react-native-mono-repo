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

    @Test
    fun `platform category lifecycle and duplicate guards are enforced`() {
        val fixture = fixture()
        `when`(fixture.platformAccess.requirePlatformAdmin(fixture.jwt)).thenReturn(fixture.staff)
        val global = DevelopmentCategoryConfig(id = fixture.categoryId, name = "Motorik", active = true)
        `when`(fixture.categories.findAllByOrganizationIdIsNullOrderByNameAsc()).thenReturn(listOf(global))
        assertEquals(true, fixture.service.globalCategories(fixture.jwt).single().system)
        `when`(fixture.categories.existsByOrganizationIdIsNullAndNameIgnoreCase("Bahasa")).thenReturn(false)
        `when`(fixture.categories.save(any(DevelopmentCategoryConfig::class.java))).thenAnswer { it.arguments[0] }
        assertEquals("Bahasa", fixture.service.createGlobalCategory(fixture.jwt, CreateDevelopmentCategoryRequest(" Bahasa ")).name)
        `when`(fixture.categories.findById(fixture.categoryId)).thenReturn(Optional.of(global))
        `when`(fixture.categories.existsByOrganizationIdIsNullAndNameIgnoreCase("Baru")).thenReturn(false)
        assertEquals("Baru", fixture.service.updateGlobalCategory(fixture.jwt, fixture.categoryId, UpdateDevelopmentCategoryRequest(" Baru ", active = false)).name)
        fixture.service.deleteGlobalCategory(fixture.jwt, fixture.categoryId)
        `when`(fixture.categories.existsByOrganizationIdIsNullAndNameIgnoreCase("Bahasa")).thenReturn(true)
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.createGlobalCategory(fixture.jwt, CreateDevelopmentCategoryRequest("Bahasa"))
        }
    }

    @Test
    fun `category and entry validation covers ownership, inactive category and media errors`() {
        val fixture = fixture()
        val local = DevelopmentCategoryConfig(id = fixture.categoryId, organizationId = fixture.organizationId, name = "Motorik", active = false)
        `when`(fixture.categories.findById(fixture.categoryId)).thenReturn(Optional.of(local))
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, CreateDevelopmentEntryRequest(fixture.categoryId.toString(), "Title", "Content"))
        }
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, CreateDevelopmentEntryRequest("not-a-uuid", "Title", "Content"))
        }
        val active = DevelopmentCategoryConfig(id = fixture.categoryId, organizationId = fixture.organizationId, name = "Motorik", active = true)
        `when`(fixture.categories.findById(fixture.categoryId)).thenReturn(Optional.of(active))
        `when`(fixture.entries.save(any(DevelopmentEntry::class.java))).thenAnswer { it.arguments[0] }
        val badBase64 = DevelopmentPhotoInput("image/jpeg", "not-base64")
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, CreateDevelopmentEntryRequest(fixture.categoryId.toString(), "Title", "Content", photo = badBase64))
        }
        val invalidAudio = DevelopmentMediaInput(DevelopmentMediaKind.AUDIO, "audio/wav", Base64.getEncoder().encodeToString(byteArrayOf(1)))
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, CreateDevelopmentEntryRequest(fixture.categoryId.toString(), "Title", "Content", media = listOf(invalidAudio)))
        }
        val entry = DevelopmentEntry(id = fixture.entryId, organizationId = fixture.organizationId, childId = fixture.child.id, authorUserId = fixture.staff.id)
        `when`(fixture.entries.findById(fixture.entryId)).thenReturn(Optional.of(entry))
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.mediaContent(fixture.jwt, fixture.organizationId, fixture.child.id, fixture.entryId, fixture.mediaId)
        }
        val foreign = DevelopmentEntry(id = fixture.entryId, organizationId = UUID.randomUUID(), childId = fixture.child.id, authorUserId = fixture.staff.id, photoData = byteArrayOf(1))
        `when`(fixture.entries.findById(fixture.entryId)).thenReturn(Optional.of(foreign))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.photo(fixture.jwt, fixture.organizationId, fixture.child.id, fixture.entryId) }
    }

    @Test
    fun `parent listing and create media notify linked guardians`() {
        val fixture = fixture()
        val parentScope = AccessScope(UserProfile(), Membership(organizationId = fixture.organizationId, role = Role.PARENT), emptySet(), emptySet())
        `when`(fixture.access.require(fixture.jwt, fixture.organizationId, Role.entries.toSet(), readOnly = true)).thenReturn(parentScope)
        `when`(fixture.childScopes.requireParentLinkedChild(parentScope, fixture.child.id, fixture.organizationId)).thenReturn(fixture.child)
        `when`(fixture.entries.findAllByOrganizationIdAndChildIdOrderByRecordedAtDesc(fixture.organizationId, fixture.child.id)).thenReturn(emptyList())
        assertTrue(fixture.service.list(fixture.jwt, fixture.organizationId, fixture.child.id).isEmpty())
        val guardian = com.daycare.api.persistence.GuardianLink(childId = fixture.child.id, userId = UUID.randomUUID())
        `when`(fixture.access.require(fixture.jwt, fixture.organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(fixture.scope)
        `when`(fixture.categories.findById(fixture.categoryId)).thenReturn(Optional.of(DevelopmentCategoryConfig(id = fixture.categoryId, organizationId = fixture.organizationId, name = "Motorik", active = true)))
        `when`(fixture.entries.save(any(DevelopmentEntry::class.java))).thenAnswer { it.arguments[0] }
        `when`(fixture.guardians.findAllByChildId(fixture.child.id)).thenReturn(listOf(guardian))
        `when`(fixture.users.findById(fixture.staff.id)).thenReturn(Optional.of(fixture.staff))
        fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, CreateDevelopmentEntryRequest(fixture.categoryId.toString(), "Title", "Content"))
        org.mockito.Mockito.verify(fixture.notifications).notify(fixture.organizationId, guardian.userId, "Perkembangan Ayu", "Motorik: Title", null, setOf(com.daycare.api.realtime.RealtimeFlag.DEVELOPMENT))
    }

    @Test
    fun `development category and media edge cases are rejected without leaking tenant data`() {
        val fixture = fixture()
        val local = DevelopmentCategoryConfig(id = fixture.categoryId, organizationId = fixture.organizationId, name = "Motorik", active = true)
        val global = DevelopmentCategoryConfig(name = "Global", active = true)
        `when`(fixture.categories.findById(fixture.categoryId)).thenReturn(Optional.of(local))
        `when`(fixture.categories.existsByOrganizationIdAndNameIgnoreCase(fixture.organizationId, "Baru")).thenReturn(true)
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.updateCategory(fixture.jwt, fixture.organizationId, fixture.categoryId, UpdateDevelopmentCategoryRequest("Baru"))
        }
        assertEquals(false, fixture.service.updateCategory(fixture.jwt, fixture.organizationId, fixture.categoryId, UpdateDevelopmentCategoryRequest(active = false)).active)

        `when`(fixture.categories.findById(fixture.categoryId)).thenReturn(Optional.of(DevelopmentCategoryConfig(id = fixture.categoryId, organizationId = UUID.randomUUID(), name = "Asing")))
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.updateCategory(fixture.jwt, fixture.organizationId, fixture.categoryId, UpdateDevelopmentCategoryRequest())
        }
        `when`(fixture.categories.findById(fixture.categoryId)).thenReturn(Optional.of(local))
        `when`(fixture.entries.existsByOrganizationIdAndCategory(fixture.organizationId, fixture.categoryId.toString())).thenReturn(true)
        assertThrows(IllegalArgumentException::class.java) { fixture.service.deleteCategory(fixture.jwt, fixture.organizationId, fixture.categoryId) }

        `when`(fixture.categories.existsByOrganizationIdIsNullAndNameIgnoreCase("Global")).thenReturn(true)
        assertThrows(IllegalArgumentException::class.java) { fixture.service.createGlobalCategory(fixture.jwt, CreateDevelopmentCategoryRequest("Global")) }
        `when`(fixture.categories.findById(fixture.categoryId)).thenReturn(Optional.of(local))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.updateGlobalCategory(fixture.jwt, fixture.categoryId, UpdateDevelopmentCategoryRequest()) }
        val globalWithId = DevelopmentCategoryConfig(id = fixture.categoryId, name = global.name, active = global.active)
        `when`(fixture.categories.findById(fixture.categoryId)).thenReturn(Optional.of(globalWithId))
        assertEquals(true, fixture.service.updateGlobalCategory(fixture.jwt, fixture.categoryId, UpdateDevelopmentCategoryRequest(active = true)).active)
        `when`(fixture.entries.existsByCategory(fixture.categoryId.toString())).thenReturn(true)
        assertThrows(IllegalArgumentException::class.java) { fixture.service.deleteGlobalCategory(fixture.jwt, fixture.categoryId) }

        val active = DevelopmentCategoryConfig(id = fixture.categoryId, name = global.name, active = global.active)
        `when`(fixture.categories.findById(fixture.categoryId)).thenReturn(Optional.of(active))
        `when`(fixture.categories.existsByOrganizationIdIsNullAndNameIgnoreCase("Same")).thenReturn(false)
        assertEquals("Same", fixture.service.updateGlobalCategory(fixture.jwt, fixture.categoryId, UpdateDevelopmentCategoryRequest("Same" )).name)

        `when`(fixture.categories.findById(fixture.categoryId)).thenReturn(Optional.of(local))
        local.active = true
        `when`(fixture.entries.save(any(DevelopmentEntry::class.java))).thenAnswer { it.arguments[0] }
        `when`(fixture.media.save(any(DevelopmentEntryMedia::class.java))).thenAnswer { it.arguments[0] }
        `when`(fixture.categories.findById(fixture.categoryId)).thenReturn(Optional.of(local))
        `when`(fixture.users.findById(fixture.staff.id)).thenReturn(Optional.empty())
        val audio = DevelopmentMediaInput(DevelopmentMediaKind.AUDIO, "audio/mp4", Base64.getEncoder().encodeToString(byteArrayOf(1, 2)), 250)
        val photo = DevelopmentMediaInput(DevelopmentMediaKind.PHOTO, "image/jpeg", Base64.getEncoder().encodeToString(byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte())))
        val response = fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, CreateDevelopmentEntryRequest(fixture.categoryId.toString(), "Title", "Content", media = listOf(photo, audio)))
        assertEquals("Staf daycare", response.recordedBy)

        val badPhotoInputs = listOf(
            DevelopmentPhotoInput("image/gif", "AA=="),
            DevelopmentPhotoInput("image/png", ""),
            DevelopmentPhotoInput("image/png", Base64.getEncoder().encodeToString(byteArrayOf(1, 2, 3))),
            DevelopmentPhotoInput("image/png", Base64.getEncoder().encodeToString(ByteArray(5 * 1024 * 1024 + 1) { 1 })),
        )
        badPhotoInputs.forEach { input ->
            assertThrows(IllegalArgumentException::class.java) {
                fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, CreateDevelopmentEntryRequest(fixture.categoryId.toString(), "Title", "Content", photo = input))
            }
        }
        val badAudioInputs = listOf(
            DevelopmentMediaInput(DevelopmentMediaKind.AUDIO, "audio/mp4", "not-base64"),
            DevelopmentMediaInput(DevelopmentMediaKind.AUDIO, "audio/mp4", ""),
            DevelopmentMediaInput(DevelopmentMediaKind.AUDIO, "audio/mp4", Base64.getEncoder().encodeToString(ByteArray(10 * 1024 * 1024 + 1) { 1 })),
        )
        badAudioInputs.forEach { input ->
            assertThrows(IllegalArgumentException::class.java) {
                fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, CreateDevelopmentEntryRequest(fixture.categoryId.toString(), "Title", "Content", media = listOf(input)))
            }
        }
    }

    @Test
    fun `development listing and media endpoints cover missing and foreign records`() {
        val fixture = fixture()
        val entry = DevelopmentEntry(id = fixture.entryId, organizationId = fixture.organizationId, childId = fixture.child.id, authorUserId = fixture.staff.id, category = fixture.categoryId.toString())
        `when`(fixture.entries.findAllByOrganizationIdAndChildIdOrderByRecordedAtDesc(fixture.organizationId, fixture.child.id)).thenReturn(listOf(entry))
        `when`(fixture.users.findById(fixture.staff.id)).thenReturn(Optional.empty())
        `when`(fixture.media.findAllByDevelopmentEntryIdOrderByDisplayOrderAsc(entry.id)).thenReturn(emptyList())
        `when`(fixture.categories.findById(fixture.categoryId)).thenReturn(Optional.of(DevelopmentCategoryConfig(id = fixture.categoryId, organizationId = null, name = "Global")))
        assertEquals(1, fixture.service.list(fixture.jwt, fixture.organizationId, fixture.child.id).size)

        `when`(fixture.entries.findById(fixture.entryId)).thenReturn(Optional.empty())
        assertThrows(IllegalArgumentException::class.java) { fixture.service.photo(fixture.jwt, fixture.organizationId, fixture.child.id, fixture.entryId) }
        assertThrows(IllegalArgumentException::class.java) { fixture.service.mediaContent(fixture.jwt, fixture.organizationId, fixture.child.id, fixture.entryId, fixture.mediaId) }

        val foreignChild = DevelopmentEntry(id = fixture.entryId, organizationId = fixture.organizationId, childId = UUID.randomUUID(), authorUserId = fixture.staff.id, category = entry.category, photoData = byteArrayOf(1))
        `when`(fixture.entries.findById(fixture.entryId)).thenReturn(Optional.of(foreignChild))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.photo(fixture.jwt, fixture.organizationId, fixture.child.id, fixture.entryId) }
        val media = DevelopmentEntryMedia(id = fixture.mediaId, developmentEntryId = entry.id, contentType = "audio/mp4", data = byteArrayOf(1))
        `when`(fixture.entries.findById(fixture.entryId)).thenReturn(Optional.of(entry))
        `when`(fixture.media.findAllByDevelopmentEntryIdOrderByDisplayOrderAsc(entry.id)).thenReturn(listOf(media))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.mediaContent(fixture.jwt, fixture.organizationId, fixture.child.id, fixture.entryId, UUID.randomUUID()) }
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
        val access: AccessService,
        val platformAccess: PlatformAccessService,
        val childScopes: ChildScopeService,
        val guardians: GuardianLinkRepository,
        val notifications: NotificationService,
        val scope: AccessScope,
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
        return Fixture(organizationId, categoryId, entryId, mediaId, child, staff, jwt, categories, entries, media, users, DevelopmentService(access, platformAccess, childScopes, entries, media, categories, guardians, users, audits, notifications, realtime), access, platformAccess, childScopes, guardians, notifications, scope)
    }
}
