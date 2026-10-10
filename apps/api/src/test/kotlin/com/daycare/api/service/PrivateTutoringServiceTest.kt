package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.InvoiceStatus
import com.daycare.api.domain.PrivateTutorType
import com.daycare.api.domain.PrivateTutoringRequestStatus
import com.daycare.api.domain.ServicePlanType
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildPlacement
import com.daycare.api.persistence.ChildPlacementRepository
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.InvoiceRepository
import com.daycare.api.persistence.Invoice
import com.daycare.api.persistence.LearningLevel
import com.daycare.api.persistence.LearningLevelRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.PrivateTutor
import com.daycare.api.persistence.PrivateTutorRepository
import com.daycare.api.persistence.PrivateTutoringRequestRepository
import com.daycare.api.persistence.PrivateTutoringRequest
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
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.anyList
import org.mockito.Mockito.any
import org.mockito.Mockito.doReturn
import org.mockito.Mockito.inOrder
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.math.BigDecimal
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.Optional
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
        val matching = PrivateTutoringService(organizationId = organizationId, branchId = child.branchId, name = "Membaca", minAgeMonths = 36, maxAgeMonths = 72, durationMinutes = 60, dailyPrice = java.math.BigDecimal("75000"))
        val wrongAge = PrivateTutoringService(organizationId = organizationId, branchId = child.branchId, name = "Bayi", minAgeMonths = 0, maxAgeMonths = 24, durationMinutes = 30, dailyPrice = java.math.BigDecimal("50000"))
        val tutor = PrivateTutor(organizationId = organizationId, displayName = "Bu Rani")

        `when`(access.require(jwt, organizationId, setOf(Role.PARENT), InstitutionCapability.ACADEMIC_CURRICULUM, readOnly = true)).thenReturn(scope)
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

    @Test
    fun `updating a service flushes removed links before recreating them so unchanged levels and tutors do not collide`() {
        val access = mock(AccessService::class.java)
        val services = mock(PrivateTutoringServiceRepository::class.java)
        val serviceLevels = mock(PrivateTutoringServiceLearningLevelRepository::class.java)
        val tutors = mock(PrivateTutorRepository::class.java)
        val serviceTutors = mock(PrivateTutoringServiceTutorRepository::class.java)
        val branches = mock(BranchRepository::class.java)
        val learningLevels = mock(LearningLevelRepository::class.java)
        val organizationId = UUID.randomUUID()
        val branch = Branch(organizationId = organizationId, active = true)
        val level = LearningLevel(organizationId = organizationId, active = true)
        val tutor = PrivateTutor(organizationId = organizationId, displayName = "Bu Rani", active = true)
        val existing = PrivateTutoringService(organizationId = organizationId, branchId = branch.id, name = "Membaca", minAgeMonths = 24, maxAgeMonths = 72, durationMinutes = 60, dailyPrice = BigDecimal("50000"))
        val jwt = mock(Jwt::class.java)
        val scope = AccessScope(UserProfile(), Membership(organizationId = organizationId, role = Role.STAFF_ADMIN), emptySet(), emptySet())

        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))).thenReturn(scope)
        `when`(services.findById(existing.id)).thenReturn(Optional.of(existing))
        `when`(branches.findById(branch.id)).thenReturn(Optional.of(branch))
        `when`(learningLevels.findById(level.id)).thenReturn(Optional.of(level))
        `when`(tutors.findById(tutor.id)).thenReturn(Optional.of(tutor))
        `when`(serviceLevels.findAllByPrivateTutoringServiceIdIn(anyList())).thenReturn(emptyList())
        `when`(serviceTutors.findAllByPrivateTutoringServiceIdIn(anyList())).thenReturn(emptyList())

        val service = PrivateTutoringService(
            access, mock(ChildScopeService::class.java), mock(IdentityService::class.java), services, serviceLevels, tutors, serviceTutors,
            mock(PrivateTutoringRequestRepository::class.java), branches, learningLevels,
            mock(ChildPlacementRepository::class.java), mock(ChildRepository::class.java), mock(MembershipRepository::class.java), mock(UserProfileRepository::class.java),
            mock(InvoiceRepository::class.java), mock(NotificationService::class.java), mock(RealtimePublisher::class.java),
        )

        service.updateService(jwt, organizationId, existing.id, UpsertPrivateTutoringServiceRequest(branchId = branch.id, name = "Membaca", minAgeMonths = 24, maxAgeMonths = 72, durationMinutes = 60, dailyPrice = BigDecimal("55000"), learningLevelIds = setOf(level.id), tutorIds = setOf(tutor.id)))

        val order = inOrder(serviceLevels, serviceTutors)
        order.verify(serviceLevels).deleteAllByPrivateTutoringServiceId(existing.id)
        order.verify(serviceTutors).deleteAllByPrivateTutoringServiceId(existing.id)
        order.verify(serviceLevels).flush()
        order.verify(serviceTutors).flush()
        order.verify(serviceLevels).saveAll(anyList())
        order.verify(serviceTutors).saveAll(anyList())
    }

    @Test
    fun `admin service and tutor lifecycle covers validation and both tutor types`() {
        val f = PrivateTutoringFixture()
        val jwt = mock(Jwt::class.java)
        f.stubAdmin(jwt)
        `when`(f.services.save(any(PrivateTutoringService::class.java))).thenReturn(f.serviceEntity)
        `when`(f.branches.findById(f.branch.id)).thenReturn(Optional.of(f.branch))
        `when`(f.learningLevels.findById(f.level.id)).thenReturn(Optional.of(f.level))
        `when`(f.tutors.findById(f.externalTutor.id)).thenReturn(Optional.of(f.externalTutor))
        `when`(f.serviceLevels.findAllByPrivateTutoringServiceIdIn(listOf(f.serviceEntity.id))).thenReturn(listOf(PrivateTutoringServiceLearningLevel(privateTutoringServiceId = f.serviceEntity.id, learningLevelId = f.level.id)))
        `when`(f.serviceTutors.findAllByPrivateTutoringServiceIdIn(listOf(f.serviceEntity.id))).thenReturn(listOf(PrivateTutoringServiceTutor(privateTutoringServiceId = f.serviceEntity.id, privateTutorId = f.externalTutor.id)))
        `when`(f.tutors.findAllById(setOf(f.externalTutor.id))).thenReturn(listOf(f.externalTutor))
        val request = f.validServiceRequest()
        val created = f.service.createService(jwt, f.organizationId, request)
        assertEquals("Membaca", created.name)
        assertEquals(1, created.learningLevelIds.size)
        assertEquals(1, created.tutors.size)
        `when`(f.services.findAllByOrganizationIdOrderByCreatedAtDesc(f.organizationId)).thenReturn(listOf(f.serviceEntity))
        `when`(f.serviceLevels.findAllByPrivateTutoringServiceIdIn(listOf(f.serviceEntity.id))).thenReturn(listOf(PrivateTutoringServiceLearningLevel(privateTutoringServiceId = f.serviceEntity.id, learningLevelId = f.level.id)))
        `when`(f.serviceTutors.findAllByPrivateTutoringServiceIdIn(listOf(f.serviceEntity.id))).thenReturn(listOf(PrivateTutoringServiceTutor(privateTutoringServiceId = f.serviceEntity.id, privateTutorId = f.externalTutor.id)))
        `when`(f.tutors.findAllById(setOf(f.externalTutor.id))).thenReturn(listOf(f.externalTutor))
        assertEquals(1, f.service.managedServices(jwt, f.organizationId).size)

        val staffId = UUID.randomUUID()
        val staff = UserProfile(id = staffId, displayName = "Staff Tutor")
        `when`(f.memberships.findAllByUserIdAndOrganizationId(staffId, f.organizationId)).thenReturn(listOf(Membership(userId = staffId, organizationId = f.organizationId, role = Role.STAFF, active = true)))
        `when`(f.users.findById(staffId)).thenReturn(Optional.of(staff))
        `when`(f.tutors.save(any(PrivateTutor::class.java))).thenAnswer { it.arguments[0] }
        val staffTutor = f.service.createTutor(jwt, f.organizationId, UpsertPrivateTutorRequest(PrivateTutorType.STAFF, staffUserId = staffId, bio = "  bio  "))
        assertEquals("Staff Tutor", staffTutor.displayName)
        assertEquals(PrivateTutorType.STAFF, staffTutor.type)
        assertTrue(staffTutor.active)
        val external = f.service.updateTutor(jwt, f.organizationId, f.externalTutor.id, UpsertPrivateTutorRequest(PrivateTutorType.EXTERNAL, displayName = "  Tutor Baru  ", bio = " bio ", active = false))
        assertEquals("Tutor Baru", external.displayName)
        assertTrue(!external.active)

        val invalids = listOf(
            f.validServiceRequest(minAgeMonths = 8, maxAgeMonths = 4),
            f.validServiceRequest(dailyPrice = null, weeklyPrice = null, monthlyPrice = null),
            f.validServiceRequest(dailyPrice = BigDecimal.ZERO),
            f.validServiceRequest(learningLevelIds = emptySet()),
            f.validServiceRequest(tutorIds = emptySet()),
        )
        invalids.forEach { assertThrows(IllegalArgumentException::class.java) { f.service.createService(jwt, f.organizationId, it) } }
        `when`(f.branches.findById(f.branch.id)).thenReturn(Optional.of(Branch(id = f.branch.id, organizationId = f.organizationId, active = false)))
        assertThrows(IllegalArgumentException::class.java) { f.service.createService(jwt, f.organizationId, f.validServiceRequest()) }
        `when`(f.branches.findById(f.branch.id)).thenReturn(Optional.empty())
        assertThrows(IllegalArgumentException::class.java) { f.service.createService(jwt, f.organizationId, f.validServiceRequest()) }
        `when`(f.branches.findById(f.branch.id)).thenReturn(Optional.of(f.branch))
        `when`(f.learningLevels.findById(f.level.id)).thenReturn(Optional.of(LearningLevel(id = f.level.id, organizationId = UUID.randomUUID(), active = true)))
        assertThrows(IllegalArgumentException::class.java) { f.service.createService(jwt, f.organizationId, f.validServiceRequest()) }
        `when`(f.learningLevels.findById(f.level.id)).thenReturn(Optional.empty())
        assertThrows(IllegalArgumentException::class.java) { f.service.createService(jwt, f.organizationId, f.validServiceRequest()) }
        `when`(f.learningLevels.findById(f.level.id)).thenReturn(Optional.of(f.level))
        `when`(f.tutors.findById(f.externalTutor.id)).thenReturn(Optional.of(PrivateTutor(id = f.externalTutor.id, organizationId = f.organizationId, displayName = "Tutor", active = false)))
        assertThrows(IllegalArgumentException::class.java) { f.service.createService(jwt, f.organizationId, f.validServiceRequest()) }
    }

    @Test
    fun `parent request supports each pricing option and missing placement states`() {
        val f = PrivateTutoringFixture()
        val jwt = mock(Jwt::class.java)
        f.stubParent(jwt)
        val service = f.serviceEntity.apply { dailyPrice = BigDecimal("10"); weeklyPrice = BigDecimal("20"); monthlyPrice = BigDecimal("30") }
        `when`(f.childScopes.requireParentLinkedChild(f.parentScope, f.child.id, f.organizationId)).thenReturn(f.child)
        `when`(f.placements.findByChildIdAndEndedOnIsNull(f.child.id)).thenReturn(com.daycare.api.persistence.ChildPlacement(organizationId = f.organizationId, childId = f.child.id, learningLevelId = f.level.id))
        `when`(f.services.findAllByOrganizationIdAndBranchIdAndActiveTrueOrderByNameAsc(f.organizationId, f.child.branchId)).thenReturn(listOf(service))
        `when`(f.serviceLevels.findAllByPrivateTutoringServiceIdIn(listOf(service.id))).thenReturn(listOf(PrivateTutoringServiceLearningLevel(privateTutoringServiceId = service.id, learningLevelId = f.level.id)))
        `when`(f.serviceTutors.findAllByPrivateTutoringServiceIdIn(listOf(service.id))).thenReturn(listOf(PrivateTutoringServiceTutor(privateTutoringServiceId = service.id, privateTutorId = f.externalTutor.id)))
        `when`(f.tutors.findAllById(setOf(f.externalTutor.id))).thenReturn(listOf(f.externalTutor))
        `when`(f.requests.save(any(PrivateTutoringRequest::class.java))).thenAnswer { it.arguments[0] }
        val staffAdminId = UUID.randomUUID()
        `when`(f.memberships.findAllByOrganizationId(f.organizationId)).thenReturn(listOf(Membership(organizationId = f.organizationId, userId = staffAdminId, role = Role.STAFF_ADMIN, active = true), Membership(organizationId = f.organizationId, userId = UUID.randomUUID(), role = Role.STAFF_ADMIN, active = false)))
        `when`(f.children.findById(f.child.id)).thenReturn(Optional.of(f.child))
        listOf(ServicePlanType.DAILY, ServicePlanType.WEEKLY, ServicePlanType.MONTHLY).forEach { type ->
            val result = f.service.createParentRequest(jwt, f.organizationId, service.id, CreatePrivateTutoringRequest(f.child.id, type, note = "  note  "))
            assertEquals(type, result.pricingType)
            assertEquals("note", result.note)
        }
        `when`(f.placements.findByChildIdAndEndedOnIsNull(f.child.id)).thenReturn(null)
        assertTrue(f.service.parentServices(jwt, f.organizationId, f.child.id).isEmpty())
        assertThrows(IllegalArgumentException::class.java) { f.service.createParentRequest(jwt, f.organizationId, service.id, CreatePrivateTutoringRequest(f.child.id, ServicePlanType.DAILY)) }
        `when`(f.placements.findByChildIdAndEndedOnIsNull(f.child.id)).thenReturn(com.daycare.api.persistence.ChildPlacement(organizationId = f.organizationId, childId = f.child.id, learningLevelId = null))
        assertTrue(f.service.parentServices(jwt, f.organizationId, f.child.id).isEmpty())
        `when`(f.placements.findByChildIdAndEndedOnIsNull(f.child.id)).thenReturn(com.daycare.api.persistence.ChildPlacement(organizationId = f.organizationId, childId = f.child.id, learningLevelId = f.level.id))
        service.dailyPrice = null
        assertThrows(IllegalArgumentException::class.java) { f.service.createParentRequest(jwt, f.organizationId, service.id, CreatePrivateTutoringRequest(f.child.id, ServicePlanType.DAILY)) }
        assertThrows(IllegalArgumentException::class.java) { f.service.createParentRequest(jwt, f.organizationId, UUID.randomUUID(), CreatePrivateTutoringRequest(f.child.id, ServicePlanType.WEEKLY)) }
        f.child.active = false
        assertThrows(IllegalArgumentException::class.java) { f.service.parentServices(jwt, f.organizationId, f.child.id) }
    }

    @Test
    fun `staff decisions cover rejection approval conflicts and cancellation`() {
        val f = PrivateTutoringFixture()
        val staffJwt = mock(Jwt::class.java)
        f.stubAdmin(staffJwt)
        val request = PrivateTutoringRequest(organizationId = f.organizationId, branchId = f.child.branchId, parentUserId = f.parent.id, childId = f.child.id, privateTutoringServiceId = f.serviceEntity.id, serviceName = f.serviceEntity.name, durationMinutes = 60, price = BigDecimal("10"))
        `when`(f.requests.findById(request.id)).thenReturn(Optional.of(request))
        `when`(f.children.findById(f.child.id)).thenReturn(Optional.of(f.child))
        val rejected = f.service.decideRequest(staffJwt, f.organizationId, request.id, DecidePrivateTutoringRequest(approved = false, rejectionReason = "  Tidak tersedia  "))
        assertEquals(PrivateTutoringRequestStatus.REJECTED, rejected.status)
        assertEquals("Tidak tersedia", rejected.decisionReason)

        request.status = PrivateTutoringRequestStatus.PENDING_APPROVAL
        assertThrows(IllegalArgumentException::class.java) { f.service.decideRequest(staffJwt, f.organizationId, request.id, DecidePrivateTutoringRequest(approved = false, rejectionReason = "  ")) }
        assertThrows(IllegalArgumentException::class.java) { f.service.decideRequest(staffJwt, f.organizationId, request.id, DecidePrivateTutoringRequest(approved = true)) }
        request.status = PrivateTutoringRequestStatus.CONFIRMED
        assertThrows(IllegalArgumentException::class.java) { f.service.decideRequest(staffJwt, f.organizationId, request.id, DecidePrivateTutoringRequest(approved = false, rejectionReason = "x")) }
        request.status = PrivateTutoringRequestStatus.PENDING_APPROVAL

        val scheduled = LocalDateTime.now().plusDays(1)
        `when`(f.children.findById(f.child.id)).thenReturn(Optional.of(f.child))
        `when`(f.services.findById(f.serviceEntity.id)).thenReturn(Optional.of(f.serviceEntity))
        `when`(f.tutors.findById(f.externalTutor.id)).thenReturn(Optional.of(f.externalTutor))
        `when`(f.serviceTutors.existsByPrivateTutoringServiceIdAndPrivateTutorId(f.serviceEntity.id, f.externalTutor.id)).thenReturn(true)
        `when`(f.placements.findByChildIdAndEndedOnIsNull(f.child.id)).thenReturn(com.daycare.api.persistence.ChildPlacement(organizationId = f.organizationId, childId = f.child.id, learningLevelId = f.level.id))
        `when`(f.services.findAllByOrganizationIdAndBranchIdAndActiveTrueOrderByNameAsc(f.organizationId, f.child.branchId)).thenReturn(listOf(f.serviceEntity))
        `when`(f.serviceLevels.findAllByPrivateTutoringServiceIdIn(listOf(f.serviceEntity.id))).thenReturn(listOf(PrivateTutoringServiceLearningLevel(privateTutoringServiceId = f.serviceEntity.id, learningLevelId = f.level.id)))
        `when`(f.serviceTutors.findAllByPrivateTutoringServiceIdIn(listOf(f.serviceEntity.id))).thenReturn(listOf(PrivateTutoringServiceTutor(privateTutoringServiceId = f.serviceEntity.id, privateTutorId = f.externalTutor.id)))
        `when`(f.tutors.findAllById(setOf(f.externalTutor.id))).thenReturn(listOf(f.externalTutor))
        `when`(f.requests.findAllByPrivateTutorIdAndStatusIn(f.externalTutor.id, setOf(PrivateTutoringRequestStatus.PENDING_PAYMENT, PrivateTutoringRequestStatus.CONFIRMED))).thenReturn(emptyList())
        `when`(f.invoices.save(any(Invoice::class.java))).thenAnswer { it.arguments[0] }
        val approved = f.service.decideRequest(staffJwt, f.organizationId, request.id, DecidePrivateTutoringRequest(approved = true, tutorId = f.externalTutor.id, scheduledAt = scheduled))
        assertEquals(PrivateTutoringRequestStatus.PENDING_PAYMENT, approved.status)
        assertEquals(InvoiceStatus.PENDING, f.invoices.save(Invoice(organizationId = f.organizationId)).status)

        request.status = PrivateTutoringRequestStatus.PENDING_APPROVAL
        `when`(f.placements.findByChildIdAndEndedOnIsNull(f.child.id)).thenReturn(null)
        assertThrows(IllegalArgumentException::class.java) { f.service.decideRequest(staffJwt, f.organizationId, request.id, DecidePrivateTutoringRequest(approved = true, tutorId = f.externalTutor.id, scheduledAt = scheduled)) }
        `when`(f.placements.findByChildIdAndEndedOnIsNull(f.child.id)).thenReturn(com.daycare.api.persistence.ChildPlacement(organizationId = f.organizationId, childId = f.child.id, learningLevelId = f.level.id))
        `when`(f.tutors.findById(f.externalTutor.id)).thenReturn(Optional.of(PrivateTutor(id = f.externalTutor.id, organizationId = f.organizationId, displayName = "Tutor", active = false)))
        assertThrows(IllegalArgumentException::class.java) { f.service.decideRequest(staffJwt, f.organizationId, request.id, DecidePrivateTutoringRequest(approved = true, tutorId = f.externalTutor.id, scheduledAt = scheduled)) }
        `when`(f.tutors.findById(f.externalTutor.id)).thenReturn(Optional.of(f.externalTutor))
        `when`(f.serviceTutors.existsByPrivateTutoringServiceIdAndPrivateTutorId(f.serviceEntity.id, f.externalTutor.id)).thenReturn(false)
        assertThrows(IllegalArgumentException::class.java) { f.service.decideRequest(staffJwt, f.organizationId, request.id, DecidePrivateTutoringRequest(approved = true, tutorId = f.externalTutor.id, scheduledAt = scheduled)) }
        `when`(f.serviceTutors.existsByPrivateTutoringServiceIdAndPrivateTutorId(f.serviceEntity.id, f.externalTutor.id)).thenReturn(true)
        val busy = PrivateTutoringRequest(organizationId = f.organizationId, privateTutorId = f.externalTutor.id, scheduledAt = scheduled.minusMinutes(10), durationMinutes = 60, status = PrivateTutoringRequestStatus.CONFIRMED)
        `when`(f.requests.findAllByPrivateTutorIdAndStatusIn(f.externalTutor.id, setOf(PrivateTutoringRequestStatus.PENDING_PAYMENT, PrivateTutoringRequestStatus.CONFIRMED))).thenReturn(listOf(busy))
        assertThrows(IllegalArgumentException::class.java) { f.service.decideRequest(staffJwt, f.organizationId, request.id, DecidePrivateTutoringRequest(approved = true, tutorId = f.externalTutor.id, scheduledAt = scheduled)) }

        val parentJwt = mock(Jwt::class.java)
        f.stubParent(parentJwt)
        `when`(f.requests.findById(request.id)).thenReturn(Optional.of(request))
        val invoice = Invoice(id = UUID.randomUUID(), organizationId = f.organizationId, status = InvoiceStatus.PENDING)
        request.invoiceId = invoice.id
        `when`(f.invoices.findById(invoice.id)).thenReturn(Optional.of(invoice))
        val cancelled = f.service.cancelParentRequest(parentJwt, f.organizationId, request.id)
        assertEquals(PrivateTutoringRequestStatus.CANCELLED, cancelled.status)
        assertEquals(InvoiceStatus.VOID, invoice.status)
    }

    @Test
    fun `invoice events update tutoring requests and notify assigned staff`() {
        val f = PrivateTutoringFixture()
        val invoiceId = UUID.randomUUID()
        val request = PrivateTutoringRequest(organizationId = f.organizationId, parentUserId = f.parent.id, childId = f.child.id, privateTutoringServiceId = f.serviceEntity.id, serviceName = "Membaca", status = PrivateTutoringRequestStatus.PENDING_PAYMENT, privateTutorId = f.externalTutor.id)
        `when`(f.requests.findByInvoiceId(invoiceId)).thenReturn(request)
        `when`(f.tutors.findById(f.externalTutor.id)).thenReturn(Optional.of(f.externalTutor))
        f.externalTutor.staffUserId = UUID.randomUUID()
        f.service.invoicePaid(InvoicePaidEvent(invoiceId))
        assertEquals(PrivateTutoringRequestStatus.CONFIRMED, request.status)
        verify(f.notifications).notify(f.organizationId, f.externalTutor.staffUserId!!, "Jadwal les privat baru", "Anda dijadwalkan mengajar ${request.serviceName}.", "/staff-operations", setOf(com.daycare.api.realtime.RealtimeFlag.PRIVATE_TUTORING))
        request.status = PrivateTutoringRequestStatus.PENDING_PAYMENT
        f.service.invoiceExpired(InvoiceExpiredEvent(invoiceId))
        assertEquals(PrivateTutoringRequestStatus.CANCELLED, request.status)
        `when`(f.requests.findByInvoiceId(UUID.randomUUID())).thenReturn(null)
        f.service.invoicePaid(InvoicePaidEvent(UUID.randomUUID()))
    }

    @Test
    fun `tutoring guards cover missing references, ownership, invoice state, and event no-ops`() {
        val f = PrivateTutoringFixture()
        val adminJwt = mock(Jwt::class.java)
        f.stubAdmin(adminJwt)
        `when`(f.tutors.findById(f.externalTutor.id)).thenReturn(Optional.of(f.externalTutor))
        assertThrows(IllegalArgumentException::class.java) { f.service.createTutor(adminJwt, f.organizationId, UpsertPrivateTutorRequest(PrivateTutorType.STAFF)) }
        val staffId = UUID.randomUUID()
        `when`(f.memberships.findAllByUserIdAndOrganizationId(staffId, f.organizationId)).thenReturn(emptyList())
        assertThrows(IllegalArgumentException::class.java) { f.service.createTutor(adminJwt, f.organizationId, UpsertPrivateTutorRequest(PrivateTutorType.STAFF, staffUserId = staffId)) }
        `when`(f.memberships.findAllByUserIdAndOrganizationId(staffId, f.organizationId)).thenReturn(listOf(Membership(userId = staffId, organizationId = f.organizationId, role = Role.STAFF, active = true)))
        `when`(f.users.findById(staffId)).thenReturn(Optional.empty())
        assertThrows(IllegalArgumentException::class.java) { f.service.createTutor(adminJwt, f.organizationId, UpsertPrivateTutorRequest(PrivateTutorType.STAFF, staffUserId = staffId)) }
        assertThrows(IllegalArgumentException::class.java) { f.service.createTutor(adminJwt, f.organizationId, UpsertPrivateTutorRequest(PrivateTutorType.EXTERNAL, displayName = "  ")) }

        val parentJwt = mock(Jwt::class.java)
        f.stubParent(parentJwt)
        val request = PrivateTutoringRequest(organizationId = f.organizationId, parentUserId = f.parent.id, childId = f.child.id, privateTutoringServiceId = f.serviceEntity.id, serviceName = "Membaca", status = PrivateTutoringRequestStatus.REJECTED)
        `when`(f.requests.findById(request.id)).thenReturn(Optional.of(request))
        assertThrows(IllegalArgumentException::class.java) { f.service.cancelParentRequest(parentJwt, f.organizationId, request.id) }
        request.status = PrivateTutoringRequestStatus.PENDING_APPROVAL
        request.parentUserId = UUID.randomUUID()
        assertThrows(IllegalArgumentException::class.java) { f.service.cancelParentRequest(parentJwt, f.organizationId, request.id) }
        request.parentUserId = f.parent.id
        request.invoiceId = UUID.randomUUID()
        `when`(f.invoices.findById(request.invoiceId!!)).thenReturn(Optional.empty())
        assertThrows(IllegalArgumentException::class.java) { f.service.cancelParentRequest(parentJwt, f.organizationId, request.id) }
        `when`(f.invoices.findById(request.invoiceId!!)).thenReturn(Optional.of(Invoice(id = request.invoiceId!!, organizationId = f.organizationId, status = InvoiceStatus.PAID)))
        assertThrows(IllegalArgumentException::class.java) { f.service.cancelParentRequest(parentJwt, f.organizationId, request.id) }

        request.status = PrivateTutoringRequestStatus.CONFIRMED
        `when`(f.requests.findByInvoiceId(request.invoiceId!!)).thenReturn(request)
        f.service.invoicePaid(InvoicePaidEvent(request.invoiceId!!))
        f.service.invoiceExpired(InvoiceExpiredEvent(request.invoiceId!!))
        `when`(f.requests.findByInvoiceId(UUID.randomUUID())).thenReturn(null)
        f.service.invoiceExpired(InvoiceExpiredEvent(UUID.randomUUID()))
    }
}

