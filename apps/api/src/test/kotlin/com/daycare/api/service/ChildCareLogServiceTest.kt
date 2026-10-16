package com.daycare.api.service

// Mories Deo Hutapea,S.E.,S.Kom

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
import org.mockito.ArgumentCaptor
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
        `when`(fixture.access.require(fixture.jwt, fixture.organizationId, Role.entries.toSet(), InstitutionCapability.DAYCARE_OPERATIONS, readOnly = true, allowGraceForRoles = Role.entries.toSet())).thenReturn(parentScope)
        `when`(fixture.childScopes.requireParentLinkedChild(parentScope, fixture.child.id, fixture.organizationId)).thenReturn(fixture.child)
        val stored = ChildCareLog(organizationId = fixture.organizationId, childId = fixture.child.id, type = ChildCareLogType.MEAL, mealType = ChildMealType.LUNCH, mealAmount = ChildMealAmount.ALL)
        `when`(fixture.logs.findAllByOrganizationIdAndChildIdOrderByOccurredAtDesc(fixture.organizationId, fixture.child.id)).thenReturn(listOf(stored))
        val listed = fixture.service.list(fixture.jwt, fixture.organizationId, fixture.child.id)
        assertEquals(1, listed.size)
        assertEquals(ChildCareLogType.MEAL, listed.single().type)
    }

    @Test
    fun `care log validation covers every incompatible field combination`() {
        val fixture = Fixture()
        val napStarted = Instant.now().minusSeconds(100)
        val invalidRequests = listOf(
            CreateChildCareLogRequest(ChildCareLogType.MEAL, Instant.now(), mealType = ChildMealType.LUNCH, mealAmount = ChildMealAmount.ALL, toiletType = ChildToiletType.WET),
            CreateChildCareLogRequest(ChildCareLogType.MEAL, Instant.now(), mealAmount = ChildMealAmount.ALL),
            CreateChildCareLogRequest(ChildCareLogType.MEAL, Instant.now(), mealType = ChildMealType.LUNCH, mealAmount = ChildMealAmount.ALL, napStartedAt = napStarted),
            CreateChildCareLogRequest(ChildCareLogType.MEAL, Instant.now(), mealType = ChildMealType.LUNCH, mealAmount = ChildMealAmount.ALL, napEndedAt = napStarted.plusSeconds(10)),
            CreateChildCareLogRequest(ChildCareLogType.NAP, Instant.now(), napStartedAt = napStarted),
            CreateChildCareLogRequest(ChildCareLogType.NAP, Instant.now(), napEndedAt = napStarted.plusSeconds(10)),
            CreateChildCareLogRequest(ChildCareLogType.NAP, Instant.now(), napStartedAt = napStarted, napEndedAt = napStarted.plusSeconds(10), mealType = ChildMealType.LUNCH, mealAmount = ChildMealAmount.ALL),
            CreateChildCareLogRequest(ChildCareLogType.NAP, Instant.now(), napStartedAt = napStarted, napEndedAt = napStarted.plusSeconds(10), toiletType = ChildToiletType.WET),
            CreateChildCareLogRequest(ChildCareLogType.NAP, Instant.now(), napStartedAt = napStarted, napEndedAt = napStarted.plusSeconds(10), mealAmount = ChildMealAmount.ALL),
            CreateChildCareLogRequest(ChildCareLogType.TOILET, Instant.now()),
            CreateChildCareLogRequest(ChildCareLogType.TOILET, Instant.now(), toiletType = ChildToiletType.WET, napStartedAt = napStarted, napEndedAt = napStarted.plusSeconds(10)),
            CreateChildCareLogRequest(ChildCareLogType.TOILET, Instant.now(), toiletType = ChildToiletType.WET, mealType = ChildMealType.LUNCH),
            CreateChildCareLogRequest(ChildCareLogType.TOILET, Instant.now(), toiletType = ChildToiletType.WET, mealAmount = ChildMealAmount.ALL),
            CreateChildCareLogRequest(ChildCareLogType.TOILET, Instant.now(), toiletType = ChildToiletType.WET, napEndedAt = napStarted.plusSeconds(10)),
            fixture.mealRequest(correctionReason = "tidak boleh tanpa koreksi"),
        )
        invalidRequests.forEach { request -> assertThrows(IllegalArgumentException::class.java) { fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, request) } }
    }

    @Test
    fun `note is trimmed before storage and a blank note is stored as null`() {
        val fixture = Fixture()
        `when`(fixture.logs.save(any(ChildCareLog::class.java))).thenAnswer { it.arguments[0] }

        val withNote = fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, fixture.mealRequest().copy(note = "  Minum ASI  "))
        assertEquals("Minum ASI", withNote.note)

        val withBlankNote = fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, fixture.mealRequest().copy(note = "   "))
        assertEquals(null, withBlankNote.note)
    }

    @Test
    fun `a blank correction reason is allowed without a corrected log and stored as null`() {
        val fixture = Fixture()
        `when`(fixture.logs.save(any(ChildCareLog::class.java))).thenAnswer { it.arguments[0] }

        val stored = fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, fixture.mealRequest(correctionReason = "   "))

        assertEquals(null, stored.correctionReason)
        assertEquals(null, stored.correctsLogId)
    }

    @Test
    fun `care log correction rejects missing original and list supports staff branch`() {
        val fixture = Fixture()
        val missingOriginalId = UUID.randomUUID()
        `when`(fixture.logs.findById(missingOriginalId)).thenReturn(Optional.empty())
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, fixture.mealRequest(missingOriginalId, "Alasan"))
        }

        `when`(fixture.access.require(fixture.jwt, fixture.organizationId, Role.entries.toSet(), InstitutionCapability.DAYCARE_OPERATIONS, readOnly = true, allowGraceForRoles = Role.entries.toSet())).thenReturn(fixture.scope)
        `when`(fixture.childScopes.requireStaffManagedChild(fixture.scope, fixture.child.id, fixture.organizationId)).thenReturn(fixture.child)
        `when`(fixture.logs.findAllByOrganizationIdAndChildIdOrderByOccurredAtDesc(fixture.organizationId, fixture.child.id)).thenReturn(emptyList())
        assertEquals(emptyList<ChildCareLogResponse>(), fixture.service.list(fixture.jwt, fixture.organizationId, fixture.child.id))
    }

    @Test
    fun `create replays the existing log when client mutation id was already stored for the same child`() {
        val fixture = Fixture()
        val mutationId = UUID.randomUUID()
        val existing = ChildCareLog(organizationId = fixture.organizationId, childId = fixture.child.id, type = ChildCareLogType.MEAL, mealType = ChildMealType.LUNCH, mealAmount = ChildMealAmount.ALL, clientMutationId = mutationId)
        `when`(fixture.logs.findByOrganizationIdAndClientMutationId(fixture.organizationId, mutationId)).thenReturn(existing)

        val replayed = fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, fixture.mealRequest(), mutationId)

        assertEquals(existing.id, replayed.id)
        verify(fixture.logs, never()).save(any(ChildCareLog::class.java))
        verify(fixture.audits, never()).save(any(com.daycare.api.persistence.AuditLog::class.java))
    }

    @Test
    fun `create rejects a client mutation id already stored for a different child`() {
        val fixture = Fixture()
        val mutationId = UUID.randomUUID()
        val existing = ChildCareLog(organizationId = fixture.organizationId, childId = UUID.randomUUID(), type = ChildCareLogType.MEAL, mealType = ChildMealType.LUNCH, mealAmount = ChildMealAmount.ALL, clientMutationId = mutationId)
        `when`(fixture.logs.findByOrganizationIdAndClientMutationId(fixture.organizationId, mutationId)).thenReturn(existing)

        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, fixture.mealRequest(), mutationId)
        }
        verify(fixture.logs, never()).save(any(ChildCareLog::class.java))
    }

    @Test
    fun `create stores a new client mutation id so a later retry can be replayed`() {
        val fixture = Fixture()
        val mutationId = UUID.randomUUID()
        `when`(fixture.logs.findByOrganizationIdAndClientMutationId(fixture.organizationId, mutationId)).thenReturn(null)
        `when`(fixture.logs.save(any(ChildCareLog::class.java))).thenAnswer { it.arguments[0] }

        fixture.service.create(fixture.jwt, fixture.organizationId, fixture.child.id, fixture.mealRequest(), mutationId)

        val saved = ArgumentCaptor.forClass(ChildCareLog::class.java)
        verify(fixture.logs).save(saved.capture())
        assertEquals(mutationId, saved.value.clientMutationId)
    }

    @Test
    fun `care log listing fails when daycare capability is not published`() {
        val fixture = Fixture()
        org.mockito.Mockito.doThrow(IllegalArgumentException("unpublished")).`when`(fixture.capabilities).requirePublishedCapability(fixture.organizationId, InstitutionCapability.DAYCARE_OPERATIONS, fixture.child.branchId)
        `when`(fixture.access.require(fixture.jwt, fixture.organizationId, Role.entries.toSet(), InstitutionCapability.DAYCARE_OPERATIONS, readOnly = true, allowGraceForRoles = Role.entries.toSet())).thenReturn(fixture.scope)
        `when`(fixture.childScopes.requireStaffManagedChild(fixture.scope, fixture.child.id, fixture.organizationId)).thenReturn(fixture.child)
        assertThrows(IllegalArgumentException::class.java) { fixture.service.list(fixture.jwt, fixture.organizationId, fixture.child.id) }
    }

    @Test
    fun `care log validator exercises valid payloads and correction ownership branches`() {
        val fixture = Fixture()
        fun validate(request: CreateChildCareLogRequest) {
            val method = ChildCareLogService::class.java.declaredMethods.single { it.name == "validate" }
            method.isAccessible = true
            try { method.invoke(fixture.service, request, fixture.organizationId, fixture.child.id) }
            catch (error: java.lang.reflect.InvocationTargetException) { throw error.targetException }
        }
        validate(fixture.mealRequest())
        val start = Instant.now().minusSeconds(20)
        validate(CreateChildCareLogRequest(ChildCareLogType.NAP, Instant.now(), napStartedAt = start, napEndedAt = start.plusSeconds(10)))
        validate(CreateChildCareLogRequest(ChildCareLogType.TOILET, Instant.now(), toiletType = ChildToiletType.TOILET_ATTEMPT))
        val original = ChildCareLog(organizationId = fixture.organizationId, childId = fixture.child.id)
        `when`(fixture.logs.findById(original.id)).thenReturn(Optional.of(original))
        validate(fixture.mealRequest(original.id, " correction "))
        assertThrows(IllegalArgumentException::class.java) { validate(fixture.mealRequest(original.id, " ")) }
        val foreign = ChildCareLog(organizationId = UUID.randomUUID(), childId = fixture.child.id)
        `when`(fixture.logs.findById(foreign.id)).thenReturn(Optional.of(foreign))
        assertThrows(IllegalArgumentException::class.java) { validate(fixture.mealRequest(foreign.id, "reason")) }
        assertThrows(IllegalArgumentException::class.java) { validate(fixture.mealRequest(correctionReason = "orphan reason")) }
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
            `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), InstitutionCapability.DAYCARE_OPERATIONS, allowGraceForRoles = setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(scope)
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
