package com.daycare.api.service

import com.daycare.api.domain.ChildCareLogType
import com.daycare.api.domain.ChildMealAmount
import com.daycare.api.domain.ChildMealType
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
