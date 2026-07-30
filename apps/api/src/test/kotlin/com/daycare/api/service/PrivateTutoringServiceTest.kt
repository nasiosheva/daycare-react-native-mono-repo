package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildPlacement
import com.daycare.api.persistence.ChildPlacementRepository
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.InvoiceRepository
import com.daycare.api.persistence.LearningLevelRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.PrivateTutor
import com.daycare.api.persistence.PrivateTutorRepository
import com.daycare.api.persistence.PrivateTutoringRequestRepository
import com.daycare.api.persistence.PrivateTutoringService
import com.daycare.api.persistence.PrivateTutoringServiceLearningLevel
import com.daycare.api.persistence.PrivateTutoringServiceLearningLevelRepository
import com.daycare.api.persistence.PrivateTutoringServiceRepository
import com.daycare.api.persistence.PrivateTutoringServiceTutor
import com.daycare.api.persistence.PrivateTutoringServiceTutorRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.realtime.RealtimePublisher
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.time.LocalDate
import java.util.UUID

class PrivateTutoringServiceTest {
    @Test
    fun `Parent catalog only returns active service matching child age and learning level`() {
        val access = mock(AccessService::class.java)
        val childScopes = mock(ChildScopeService::class.java)
        val services = mock(PrivateTutoringServiceRepository::class.java)
        val serviceLevels = mock(PrivateTutoringServiceLearningLevelRepository::class.java)
        val tutors = mock(PrivateTutorRepository::class.java)
        val serviceTutors = mock(PrivateTutoringServiceTutorRepository::class.java)
        val placements = mock(ChildPlacementRepository::class.java)
        val organizationId = UUID.randomUUID()
        val parent = UserProfile()
        val scope = AccessScope(parent, Membership(userId = parent.id, organizationId = organizationId, role = Role.PARENT), emptySet(), emptySet())
        val jwt = mock(Jwt::class.java)
        val levelId = UUID.randomUUID()
        val child = Child(organizationId = organizationId, firstName = "Naya", dateOfBirth = LocalDate.now().minusYears(4))
        val matching = PrivateTutoringService(organizationId = organizationId, branchId = child.branchId, name = "Membaca", minAgeMonths = 36, maxAgeMonths = 72, durationMinutes = 60, price = java.math.BigDecimal("75000"))
        val wrongAge = PrivateTutoringService(organizationId = organizationId, branchId = child.branchId, name = "Bayi", minAgeMonths = 0, maxAgeMonths = 24, durationMinutes = 30, price = java.math.BigDecimal("50000"))
        val tutor = PrivateTutor(organizationId = organizationId, displayName = "Bu Rani")

        `when`(access.require(jwt, organizationId, setOf(Role.PARENT), readOnly = true)).thenReturn(scope)
        `when`(childScopes.requireParentLinkedChild(scope, child.id, organizationId)).thenReturn(child)
        `when`(placements.findByChildIdAndEndedOnIsNull(child.id)).thenReturn(ChildPlacement(organizationId = organizationId, childId = child.id, learningLevelId = levelId))
        `when`(services.findAllByOrganizationIdAndBranchIdAndActiveTrueOrderByNameAsc(organizationId, child.branchId)).thenReturn(listOf(matching, wrongAge))
        `when`(serviceLevels.findAllByPrivateTutoringServiceIdIn(listOf(matching.id, wrongAge.id))).thenReturn(listOf(PrivateTutoringServiceLearningLevel(privateTutoringServiceId = matching.id, learningLevelId = levelId), PrivateTutoringServiceLearningLevel(privateTutoringServiceId = wrongAge.id, learningLevelId = levelId)))
        `when`(serviceTutors.findAllByPrivateTutoringServiceIdIn(listOf(matching.id, wrongAge.id))).thenReturn(listOf(PrivateTutoringServiceTutor(privateTutoringServiceId = matching.id, privateTutorId = tutor.id), PrivateTutoringServiceTutor(privateTutoringServiceId = wrongAge.id, privateTutorId = tutor.id)))
        `when`(tutors.findAllById(setOf(tutor.id))).thenReturn(listOf(tutor))

        val service = PrivateTutoringService(
            access, childScopes, mock(IdentityService::class.java), services, serviceLevels, tutors, serviceTutors,
            mock(PrivateTutoringRequestRepository::class.java), mock(BranchRepository::class.java), mock(LearningLevelRepository::class.java),
            placements, mock(ChildRepository::class.java), mock(MembershipRepository::class.java), mock(UserProfileRepository::class.java),
            mock(InvoiceRepository::class.java), mock(NotificationService::class.java), mock(RealtimePublisher::class.java),
        )

        val response = service.parentServices(jwt, organizationId, child.id)

        assertEquals(listOf("Membaca"), response.map { it.name })
        assertEquals(listOf("Bu Rani"), response.single().tutors.map { it.displayName })
    }
}
