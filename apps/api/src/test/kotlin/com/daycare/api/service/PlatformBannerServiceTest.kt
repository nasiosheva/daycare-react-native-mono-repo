package com.daycare.api.service

// Mories Deo Hutapea,S.E.,S.Kom

import com.daycare.api.domain.PlatformBannerStatus
import com.daycare.api.domain.RegistrationRole
import com.daycare.api.domain.ParentActionType
import com.daycare.api.persistence.PlatformBanner
import com.daycare.api.persistence.PlatformBannerRepository
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.any
import org.mockito.Mockito.eq
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.time.Instant
import java.util.Optional
import java.util.UUID

class PlatformBannerServiceTest {
    @Test
    fun `platform admin can create update publish and close banner`() {
        val f = fixture()
        val imageUrl = "https://cdn.example/promo.jpg"
        val created = f.service.create(f.jwt, UpsertPlatformBannerRequest(" Info ", " Isi ", imageUrl, ParentActionType.OPEN_BROWSER, "https://example.org/promo"))
        assertEquals(PlatformBannerStatus.DRAFT, created.status)
        assertEquals("Info", created.title)
        assertEquals(imageUrl, created.imageUrl)
        assertEquals(ParentActionType.OPEN_BROWSER, created.actionType)
        assertEquals("https://example.org/promo", created.actionTarget)

        val entity = PlatformBanner(id = created.id, createdByUserId = f.admin.id, title = "Info", body = "Isi", imageUrl = imageUrl)
        `when`(f.banners.findById(created.id)).thenReturn(Optional.of(entity))
        val updated = f.service.update(f.jwt, created.id, UpsertPlatformBannerRequest("Baru", "Isi baru", "https://cdn.example/updated.jpg", ParentActionType.OPEN_APP_PAGE, "BOOKING"))
        assertEquals("Baru", updated.title)
        assertEquals("https://cdn.example/updated.jpg", updated.imageUrl)
        assertEquals(ParentActionType.OPEN_APP_PAGE, updated.actionType)
        assertEquals("BOOKING", updated.actionTarget)
        val published = f.service.publish(f.jwt, created.id, SchedulePlatformBannerRequest())
        assertEquals(PlatformBannerStatus.PUBLISHED, published.status)
        `when`(f.banners.findAllByStatusOrderByCreatedAtDesc(PlatformBannerStatus.PUBLISHED)).thenReturn(listOf(entity))
        assertEquals(1, f.service.listForParent(f.parentJwt).size)
        assertEquals(PlatformBannerStatus.CLOSED, f.service.close(f.jwt, created.id).status)
        `when`(f.banners.findAllByStatusOrderByCreatedAtDesc(PlatformBannerStatus.PUBLISHED)).thenReturn(emptyList())
        assertEquals(0, f.service.listForParent(f.parentJwt).size)
    }

    @Test
    fun `platform banner rejects non https image urls`() {
        val f = fixture()
        assertThrows(IllegalArgumentException::class.java) {
            f.service.create(f.jwt, UpsertPlatformBannerRequest("Info", "Isi", "http://cdn.example/promo.jpg"))
        }
    }

    @Test
    fun `platform banner action is optional and validates browser and app destinations`() {
        val f = fixture()
        val noAction = f.service.create(f.jwt, UpsertPlatformBannerRequest("Info", "Isi", "https://cdn.example/promo.jpg"))
        assertEquals(ParentActionType.NONE, noAction.actionType)
        assertEquals(null, noAction.actionTarget)
        assertThrows(IllegalArgumentException::class.java) {
            f.service.create(f.jwt, UpsertPlatformBannerRequest("Info", "Isi", "https://cdn.example/promo.jpg", ParentActionType.OPEN_BROWSER, "javascript:alert(1)"))
        }
        assertThrows(IllegalArgumentException::class.java) {
            f.service.create(f.jwt, UpsertPlatformBannerRequest("Info", "Isi", "https://cdn.example/promo.jpg", ParentActionType.OPEN_APP_PAGE, "/children?childId=unsafe"))
        }
    }

    @Test
    fun `parent feed requires registered parent and scheduled banners stay hidden until publication`() {
        val f = fixture()
        `when`(f.banners.findAllByStatusOrderByCreatedAtDesc(PlatformBannerStatus.PUBLISHED)).thenReturn(emptyList())
        assertEquals(emptyList<PlatformBannerResponse>(), f.service.listForParent(f.parentJwt))
        verify(f.banners).findAllByStatusOrderByCreatedAtDesc(PlatformBannerStatus.PUBLISHED)
        assertThrows(org.springframework.security.access.AccessDeniedException::class.java) {
            f.service.listForParent(f.nonParentJwt)
        }
    }

