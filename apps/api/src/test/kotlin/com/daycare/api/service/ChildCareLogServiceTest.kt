package com.daycare.api.service

import com.daycare.api.domain.ChildCareLogType
import com.daycare.api.domain.ChildMealAmount
import com.daycare.api.domain.ChildMealType
import com.daycare.api.domain.ChildToiletType
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.Role
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildCareLog
import com.daycare.api.persistence.ChildCareLogRepository
import com.daycare.api.persistence.GuardianLink
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.UserProfile
import com.daycare.api.realtime.RealtimeFlag
import com.daycare.api.realtime.RealtimePublisher
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.time.Instant
import java.util.Optional
import java.util.UUID

class ChildCareLogServiceTest {
    @Test
    fun `correction rejects a care log that belongs to another child`() {
        val fixture = Fixture()
        val original = ChildCareLog(organizationId = fixture.organizationId, childId = UUID.randomUUID())
        `when`(fixture.logs.findById(original.id)).thenReturn(Optional.of(original))

        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, fixture.mealRequest(correctsLogId = original.id, correctionReason = "Porsi sebelumnya salah"))
        }

        verify(fixture.logs, never()).save(any(ChildCareLog::class.java))
    }

    @Test
    fun `new care log refreshes only the linked guardians directly`() {
        val fixture = Fixture()
        val guardianId = UUID.randomUUID()
        `when`(fixture.logs.save(any(ChildCareLog::class.java))).thenAnswer { it.arguments[0] }
        `when`(fixture.guardians.findAllByChildId(fixture.child.id)).thenReturn(listOf(GuardianLink(childId = fixture.child.id, userId = guardianId)))

        fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, fixture.mealRequest())

        verify(fixture.realtime).publishToUser(
            fixture.organizationId,
            guardianId,
            setOf(RealtimeFlag.CHILD_CARE_LOGS),
            mapOf("childId" to fixture.child.id),
        )
    }

    @Test
    fun `meal nap and toilet validation accepts only their own fields`() {
        val fixture = Fixture()
        `when`(fixture.logs.save(any(ChildCareLog::class.java))).thenAnswer { it.arguments[0] }
        val napStarted = Instant.now().minusSeconds(3600)
        val nap = fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, CreateChildCareLogRequest(ChildCareLogType.NAP, Instant.now(), napStartedAt = napStarted, napEndedAt = napStarted.plusSeconds(1800)))
        assertEquals(ChildCareLogType.NAP, nap.type)
        val toilet = fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, CreateChildCareLogRequest(ChildCareLogType.TOILET, Instant.now(), toiletType = ChildToiletType.WET))
        assertEquals(ChildCareLogType.TOILET, toilet.type)
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, CreateChildCareLogRequest(ChildCareLogType.NAP, Instant.now(), napStartedAt = napStarted, napEndedAt = napStarted.minusSeconds(1)))
        }
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, CreateChildCareLogRequest(ChildCareLogType.MEAL, Instant.now(), mealType = ChildMealType.LUNCH))
        }
    }

    @Test
    fun `correction requires reason and can correct a log in the same child`() {
        val fixture = Fixture()
        val original = ChildCareLog(organizationId = fixture.organizationId, childId = fixture.child.id)
        `when`(fixture.logs.findById(original.id)).thenReturn(Optional.of(original))
        `when`(fixture.logs.save(any(ChildCareLog::class.java))).thenAnswer { it.arguments[0] }
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, fixture.mealRequest(correctsLogId = original.id))
        }
        val corrected = fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, fixture.mealRequest(correctsLogId = original.id, correctionReason = "Porsi diperbaiki"))
        assertEquals(original.id, corrected.correctsLogId)
        assertEquals("Porsi diperbaiki", corrected.correctionReason)
    }

    @Test
    fun `parent listing is scoped through the linked child and returns stored logs`() {
        val fixture = Fixture()
        val parent = UserProfile()
        val parentScope = AccessScope(parent, Membership(userId = parent.id, organizationId = fixture.organizationId, role = Role.PARENT), emptySet(), emptySet())
        `when`(fixture.access.require(fixture.jwt, fixture.organizationId, Role.entries.toSet(), InstitutionCapability.DAYCARE_OPERATIONS, readOnly = true)).thenReturn(parentScope)
        `when`(fixture.childScopes.requireParentLinkedChild(parentScope, fixture.child.id, fixture.organizationId)).thenReturn(fixture.child)
        val stored = ChildCareLog(organizationId = fixture.organizationId, childId = fixture.child.id, type = ChildCareLogType.MEAL, mealType = ChildMealType.LUNCH, mealAmount = ChildMealAmount.ALL)
        `when`(fixture.logs.findAllByOrganizationIdAndChildIdOrderByOccurredAtDesc(fixture.organizationId, fixture.child.id)).thenReturn(listOf(stored))
        val listed = fixture.service.list(fixture.jwt, fixture.organizationId, fixture.child.id)
        assertEquals(1, listed.size)
        assertEquals(ChildCareLogType.MEAL, listed.single().type)
    }

    private class Fixture {
        val access = mock(AccessService::class.java)
        val childScopes = mock(ChildScopeService::class.java)
        val capabilities = mock(PublishedOfferingCapabilityService::class.java)
        val logs = mock(ChildCareLogRepository::class.java)
        val guardians = mock(GuardianLinkRepository::class.java)
        val audits = mock(AuditLogRepository::class.java)
        val realtime = mock(RealtimePublisher::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val staff = UserProfile()
        val scope = AccessScope(staff, Membership(userId = staff.id, organizationId = organizationId, role = Role.STAFF), emptySet(), emptySet())
        val child = Child(organizationId = organizationId)
        val service = ChildCareLogService(access, childScopes, capabilities, logs, guardians, audits, realtime)

        init {
            `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), InstitutionCapability.DAYCARE_OPERATIONS)).thenReturn(scope)
            `when`(childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        }

        fun mealRequest(correctsLogId: UUID? = null, correctionReason: String? = null) = CreateChildCareLogRequest(
            type = ChildCareLogType.MEAL,
            occurredAt = Instant.now(),
            mealType = ChildMealType.LUNCH,
            mealAmount = ChildMealAmount.ALL,
            correctsLogId = correctsLogId,
            correctionReason = correctionReason,
        )
    }
}
