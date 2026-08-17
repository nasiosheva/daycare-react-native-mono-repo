package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildHealthRecord
import com.daycare.api.persistence.ChildHealthRecordRepository
import com.daycare.api.persistence.GuardianLink
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.UserProfile
import com.daycare.api.realtime.RealtimeFlag
import org.junit.jupiter.api.Test
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.util.UUID

class ChildHealthServiceTest {
    @Test
    fun `upserting a health record notifies every guardian`() {
        val access = mock(AccessService::class.java)
        val childScopes = mock(ChildScopeService::class.java)
        val records = mock(ChildHealthRecordRepository::class.java)
        val audits = mock(AuditLogRepository::class.java)
        val guardianLinks = mock(GuardianLinkRepository::class.java)
        val notifications = mock(NotificationService::class.java)
        val jwt = mock(Jwt::class.java)
        val organizationId = UUID.randomUUID()
        val child = Child(organizationId = organizationId, firstName = "Alya", lastName = "Putri")
        val parentUserId = UUID.randomUUID()
        val scope = AccessScope(UserProfile(), Membership(), emptySet(), emptySet())
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF))).thenReturn(scope)
        `when`(childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(records.findByOrganizationIdAndChildId(organizationId, child.id)).thenReturn(null)
        `when`(records.save(any(ChildHealthRecord::class.java))).thenAnswer { it.arguments[0] }
        `when`(guardianLinks.findAllByChildId(child.id)).thenReturn(listOf(GuardianLink(childId = child.id, userId = parentUserId)))
        val service = ChildHealthService(access, childScopes, records, audits, guardianLinks, notifications)

        service.upsert(jwt, organizationId, child.id, UpsertChildHealthRecordRequest(allergies = "Kacang"))

        verify(notifications).notify(
            organizationId, parentUserId, "Catatan kesehatan Alya Putri diperbarui",
            "Staf telah memperbarui informasi kesehatan Alya Putri.",
            "/child-health?childId=${child.id}",
            setOf(RealtimeFlag.HEALTH),
        )
    }
}
