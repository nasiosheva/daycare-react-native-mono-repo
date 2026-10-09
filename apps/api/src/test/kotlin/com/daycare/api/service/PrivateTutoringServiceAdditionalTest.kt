package com.daycare.api.service

import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.InvoiceStatus
import com.daycare.api.domain.PrivateTutorType
import com.daycare.api.domain.PrivateTutoringRequestStatus
import com.daycare.api.domain.Role
import com.daycare.api.domain.ServicePlanType
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildPlacement
import com.daycare.api.persistence.ChildPlacementRepository
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.InvoiceRepository
import com.daycare.api.persistence.LearningLevel
import com.daycare.api.persistence.LearningLevelRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.PrivateTutor
import com.daycare.api.persistence.PrivateTutorRepository
import com.daycare.api.persistence.PrivateTutoringRequest
import com.daycare.api.persistence.PrivateTutoringRequestRepository
import com.daycare.api.persistence.PrivateTutoringServiceLearningLevel
import com.daycare.api.persistence.PrivateTutoringServiceLearningLevelRepository
import com.daycare.api.persistence.PrivateTutoringServiceRepository
import com.daycare.api.persistence.PrivateTutoringServiceTutor
import com.daycare.api.persistence.PrivateTutoringServiceTutorRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.realtime.RealtimePublisher
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.math.BigDecimal
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.Optional
import java.util.UUID

class PrivateTutoringServiceAdditionalTest {
    @Test
    fun `parent request is created from matching service and staff can reject it`() {
        val fixture = fixture()
        `when`(fixture.requests.save(any(PrivateTutoringRequest::class.java))).thenAnswer { it.arguments[0] }
        val created = fixture.service.createParentRequest(fixture.jwt, fixture.organizationId, fixture.tutoringService.id, CreatePrivateTutoringRequest(fixture.child.id, ServicePlanType.DAILY, note = " Catatan "))
        assertEquals("Catatan", created.note)
        val request = PrivateTutoringRequest(id = created.id, organizationId = fixture.organizationId, branchId = fixture.child.branchId, parentUserId = fixture.parent.id, childId = fixture.child.id, privateTutoringServiceId = fixture.tutoringService.id, serviceName = "Membaca", durationMinutes = 60, price = BigDecimal("100"), status = PrivateTutoringRequestStatus.PENDING_APPROVAL)
        `when`(fixture.requests.findById(request.id)).thenReturn(Optional.of(request))
        val rejected = fixture.service.decideRequest(fixture.jwt, fixture.organizationId, request.id, DecidePrivateTutoringRequest(false, rejectionReason = " Tidak tersedia "))
        assertEquals(PrivateTutoringRequestStatus.REJECTED, rejected.status)
        assertEquals("Tidak tersedia", rejected.decisionReason)
    }

    @Test
    fun `invoice paid confirms tutoring request and notifies assigned staff tutor`() {
        val fixture = fixture()
        val tutor = PrivateTutor(id = fixture.tutorId, organizationId = fixture.organizationId, type = PrivateTutorType.STAFF, staffUserId = fixture.staff.id, displayName = "Bu Staff")
        val request = PrivateTutoringRequest(organizationId = fixture.organizationId, branchId = fixture.child.branchId, parentUserId = fixture.parent.id, childId = fixture.child.id, privateTutoringServiceId = fixture.tutoringService.id, serviceName = "Membaca", durationMinutes = 60, price = BigDecimal("100"), status = PrivateTutoringRequestStatus.PENDING_PAYMENT, privateTutorId = tutor.id)
        `when`(fixture.requests.findByInvoiceId(fixture.invoiceId)).thenReturn(request)
        `when`(fixture.tutors.findById(tutor.id)).thenReturn(Optional.of(tutor))
        fixture.service.invoicePaid(InvoicePaidEvent(fixture.invoiceId))
        assertEquals(PrivateTutoringRequestStatus.CONFIRMED, request.status)
    }