    @Test
    fun `scheduled banner becomes published when due`() {
        val f = fixture()
        val scheduled = PlatformBanner(status = PlatformBannerStatus.SCHEDULED, scheduledAt = Instant.now().minusSeconds(1))
        `when`(f.banners.findAllByStatusAndScheduledAtLessThanEqual(eq(PlatformBannerStatus.SCHEDULED) ?: PlatformBannerStatus.SCHEDULED, any(Instant::class.java) ?: Instant.EPOCH)).thenReturn(listOf(scheduled))
        f.service.publishScheduled()
        assertEquals(PlatformBannerStatus.PUBLISHED, scheduled.status)
        assertNotNull(scheduled.publishedAt)
    }

    @Test
    fun `expired published and scheduled banners are hidden and automatically closed`() {
        val f = fixture()
        val expiredPublished = PlatformBanner(status = PlatformBannerStatus.PUBLISHED, publishedAt = Instant.now().minusSeconds(3_600), expiresAt = Instant.now().minusSeconds(60))
        val expiredScheduled = PlatformBanner(status = PlatformBannerStatus.SCHEDULED, scheduledAt = Instant.now().minusSeconds(3_600), expiresAt = Instant.now().minusSeconds(60))
        `when`(f.banners.findAllByStatusOrderByCreatedAtDesc(PlatformBannerStatus.PUBLISHED)).thenReturn(listOf(expiredPublished))
        `when`(f.banners.findAllByStatusInAndExpiresAtLessThanEqual(eq(setOf(PlatformBannerStatus.SCHEDULED, PlatformBannerStatus.PUBLISHED)) ?: emptySet(), any(Instant::class.java) ?: Instant.EPOCH)).thenReturn(listOf(expiredPublished, expiredScheduled))

        assertEquals(emptyList<PlatformBannerResponse>(), f.service.listForParent(f.parentJwt))
        f.service.publishScheduled()

        assertEquals(PlatformBannerStatus.CLOSED, expiredPublished.status)
        assertEquals(PlatformBannerStatus.CLOSED, expiredScheduled.status)
        assertNotNull(expiredPublished.closedAt)
        assertNotNull(expiredScheduled.closedAt)
        assertNull(expiredScheduled.scheduledAt)
    }

    @Test
    fun `manually closing a scheduled banner clears its pending publication timestamp`() {
        val f = fixture()
        val scheduledAt = Instant.now().plusSeconds(3_600)
        val banner = PlatformBanner(status = PlatformBannerStatus.SCHEDULED, scheduledAt = scheduledAt)
        `when`(f.banners.findById(banner.id)).thenReturn(Optional.of(banner))

        val closed = f.service.close(f.jwt, banner.id)

        assertEquals(PlatformBannerStatus.CLOSED, closed.status)
        assertNull(closed.scheduledAt)
        assertNotNull(closed.closedAt)
    }

    @Test
    fun `scheduled publication cannot be after banner expiry`() {
        val f = fixture()
        val banner = PlatformBanner(expiresAt = Instant.now().plusSeconds(3_600))
        `when`(f.banners.findById(banner.id)).thenReturn(Optional.of(banner))

        assertThrows(IllegalArgumentException::class.java) {
            f.service.publish(f.jwt, banner.id, SchedulePlatformBannerRequest(Instant.now().plusSeconds(7_200)))
        }
    }

    @Test
    fun `past scheduled publication is rejected instead of publishing immediately`() {
        val f = fixture()
        val banner = PlatformBanner(status = PlatformBannerStatus.DRAFT)
        `when`(f.banners.findById(banner.id)).thenReturn(Optional.of(banner))

        assertThrows(IllegalArgumentException::class.java) {
            f.service.publish(f.jwt, banner.id, SchedulePlatformBannerRequest(Instant.now().minusSeconds(1)))
        }
        assertEquals(PlatformBannerStatus.DRAFT, banner.status)
    }

    private fun fixture(): Fixture {
        val jwt = mock(Jwt::class.java)
        val parentJwt = mock(Jwt::class.java)
        val nonParentJwt = mock(Jwt::class.java)
        val admin = UserProfile(id = UUID.randomUUID(), registrationRole = RegistrationRole.PARENT)
        val parent = UserProfile(id = UUID.randomUUID(), registrationRole = RegistrationRole.PARENT)
        val nonParent = UserProfile(id = UUID.randomUUID())
        val platformAccess = mock(PlatformAccessService::class.java)
        val identity = mock(IdentityService::class.java)
        val banners = mock(PlatformBannerRepository::class.java)
        `when`(platformAccess.requirePlatformAdmin(jwt)).thenReturn(admin)
        `when`(identity.sync(parentJwt)).thenReturn(parent)
        `when`(identity.sync(nonParentJwt)).thenReturn(nonParent)
        `when`(banners.save(any(PlatformBanner::class.java))).thenAnswer { it.arguments[0] }
        return Fixture(PlatformBannerService(platformAccess, identity, banners), jwt, parentJwt, nonParentJwt, admin, banners)
    }

    private data class Fixture(val service: PlatformBannerService, val jwt: Jwt, val parentJwt: Jwt, val nonParentJwt: Jwt, val admin: UserProfile, val banners: PlatformBannerRepository)
}