private class PrivateTutoringFixture {
    val organizationId = UUID.randomUUID()
    val access = mock(AccessService::class.java)
    val childScopes = mock(ChildScopeService::class.java)
    val identity = mock(IdentityService::class.java)
    val services = mock(PrivateTutoringServiceRepository::class.java)
    val serviceLevels = mock(PrivateTutoringServiceLearningLevelRepository::class.java)
    val tutors = mock(PrivateTutorRepository::class.java)
    val serviceTutors = mock(PrivateTutoringServiceTutorRepository::class.java)
    val requests = mock(PrivateTutoringRequestRepository::class.java)
    val branches = mock(BranchRepository::class.java)
    val learningLevels = mock(LearningLevelRepository::class.java)
    val placements = mock(ChildPlacementRepository::class.java)
    val children = mock(ChildRepository::class.java)
    val memberships = mock(MembershipRepository::class.java)
    val users = mock(UserProfileRepository::class.java)
    val invoices = mock(InvoiceRepository::class.java)
    val notifications = mock(NotificationService::class.java)
    val realtime = mock(RealtimePublisher::class.java)
    val parent = UserProfile(displayName = "Parent")
    val child = Child(organizationId = organizationId, branchId = UUID.randomUUID(), firstName = "Ayu", dateOfBirth = LocalDate.now().minusYears(4))
    val branch = Branch(id = child.branchId, organizationId = organizationId, active = true)
    val level = LearningLevel(id = UUID.randomUUID(), organizationId = organizationId, active = true)
    val externalTutor = PrivateTutor(organizationId = organizationId, displayName = "Tutor", active = true)
    val serviceEntity = PrivateTutoringService(id = UUID.randomUUID(), organizationId = organizationId, branchId = child.branchId, name = "Membaca", minAgeMonths = 36, maxAgeMonths = 72, durationMinutes = 60, dailyPrice = BigDecimal("10"), weeklyPrice = BigDecimal("20"), monthlyPrice = BigDecimal("30"))
    val adminScope = AccessScope(UserProfile(), Membership(organizationId = organizationId, role = Role.STAFF_ADMIN), emptySet(), emptySet())
    val parentScope = AccessScope(parent, Membership(userId = parent.id, organizationId = organizationId, role = Role.PARENT), emptySet(), emptySet())
    val service = PrivateTutoringService(access, childScopes, identity, services, serviceLevels, tutors, serviceTutors, requests, branches, learningLevels, placements, children, memberships, users, invoices, notifications, realtime)

    fun stubAdmin(jwt: Jwt) { `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.ACADEMIC_CURRICULUM)).thenReturn(adminScope); `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.ACADEMIC_CURRICULUM, readOnly = true)).thenReturn(adminScope) }
    fun stubParent(jwt: Jwt) { `when`(access.require(jwt, organizationId, setOf(Role.PARENT), InstitutionCapability.ACADEMIC_CURRICULUM)).thenReturn(parentScope); `when`(access.require(jwt, organizationId, setOf(Role.PARENT), InstitutionCapability.ACADEMIC_CURRICULUM, readOnly = true)).thenReturn(parentScope) }
    fun validServiceRequest(minAgeMonths: Int = 36, maxAgeMonths: Int = 72, dailyPrice: BigDecimal? = BigDecimal("10"), weeklyPrice: BigDecimal? = null, monthlyPrice: BigDecimal? = null, learningLevelIds: Set<UUID> = setOf(level.id), tutorIds: Set<UUID> = setOf(externalTutor.id)) = UpsertPrivateTutoringServiceRequest(branch.id, "  Membaca  ", "  desc  ", minAgeMonths, maxAgeMonths, 60, dailyPrice, weeklyPrice, monthlyPrice, learningLevelIds, tutorIds)
}