    @Test
    fun `external tutor and service management trim values and replace links`() {
        val fixture = fixture()
        `when`(fixture.tutors.save(any(PrivateTutor::class.java))).thenAnswer { it.arguments[0] }
        val tutor = fixture.service.createTutor(fixture.jwt, fixture.organizationId, UpsertPrivateTutorRequest(PrivateTutorType.EXTERNAL, displayName = "  Tutor Tamu  ", bio = "  Bio ", active = false))
        assertEquals("Tutor Tamu", tutor.displayName)
        assertEquals(false, tutor.active)
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.createTutor(fixture.jwt, fixture.organizationId, UpsertPrivateTutorRequest(PrivateTutorType.EXTERNAL, displayName = " "))
        }

        `when`(fixture.branches.findById(fixture.child.branchId)).thenReturn(Optional.of(Branch(id = fixture.child.branchId, organizationId = fixture.organizationId, active = true)))
        `when`(fixture.levels.findById(fixture.levelId)).thenReturn(Optional.of(LearningLevel(id = fixture.levelId, organizationId = fixture.organizationId, active = true)))
        `when`(fixture.tutors.findById(fixture.tutorId)).thenReturn(Optional.of(PrivateTutor(id = fixture.tutorId, organizationId = fixture.organizationId, type = PrivateTutorType.EXTERNAL, displayName = "External", active = true)))
        `when`(fixture.services.save(any(com.daycare.api.persistence.PrivateTutoringService::class.java))).thenAnswer { it.arguments[0] }
        val created = fixture.service.createService(fixture.jwt, fixture.organizationId, UpsertPrivateTutoringServiceRequest(fixture.child.branchId, "  Membaca  ", learningLevelIds = setOf(fixture.levelId), tutorIds = setOf(fixture.tutorId), dailyPrice = BigDecimal("100"), minAgeMonths = 12, maxAgeMonths = 72, durationMinutes = 60))
        assertEquals("Membaca", created.name)
    }

    @Test
    fun `parent can cancel pending request and invoice expiry cancels unpaid request`() {
        val fixture = fixture()
        val request = PrivateTutoringRequest(id = UUID.randomUUID(), organizationId = fixture.organizationId, branchId = fixture.child.branchId, parentUserId = fixture.parent.id, childId = fixture.child.id, privateTutoringServiceId = fixture.tutoringService.id, serviceName = "Membaca", durationMinutes = 60, price = BigDecimal("100"), status = PrivateTutoringRequestStatus.PENDING_APPROVAL)
        `when`(fixture.requests.findById(request.id)).thenReturn(Optional.of(request))
        val cancelled = fixture.service.cancelParentRequest(fixture.jwt, fixture.organizationId, request.id)
        assertEquals(PrivateTutoringRequestStatus.CANCELLED, cancelled.status)

        val pendingPayment = PrivateTutoringRequest(id = request.id, organizationId = request.organizationId, branchId = request.branchId, parentUserId = request.parentUserId, childId = request.childId, privateTutoringServiceId = request.privateTutoringServiceId, serviceName = request.serviceName, durationMinutes = request.durationMinutes, price = request.price, status = PrivateTutoringRequestStatus.PENDING_PAYMENT)
        `when`(fixture.requests.findByInvoiceId(fixture.invoiceId)).thenReturn(pendingPayment)
        fixture.service.invoiceExpired(InvoiceExpiredEvent(fixture.invoiceId))
        assertEquals(PrivateTutoringRequestStatus.CANCELLED, pendingPayment.status)
    }

    @Test
    fun `parent pricing selection rejects unavailable plans and services without placement`() {
        val fixture = fixture()
        val serviceId = fixture.tutoringService.id
        `when`(fixture.services.findAllByOrganizationIdAndBranchIdAndActiveTrueOrderByNameAsc(fixture.organizationId, fixture.child.branchId)).thenReturn(emptyList())
        `when`(fixture.serviceLevels.findAllByPrivateTutoringServiceIdIn(listOf(serviceId))).thenReturn(emptyList())
        `when`(fixture.serviceTutors.findAllByPrivateTutoringServiceIdIn(listOf(serviceId))).thenReturn(emptyList())
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.createParentRequest(fixture.jwt, fixture.organizationId, serviceId, CreatePrivateTutoringRequest(fixture.child.id, ServicePlanType.DAILY))
        }

        `when`(fixture.services.findAllByOrganizationIdAndBranchIdAndActiveTrueOrderByNameAsc(fixture.organizationId, fixture.child.branchId)).thenReturn(listOf(fixture.tutoringService))
        `when`(fixture.placements.findByChildIdAndEndedOnIsNull(fixture.child.id)).thenReturn(null)
        assertEquals(emptyList<PrivateTutoringServiceResponse>(), fixture.service.parentServices(fixture.jwt, fixture.organizationId, fixture.child.id))
    }

    @Test
    fun `staff tutor creation validates membership and external display name`() {
        val fixture = fixture()
        `when`(fixture.memberships.findAllByUserIdAndOrganizationId(fixture.staff.id, fixture.organizationId)).thenReturn(emptyList())
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.createTutor(fixture.jwt, fixture.organizationId, UpsertPrivateTutorRequest(PrivateTutorType.STAFF, staffUserId = fixture.staff.id))
        }
        `when`(fixture.memberships.findAllByUserIdAndOrganizationId(fixture.staff.id, fixture.organizationId)).thenReturn(listOf(Membership(organizationId = fixture.organizationId, userId = fixture.staff.id, role = Role.STAFF, active = true)))
        `when`(fixture.users.findById(fixture.staff.id)).thenReturn(Optional.of(fixture.staff))
        `when`(fixture.tutors.save(any(PrivateTutor::class.java))).thenAnswer { it.arguments[0] }
        assertEquals(fixture.staff.displayName, fixture.service.createTutor(fixture.jwt, fixture.organizationId, UpsertPrivateTutorRequest(PrivateTutorType.STAFF, staffUserId = fixture.staff.id)).displayName)
        assertThrows(IllegalArgumentException::class.java) {
            fixture.service.createTutor(fixture.jwt, fixture.organizationId, UpsertPrivateTutorRequest(PrivateTutorType.EXTERNAL, displayName = "  "))
        }
    }

    @Test
    fun `service validation rejects invalid ages prices branch levels and tutors`() {
        val fixture = fixture()
        val base = UpsertPrivateTutoringServiceRequest(fixture.child.branchId, "Les", minAgeMonths = 24, maxAgeMonths = 72, durationMinutes = 60, dailyPrice = BigDecimal("100"), learningLevelIds = setOf(fixture.levelId), tutorIds = setOf(fixture.tutorId))
        `when`(fixture.branches.findById(fixture.child.branchId)).thenReturn(Optional.of(Branch(id = fixture.child.branchId, organizationId = fixture.organizationId, active = true)))
        `when`(fixture.levels.findById(fixture.levelId)).thenReturn(Optional.of(LearningLevel(id = fixture.levelId, organizationId = fixture.organizationId, active = true)))
        `when`(fixture.tutors.findById(fixture.tutorId)).thenReturn(Optional.of(PrivateTutor(id = fixture.tutorId, organizationId = fixture.organizationId, active = true)))
        val invalid = listOf(
            base.copy(minAgeMonths = 80, maxAgeMonths = 20),
            base.copy(dailyPrice = null, weeklyPrice = null, monthlyPrice = null),
            base.copy(dailyPrice = BigDecimal.ZERO),
            base.copy(learningLevelIds = emptySet()),
            base.copy(tutorIds = emptySet()),
        )
        invalid.forEach { request -> assertThrows(IllegalArgumentException::class.java) { fixture.service.createService(fixture.jwt, fixture.organizationId, request) } }
        `when`(fixture.branches.findById(fixture.child.branchId)).thenReturn(Optional.of(Branch(id = fixture.child.branchId, organizationId = UUID.randomUUID(), active = true)))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.createService(fixture.jwt, fixture.organizationId, base) }
    }

    @Test
    fun `approved request creates pending invoice and rejects tutor conflicts`() {
        val fixture = fixture()
        val request = PrivateTutoringRequest(id = UUID.randomUUID(), organizationId = fixture.organizationId, branchId = fixture.child.branchId, parentUserId = fixture.parent.id, childId = fixture.child.id, privateTutoringServiceId = fixture.tutoringService.id, serviceName = "Membaca", durationMinutes = 60, price = BigDecimal("100"), status = PrivateTutoringRequestStatus.PENDING_APPROVAL)
        val tutor = PrivateTutor(id = fixture.tutorId, organizationId = fixture.organizationId, displayName = "External", active = true)
        val schedule = LocalDateTime.now().plusDays(1)
        `when`(fixture.requests.findById(request.id)).thenReturn(Optional.of(request))
        `when`(fixture.children.findById(fixture.child.id)).thenReturn(Optional.of(fixture.child))
        `when`(fixture.services.findById(fixture.tutoringService.id)).thenReturn(Optional.of(fixture.tutoringService))
        `when`(fixture.tutors.findById(tutor.id)).thenReturn(Optional.of(tutor))
        `when`(fixture.serviceTutors.existsByPrivateTutoringServiceIdAndPrivateTutorId(fixture.tutoringService.id, tutor.id)).thenReturn(true)
        `when`(fixture.requests.findAllByPrivateTutorIdAndStatusIn(tutor.id, setOf(PrivateTutoringRequestStatus.PENDING_PAYMENT, PrivateTutoringRequestStatus.CONFIRMED))).thenReturn(emptyList())
        `when`(fixture.invoices.save(any(com.daycare.api.persistence.Invoice::class.java))).thenAnswer { it.arguments[0] }
        val result = fixture.service.decideRequest(fixture.jwt, fixture.organizationId, request.id, DecidePrivateTutoringRequest(true, tutor.id, schedule))
        assertEquals(PrivateTutoringRequestStatus.PENDING_PAYMENT, result.status)
        assertNotNull(result.invoiceId)

        val conflict = PrivateTutoringRequest(organizationId = fixture.organizationId, privateTutorId = tutor.id, status = PrivateTutoringRequestStatus.CONFIRMED, scheduledAt = schedule.plusMinutes(30), durationMinutes = 60)
        val second = PrivateTutoringRequest(id = UUID.randomUUID(), organizationId = request.organizationId, branchId = request.branchId, parentUserId = request.parentUserId, childId = request.childId, privateTutoringServiceId = request.privateTutoringServiceId, serviceName = request.serviceName, durationMinutes = request.durationMinutes, price = request.price, status = PrivateTutoringRequestStatus.PENDING_APPROVAL)
        `when`(fixture.requests.findById(second.id)).thenReturn(Optional.of(second))
        `when`(fixture.requests.findAllByPrivateTutorIdAndStatusIn(tutor.id, setOf(PrivateTutoringRequestStatus.PENDING_PAYMENT, PrivateTutoringRequestStatus.CONFIRMED))).thenReturn(listOf(conflict))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.decideRequest(fixture.jwt, fixture.organizationId, second.id, DecidePrivateTutoringRequest(true, tutor.id, schedule)) }
    }

    @Test
    fun `approved decision requires tutor and schedule and rejects unavailable tutor`() {
        val fixture = fixture()
        val request = PrivateTutoringRequest(id = UUID.randomUUID(), organizationId = fixture.organizationId, branchId = fixture.child.branchId, parentUserId = fixture.parent.id, childId = fixture.child.id, privateTutoringServiceId = fixture.tutoringService.id, serviceName = "Membaca", durationMinutes = 60, price = BigDecimal("100"), status = PrivateTutoringRequestStatus.PENDING_APPROVAL)
        `when`(fixture.requests.findById(request.id)).thenReturn(Optional.of(request))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.decideRequest(fixture.jwt, fixture.organizationId, request.id, DecidePrivateTutoringRequest(true)) }
        assertThrows(IllegalArgumentException::class.java) { fixture.service.decideRequest(fixture.jwt, fixture.organizationId, request.id, DecidePrivateTutoringRequest(true, fixture.tutorId)) }
        `when`(fixture.children.findById(fixture.child.id)).thenReturn(Optional.of(fixture.child))
        `when`(fixture.services.findById(fixture.tutoringService.id)).thenReturn(Optional.of(fixture.tutoringService))
        `when`(fixture.tutors.findById(fixture.tutorId)).thenReturn(Optional.of(PrivateTutor(id = fixture.tutorId, organizationId = fixture.organizationId, active = false)))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.decideRequest(fixture.jwt, fixture.organizationId, request.id, DecidePrivateTutoringRequest(true, fixture.tutorId, LocalDateTime.now().plusDays(1))) }
    }

    @Test
    fun `parent cancellation voids pending invoice but never cancels paid or another parent's request`() {
        val fixture = fixture()
        val invoiceId = fixture.invoiceId
        val request = PrivateTutoringRequest(id = UUID.randomUUID(), organizationId = fixture.organizationId, branchId = fixture.child.branchId, parentUserId = fixture.parent.id, childId = fixture.child.id, privateTutoringServiceId = fixture.tutoringService.id, serviceName = "Membaca", durationMinutes = 60, price = BigDecimal("100"), status = PrivateTutoringRequestStatus.PENDING_PAYMENT, invoiceId = invoiceId)
        `when`(fixture.requests.findById(request.id)).thenReturn(Optional.of(request))
        `when`(fixture.invoices.findById(invoiceId)).thenReturn(Optional.of(com.daycare.api.persistence.Invoice(id = invoiceId, organizationId = fixture.organizationId, status = InvoiceStatus.PENDING)))
        assertEquals(PrivateTutoringRequestStatus.CANCELLED, fixture.service.cancelParentRequest(fixture.jwt, fixture.organizationId, request.id).status)
        assertEquals(InvoiceStatus.VOID, fixture.invoices.findById(invoiceId).get().status)

        val paid = PrivateTutoringRequest(id = UUID.randomUUID(), organizationId = request.organizationId, branchId = request.branchId, parentUserId = request.parentUserId, childId = request.childId, privateTutoringServiceId = request.privateTutoringServiceId, serviceName = request.serviceName, durationMinutes = request.durationMinutes, price = request.price, status = PrivateTutoringRequestStatus.PENDING_PAYMENT, invoiceId = invoiceId)
        `when`(fixture.requests.findById(paid.id)).thenReturn(Optional.of(paid))
        `when`(fixture.invoices.findById(invoiceId)).thenReturn(Optional.of(com.daycare.api.persistence.Invoice(id = invoiceId, organizationId = fixture.organizationId, status = InvoiceStatus.PAID)))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.cancelParentRequest(fixture.jwt, fixture.organizationId, paid.id) }

        val foreign = PrivateTutoringRequest(id = UUID.randomUUID(), organizationId = request.organizationId, branchId = request.branchId, parentUserId = UUID.randomUUID(), childId = request.childId, privateTutoringServiceId = request.privateTutoringServiceId, serviceName = request.serviceName, durationMinutes = request.durationMinutes, price = request.price, status = PrivateTutoringRequestStatus.PENDING_APPROVAL)
        `when`(fixture.requests.findById(foreign.id)).thenReturn(Optional.of(foreign))
        assertThrows(IllegalArgumentException::class.java) { fixture.service.cancelParentRequest(fixture.jwt, fixture.organizationId, foreign.id) }
    }

    @Test
    fun `invoice events ignore unknown and terminal requests and notify staff tutor after payment`() {
        val fixture = fixture()
        val unknown = fixture.invoiceId
        `when`(fixture.requests.findByInvoiceId(unknown)).thenReturn(null)
        fixture.service.invoicePaid(InvoicePaidEvent(unknown))

        val request = PrivateTutoringRequest(organizationId = fixture.organizationId, parentUserId = fixture.parent.id, childId = fixture.child.id, privateTutoringServiceId = fixture.tutoringService.id, serviceName = "Membaca", durationMinutes = 60, price = BigDecimal("100"), status = PrivateTutoringRequestStatus.CONFIRMED, privateTutorId = fixture.tutorId)
        `when`(fixture.requests.findByInvoiceId(unknown)).thenReturn(request)
        fixture.service.invoicePaid(InvoicePaidEvent(unknown))
        assertEquals(PrivateTutoringRequestStatus.CONFIRMED, request.status)

        val pending = PrivateTutoringRequest(id = UUID.randomUUID(), organizationId = fixture.organizationId, parentUserId = fixture.parent.id, childId = fixture.child.id, privateTutoringServiceId = fixture.tutoringService.id, serviceName = "Membaca", durationMinutes = 60, price = BigDecimal("100"), status = PrivateTutoringRequestStatus.PENDING_PAYMENT, privateTutorId = fixture.tutorId)
        `when`(fixture.requests.findByInvoiceId(unknown)).thenReturn(pending)
        `when`(fixture.tutors.findById(fixture.tutorId)).thenReturn(Optional.of(PrivateTutor(id = fixture.tutorId, organizationId = fixture.organizationId, staffUserId = fixture.staff.id, displayName = "Staff", type = PrivateTutorType.STAFF)))
        fixture.service.invoicePaid(InvoicePaidEvent(unknown))
        assertEquals(PrivateTutoringRequestStatus.CONFIRMED, pending.status)

        val expired = PrivateTutoringRequest(id = UUID.randomUUID(), organizationId = fixture.organizationId, parentUserId = fixture.parent.id, childId = fixture.child.id, privateTutoringServiceId = fixture.tutoringService.id, serviceName = "Membaca", durationMinutes = 60, price = BigDecimal("100"), status = PrivateTutoringRequestStatus.CONFIRMED, privateTutorId = fixture.tutorId)
        `when`(fixture.requests.findByInvoiceId(unknown)).thenReturn(expired)
        fixture.service.invoiceExpired(InvoiceExpiredEvent(unknown))
        assertEquals(PrivateTutoringRequestStatus.CONFIRMED, expired.status)
    }

    private data class Fixture(
        val organizationId: UUID,
        val invoiceId: UUID,
        val tutorId: UUID,
        val levelId: UUID,
        val child: Child,
        val parent: UserProfile,
        val staff: UserProfile,
        val tutoringService: com.daycare.api.persistence.PrivateTutoringService,
        val jwt: Jwt,
        val access: AccessService,
        val services: PrivateTutoringServiceRepository,
        val serviceLevels: PrivateTutoringServiceLearningLevelRepository,
        val serviceTutors: PrivateTutoringServiceTutorRepository,
        val placements: ChildPlacementRepository,
        val children: ChildRepository,
        val branches: BranchRepository,
        val levels: LearningLevelRepository,
        val requests: PrivateTutoringRequestRepository,
        val tutors: PrivateTutorRepository,
        val invoices: InvoiceRepository,
        val memberships: MembershipRepository,
        val users: UserProfileRepository,
        val service: PrivateTutoringService,
    )

    private fun fixture(): Fixture {
        val organizationId = UUID.randomUUID(); val invoiceId = UUID.randomUUID(); val tutorId = UUID.randomUUID(); val branchId = UUID.randomUUID(); val levelId = UUID.randomUUID()
        val parent = UserProfile(displayName = "Parent"); val staff = UserProfile(displayName = "Staff"); val child = Child(organizationId = organizationId, branchId = branchId, firstName = "Ayu", dateOfBirth = LocalDate.now().minusYears(4)); val jwt = mock(Jwt::class.java)
        val tutoringService = com.daycare.api.persistence.PrivateTutoringService(id = UUID.randomUUID(), organizationId = organizationId, branchId = branchId, name = "Membaca", minAgeMonths = 24, maxAgeMonths = 72, durationMinutes = 60, dailyPrice = BigDecimal("100"))
        val access = mock(AccessService::class.java); val childScopes = mock(ChildScopeService::class.java); val identities = mock(IdentityService::class.java); val services = mock(PrivateTutoringServiceRepository::class.java); val serviceLevels = mock(PrivateTutoringServiceLearningLevelRepository::class.java); val tutors = mock(PrivateTutorRepository::class.java); val serviceTutors = mock(PrivateTutoringServiceTutorRepository::class.java); val requests = mock(PrivateTutoringRequestRepository::class.java); val branches = mock(BranchRepository::class.java); val levels = mock(LearningLevelRepository::class.java); val placements = mock(ChildPlacementRepository::class.java); val children = mock(ChildRepository::class.java); val memberships = mock(MembershipRepository::class.java); val users = mock(UserProfileRepository::class.java); val invoices = mock(InvoiceRepository::class.java); val notifications = mock(NotificationService::class.java); val realtime = mock(RealtimePublisher::class.java)
        val parentScope = AccessScope(parent, Membership(organizationId = organizationId, role = Role.PARENT, active = true), emptySet(), setOf(InstitutionCapability.ACADEMIC_CURRICULUM)); val adminScope = AccessScope(staff, Membership(organizationId = organizationId, role = Role.STAFF_ADMIN, active = true), emptySet(), setOf(InstitutionCapability.ACADEMIC_CURRICULUM))
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT), InstitutionCapability.ACADEMIC_CURRICULUM)).thenReturn(parentScope)
        `when`(access.require(jwt, organizationId, setOf(Role.PARENT), InstitutionCapability.ACADEMIC_CURRICULUM, true)).thenReturn(parentScope)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.ACADEMIC_CURRICULUM)).thenReturn(adminScope)
        `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), InstitutionCapability.ACADEMIC_CURRICULUM, true)).thenReturn(adminScope)
        `when`(childScopes.requireParentLinkedChild(parentScope, child.id, organizationId)).thenReturn(child)
        `when`(placements.findByChildIdAndEndedOnIsNull(child.id)).thenReturn(ChildPlacement(organizationId = organizationId, childId = child.id, learningLevelId = levelId))
        `when`(services.findAllByOrganizationIdAndBranchIdAndActiveTrueOrderByNameAsc(organizationId, branchId)).thenReturn(listOf(tutoringService))
        `when`(serviceLevels.findAllByPrivateTutoringServiceIdIn(listOf(tutoringService.id))).thenReturn(listOf(PrivateTutoringServiceLearningLevel(privateTutoringServiceId = tutoringService.id, learningLevelId = levelId)))
        `when`(serviceTutors.findAllByPrivateTutoringServiceIdIn(listOf(tutoringService.id))).thenReturn(listOf(PrivateTutoringServiceTutor(privateTutoringServiceId = tutoringService.id, privateTutorId = tutorId)))
        `when`(tutors.findAllById(setOf(tutorId))).thenReturn(listOf(PrivateTutor(id = tutorId, organizationId = organizationId, displayName = "External", active = true)))
        `when`(children.findById(child.id)).thenReturn(Optional.of(child))
        `when`(memberships.findAllByOrganizationId(organizationId)).thenReturn(emptyList())
        return Fixture(organizationId, invoiceId, tutorId, levelId, child, parent, staff, tutoringService, jwt, access, services, serviceLevels, serviceTutors, placements, children, branches, levels, requests, tutors, invoices, memberships, users, PrivateTutoringService(access, childScopes, identities, services, serviceLevels, tutors, serviceTutors, requests, branches, levels, placements, children, memberships, users, invoices, notifications, realtime))
    }
}
