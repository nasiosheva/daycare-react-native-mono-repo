package com.daycare.api.service

import com.daycare.api.domain.InvoiceSource
import com.daycare.api.domain.PrivateTutorType
import com.daycare.api.domain.PrivateTutoringRequestStatus
import com.daycare.api.domain.Role
import com.daycare.api.domain.ServicePlanType
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.ChildPlacementRepository
import com.daycare.api.persistence.Invoice
import com.daycare.api.persistence.InvoiceRepository
import com.daycare.api.persistence.LearningLevelRepository
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.PrivateTutor
import com.daycare.api.persistence.PrivateTutorRepository
import com.daycare.api.persistence.PrivateTutoringRequest
import com.daycare.api.persistence.PrivateTutoringRequestRepository
import com.daycare.api.persistence.PrivateTutoringServiceLearningLevel
import com.daycare.api.persistence.PrivateTutoringServiceLearningLevelRepository
import com.daycare.api.persistence.PrivateTutoringService
import com.daycare.api.persistence.PrivateTutoringServiceRepository
import com.daycare.api.persistence.PrivateTutoringServiceTutor
import com.daycare.api.persistence.PrivateTutoringServiceTutorRepository
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.realtime.RealtimeFlag
import com.daycare.api.realtime.RealtimePublisher
import jakarta.validation.constraints.DecimalMax
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.context.event.EventListener
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.Period
import java.util.UUID

data class UpsertPrivateTutoringServiceRequest(
    val branchId: UUID,
    @field:NotBlank @field:Size(max = 120) val name: String,
    @field:Size(max = 2_000) val description: String = "",
    @field:Min(0) val minAgeMonths: Int,
    @field:Min(0) val maxAgeMonths: Int,
    @field:Min(15) @field:Max(480) val durationMinutes: Int,
    @field:DecimalMax("1000000000") val dailyPrice: BigDecimal? = null,
    @field:DecimalMax("1000000000") val weeklyPrice: BigDecimal? = null,
    @field:DecimalMax("1000000000") val monthlyPrice: BigDecimal? = null,
    val learningLevelIds: Set<UUID>,
    val tutorIds: Set<UUID>,
    val active: Boolean = true,
)

data class UpsertPrivateTutorRequest(
    val type: PrivateTutorType,
    val staffUserId: UUID? = null,
    @field:Size(max = 200) val displayName: String? = null,
    @field:Size(max = 2_000) val bio: String = "",
    val active: Boolean = true,
)

data class CreatePrivateTutoringRequest(val childId: UUID, val pricingType: ServicePlanType, val preferredAt: LocalDateTime? = null, @field:Size(max = 500) val note: String? = null)
data class DecidePrivateTutoringRequest(val approved: Boolean, val tutorId: UUID? = null, val scheduledAt: LocalDateTime? = null, @field:Size(max = 500) val rejectionReason: String? = null)
data class PrivateTutorResponse(val id: UUID, val type: PrivateTutorType, val staffUserId: UUID?, val displayName: String, val bio: String, val active: Boolean)
data class PrivateTutoringServiceResponse(val id: UUID, val branchId: UUID, val name: String, val description: String, val minAgeMonths: Int, val maxAgeMonths: Int, val durationMinutes: Int, val dailyPrice: BigDecimal?, val weeklyPrice: BigDecimal?, val monthlyPrice: BigDecimal?, val learningLevelIds: Set<UUID>, val tutors: List<PrivateTutorResponse>, val active: Boolean)
data class PrivateTutoringRequestResponse(val id: UUID, val childId: UUID, val childName: String, val serviceName: String, val providerName: String?, val durationMinutes: Int, val price: BigDecimal, val pricingType: ServicePlanType, val preferredAt: LocalDateTime?, val scheduledAt: LocalDateTime?, val note: String?, val decisionReason: String?, val status: PrivateTutoringRequestStatus, val invoiceId: UUID?, val invoiceStatus: com.daycare.api.domain.InvoiceStatus?, val createdAt: Instant)

@Service
class PrivateTutoringService(
    private val access: AccessService,
    private val childScopes: ChildScopeService,
    private val identity: IdentityService,
    private val services: PrivateTutoringServiceRepository,
    private val serviceLevels: PrivateTutoringServiceLearningLevelRepository,
    private val tutors: PrivateTutorRepository,
    private val serviceTutors: PrivateTutoringServiceTutorRepository,
    private val requests: PrivateTutoringRequestRepository,
    private val branches: BranchRepository,
    private val learningLevels: LearningLevelRepository,
    private val placements: ChildPlacementRepository,
    private val children: ChildRepository,
    private val memberships: MembershipRepository,
    private val users: UserProfileRepository,
    private val invoices: InvoiceRepository,
    private val notifications: NotificationService,
    private val realtime: RealtimePublisher,
) {
    @Transactional(readOnly = true)
    fun managedServices(jwt: Jwt, organizationId: UUID): List<PrivateTutoringServiceResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), readOnly = true)
        return serviceResponses(services.findAllByOrganizationIdOrderByCreatedAtDesc(organizationId))
    }

    @Transactional
    fun createService(jwt: Jwt, organizationId: UUID, request: UpsertPrivateTutoringServiceRequest): PrivateTutoringServiceResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        validateServiceRequest(organizationId, request)
        val service = services.save(PrivateTutoringService(organizationId = organizationId, branchId = request.branchId, name = request.name.trim(), description = request.description.trim(), minAgeMonths = request.minAgeMonths, maxAgeMonths = request.maxAgeMonths, durationMinutes = request.durationMinutes, dailyPrice = request.dailyPrice, weeklyPrice = request.weeklyPrice, monthlyPrice = request.monthlyPrice, active = request.active))
        replaceServiceLinks(service.id, request.learningLevelIds, request.tutorIds)
        publishManagement(organizationId)
        return serviceResponses(listOf(service)).single()
    }

    @Transactional
    fun updateService(jwt: Jwt, organizationId: UUID, serviceId: UUID, request: UpsertPrivateTutoringServiceRequest): PrivateTutoringServiceResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        validateServiceRequest(organizationId, request)
        val service = service(serviceId, organizationId)
        service.branchId = request.branchId; service.name = request.name.trim(); service.description = request.description.trim(); service.minAgeMonths = request.minAgeMonths; service.maxAgeMonths = request.maxAgeMonths; service.durationMinutes = request.durationMinutes; service.dailyPrice = request.dailyPrice; service.weeklyPrice = request.weeklyPrice; service.monthlyPrice = request.monthlyPrice; service.active = request.active
        replaceServiceLinks(service.id, request.learningLevelIds, request.tutorIds)
        publishManagement(organizationId)
        return serviceResponses(listOf(service)).single()
    }

    @Transactional(readOnly = true)
    fun managedTutors(jwt: Jwt, organizationId: UUID): List<PrivateTutorResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), readOnly = true)
        return tutors.findAllByOrganizationIdOrderByDisplayNameAsc(organizationId).map(::tutorResponse)
    }

    @Transactional
    fun createTutor(jwt: Jwt, organizationId: UUID, request: UpsertPrivateTutorRequest): PrivateTutorResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        val tutor = tutors.save(tutorFromRequest(organizationId, request))
        publishManagement(organizationId)
        return tutorResponse(tutor)
    }

    @Transactional
    fun updateTutor(jwt: Jwt, organizationId: UUID, tutorId: UUID, request: UpsertPrivateTutorRequest): PrivateTutorResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        val tutor = tutor(tutorId, organizationId)
        val replacement = tutorFromRequest(organizationId, request)
        tutor.type = replacement.type; tutor.staffUserId = replacement.staffUserId; tutor.displayName = replacement.displayName; tutor.bio = replacement.bio; tutor.active = replacement.active
        publishManagement(organizationId)
        return tutorResponse(tutor)
    }

    @Transactional(readOnly = true)
    fun parentServices(jwt: Jwt, organizationId: UUID, childId: UUID): List<PrivateTutoringServiceResponse> {
        val scope = access.require(jwt, organizationId, setOf(Role.PARENT), readOnly = true)
        val child = childScopes.requireParentLinkedChild(scope, childId, organizationId)
        return matchingServices(organizationId, child, LocalDate.now())
    }

    @Transactional
    fun createParentRequest(jwt: Jwt, organizationId: UUID, serviceId: UUID, request: CreatePrivateTutoringRequest): PrivateTutoringRequestResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.PARENT))
        val child = childScopes.requireParentLinkedChild(scope, request.childId, organizationId)
        val matching = matchingServices(organizationId, child, request.preferredAt?.toLocalDate() ?: LocalDate.now())
        val service = matching.firstOrNull { it.id == serviceId } ?: throw IllegalArgumentException("Private tutoring service is not available for this child")
        val price = when (request.pricingType) {
            ServicePlanType.DAILY -> service.dailyPrice
            ServicePlanType.WEEKLY -> service.weeklyPrice
            ServicePlanType.MONTHLY -> service.monthlyPrice
        } ?: throw IllegalArgumentException("Selected pricing option is not available for this service")
        val created = requests.save(PrivateTutoringRequest(organizationId = organizationId, branchId = child.branchId, parentUserId = scope.user.id, childId = child.id, privateTutoringServiceId = service.id, serviceName = service.name, durationMinutes = service.durationMinutes, price = price, pricingType = request.pricingType, preferredAt = request.preferredAt, parentNote = request.note?.trim()?.ifBlank { null }))
        notifyStaffAdmins(organizationId, "Pengajuan les privat baru", "Pengajuan les ${service.name} untuk ${child.fullName()} menunggu persetujuan.", "/private-tutoring-admin")
        return requestResponse(created)
    }

    @Transactional(readOnly = true)
    fun parentRequests(jwt: Jwt, organizationId: UUID): List<PrivateTutoringRequestResponse> {
        val scope = access.require(jwt, organizationId, setOf(Role.PARENT), readOnly = true)
        return requests.findAllByOrganizationIdAndParentUserIdOrderByCreatedAtDesc(organizationId, scope.user.id).map(::requestResponse)
    }

    @Transactional(readOnly = true)
    fun managedRequests(jwt: Jwt, organizationId: UUID): List<PrivateTutoringRequestResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), readOnly = true)
        return requests.findAllByOrganizationIdOrderByCreatedAtDesc(organizationId).map(::requestResponse)
    }

    @Transactional
    fun decideRequest(jwt: Jwt, organizationId: UUID, requestId: UUID, decision: DecidePrivateTutoringRequest): PrivateTutoringRequestResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        val request = request(requestId, organizationId)
        require(request.status == PrivateTutoringRequestStatus.PENDING_APPROVAL) { "Private tutoring request cannot be decided" }
        if (!decision.approved) {
            val reason = decision.rejectionReason?.trim()?.ifBlank { null }
            require(reason != null) { "Private tutoring rejection reason is required" }
            request.status = PrivateTutoringRequestStatus.REJECTED; request.decisionReason = reason; request.updatedAt = Instant.now()
            notifications.notify(organizationId, request.parentUserId, "Pengajuan les privat ditolak", reason, "/private-tutoring", setOf(RealtimeFlag.PRIVATE_TUTORING))
            return requestResponse(request)
        }
        val tutorId = requireNotNull(decision.tutorId) { "A tutor is required" }
        val scheduledAt = requireNotNull(decision.scheduledAt) { "A tutoring schedule is required" }
        val child = child(request.childId, organizationId)
        val service = service(request.privateTutoringServiceId, organizationId)
        require(matchingServices(organizationId, child, scheduledAt.toLocalDate()).any { it.id == service.id }) { "Private tutoring service no longer matches this child" }
        val tutor = tutor(tutorId, organizationId)
        require(tutor.active && serviceTutors.existsByPrivateTutoringServiceIdAndPrivateTutorId(service.id, tutor.id)) { "Tutor is not available for this service" }
        requireNoTutorConflict(tutor.id, scheduledAt, request.durationMinutes, request.id)
        val invoice = invoices.save(Invoice(organizationId = organizationId, payerUserId = request.parentUserId, invoiceNumber = "INV-${UUID.randomUUID().toString().take(8).uppercase()}", subtotalAmount = request.price, totalAmount = request.price, dueDate = LocalDate.now().plusDays(2), source = InvoiceSource.PRIVATE_TUTORING, branchId = request.branchId, childId = request.childId, description = "Les privat ${request.serviceName}"))
        request.privateTutorId = tutor.id; request.providerName = tutor.displayName; request.scheduledAt = scheduledAt; request.invoiceId = invoice.id; request.status = PrivateTutoringRequestStatus.PENDING_PAYMENT; request.decisionReason = null; request.updatedAt = Instant.now()
        notifications.notify(organizationId, request.parentUserId, "Pengajuan les privat disetujui", "Jadwal les ${request.serviceName} telah dibuat. Silakan selesaikan pembayaran.", "/private-tutoring", setOf(RealtimeFlag.PRIVATE_TUTORING, RealtimeFlag.INVOICES))
        publishManagement(organizationId)
        return requestResponse(request)
    }

    @Transactional
    fun cancelParentRequest(jwt: Jwt, organizationId: UUID, requestId: UUID): PrivateTutoringRequestResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.PARENT))
        val request = request(requestId, organizationId)
        require(request.parentUserId == scope.user.id) { "Private tutoring request is not available" }
        require(request.status in setOf(PrivateTutoringRequestStatus.PENDING_APPROVAL, PrivateTutoringRequestStatus.PENDING_PAYMENT)) { "Private tutoring request cannot be cancelled" }
        request.invoiceId?.let { invoiceId -> invoices.findById(invoiceId).orElseThrow { IllegalArgumentException("Invoice was not found") }.also { invoice -> require(invoice.status == com.daycare.api.domain.InvoiceStatus.PENDING) { "Paid tutoring cannot be cancelled" }; invoice.status = com.daycare.api.domain.InvoiceStatus.VOID } }
        request.status = PrivateTutoringRequestStatus.CANCELLED; request.updatedAt = Instant.now()
        notifyStaffAdmins(organizationId, "Pengajuan les privat dibatalkan", "Pengajuan les ${request.serviceName} dibatalkan oleh Parent.", "/private-tutoring-admin")
        return requestResponse(request)
    }

    @Transactional
    @EventListener
    fun invoicePaid(event: InvoicePaidEvent) {
        val request = requests.findByInvoiceId(event.invoiceId) ?: return
        if (request.status != PrivateTutoringRequestStatus.PENDING_PAYMENT) return
        request.status = PrivateTutoringRequestStatus.CONFIRMED; request.updatedAt = Instant.now()
        notifications.notify(request.organizationId, request.parentUserId, "Les privat dikonfirmasi", "Pembayaran diterima. Les ${request.serviceName} telah dikonfirmasi.", "/private-tutoring", setOf(RealtimeFlag.PRIVATE_TUTORING, RealtimeFlag.INVOICES))
        request.privateTutorId?.let { tutorId -> tutor(tutorId, request.organizationId).staffUserId?.let { staffUserId -> notifications.notify(request.organizationId, staffUserId, "Jadwal les privat baru", "Anda dijadwalkan mengajar ${request.serviceName}.", "/staff-operations", setOf(RealtimeFlag.PRIVATE_TUTORING)) } }
        publishManagement(request.organizationId)
    }

    @Transactional
    @EventListener
    fun invoiceExpired(event: InvoiceExpiredEvent) {
        val request = requests.findByInvoiceId(event.invoiceId) ?: return
        if (request.status == PrivateTutoringRequestStatus.PENDING_PAYMENT) {
            request.status = PrivateTutoringRequestStatus.CANCELLED; request.updatedAt = Instant.now()
            notifications.notify(request.organizationId, request.parentUserId, "Tagihan les privat kedaluwarsa", "Pengajuan les ${request.serviceName} dibatalkan karena tagihan belum dibayar.", "/private-tutoring", setOf(RealtimeFlag.PRIVATE_TUTORING, RealtimeFlag.INVOICES))
        }
    }

    private fun validateServiceRequest(organizationId: UUID, request: UpsertPrivateTutoringServiceRequest) {
        require(request.minAgeMonths <= request.maxAgeMonths) { "Minimum age must not exceed maximum age" }
        val prices = listOfNotNull(request.dailyPrice, request.weeklyPrice, request.monthlyPrice)
        require(prices.isNotEmpty()) { "At least one price is required" }
        require(prices.all { it > BigDecimal.ZERO }) { "Price must be greater than zero" }
        require(request.learningLevelIds.isNotEmpty()) { "At least one learning level is required" }
        require(request.tutorIds.isNotEmpty()) { "At least one tutor is required" }
        val branch = branches.findById(request.branchId).orElseThrow { IllegalArgumentException("Branch was not found") }
        require(branch.organizationId == organizationId && branch.active) { "Branch is not available" }
        request.learningLevelIds.forEach { levelId ->
            val level = learningLevels.findById(levelId).orElseThrow { IllegalArgumentException("Learning level was not found") }
            require(level.organizationId == organizationId && level.active) { "Learning level is not available" }
        }
        request.tutorIds.forEach { tutorId -> require(tutor(tutorId, organizationId).active) { "Tutor is not active" } }
    }

    private fun replaceServiceLinks(serviceId: UUID, learningLevelIds: Set<UUID>, tutorIds: Set<UUID>) {
        serviceLevels.deleteAllByPrivateTutoringServiceId(serviceId)
        serviceTutors.deleteAllByPrivateTutoringServiceId(serviceId)
        serviceLevels.flush()
        serviceTutors.flush()
        serviceLevels.saveAll(learningLevelIds.map { PrivateTutoringServiceLearningLevel(privateTutoringServiceId = serviceId, learningLevelId = it) })
        serviceTutors.saveAll(tutorIds.map { PrivateTutoringServiceTutor(privateTutoringServiceId = serviceId, privateTutorId = it) })
    }

    private fun tutorFromRequest(organizationId: UUID, request: UpsertPrivateTutorRequest): PrivateTutor = when (request.type) {
        PrivateTutorType.STAFF -> {
            val staffUserId = requireNotNull(request.staffUserId) { "Staff tutor is required" }
            require(memberships.findAllByUserIdAndOrganizationId(staffUserId, organizationId).any { it.active && it.role == Role.STAFF }) { "Tutor must be an active tenant Staff account" }
            val user = users.findById(staffUserId).orElseThrow { IllegalArgumentException("Staff account was not found") }
            PrivateTutor(organizationId = organizationId, type = PrivateTutorType.STAFF, staffUserId = staffUserId, displayName = user.displayName, bio = request.bio.trim(), active = request.active)
        }
        PrivateTutorType.EXTERNAL -> PrivateTutor(organizationId = organizationId, type = PrivateTutorType.EXTERNAL, displayName = request.displayName?.trim()?.ifBlank { null } ?: throw IllegalArgumentException("External tutor name is required"), bio = request.bio.trim(), active = request.active)
    }

    private fun matchingServices(organizationId: UUID, child: com.daycare.api.persistence.Child, date: LocalDate): List<PrivateTutoringServiceResponse> {
        require(child.active && child.organizationId == organizationId) { "Child is not available" }
        val placement = placements.findByChildIdAndEndedOnIsNull(child.id) ?: return emptyList()
        val learningLevelId = placement.learningLevelId ?: return emptyList()
        val ageMonths = Period.between(child.dateOfBirth, date).let { it.years * 12 + it.months }.coerceAtLeast(0)
        return serviceResponses(services.findAllByOrganizationIdAndBranchIdAndActiveTrueOrderByNameAsc(organizationId, child.branchId))
            .filter { service -> learningLevelId in service.learningLevelIds && ageMonths in service.minAgeMonths..service.maxAgeMonths && service.tutors.any { it.active } }
    }

    private fun requireNoTutorConflict(tutorId: UUID, scheduledAt: LocalDateTime, durationMinutes: Int, requestId: UUID) {
        val startsAt = scheduledAt
        val endsAt = scheduledAt.plusMinutes(durationMinutes.toLong())
        val busy = requests.findAllByPrivateTutorIdAndStatusIn(tutorId, setOf(PrivateTutoringRequestStatus.PENDING_PAYMENT, PrivateTutoringRequestStatus.CONFIRMED))
        require(busy.none { existing -> existing.id != requestId && existing.scheduledAt?.let { current -> current.isBefore(endsAt) && current.plusMinutes(existing.durationMinutes.toLong()).isAfter(startsAt) } == true }) { "Tutor already has a private tutoring session at this time" }
    }

    private fun serviceResponses(source: List<PrivateTutoringService>): List<PrivateTutoringServiceResponse> {
        if (source.isEmpty()) return emptyList()
        val ids = source.map { it.id }
        val levelsByService = serviceLevels.findAllByPrivateTutoringServiceIdIn(ids).groupBy { it.privateTutoringServiceId }
        val serviceTutorLinks = serviceTutors.findAllByPrivateTutoringServiceIdIn(ids)
        val tutorsById = tutors.findAllById(serviceTutorLinks.map { it.privateTutorId }.toSet()).associateBy { it.id }
        val tutorIdsByService = serviceTutorLinks.groupBy { it.privateTutoringServiceId }
        return source.map { service -> PrivateTutoringServiceResponse(service.id, service.branchId, service.name, service.description, service.minAgeMonths, service.maxAgeMonths, service.durationMinutes, service.dailyPrice, service.weeklyPrice, service.monthlyPrice, levelsByService[service.id].orEmpty().map { it.learningLevelId }.toSet(), tutorIdsByService[service.id].orEmpty().mapNotNull { tutorsById[it.privateTutorId] }.map(::tutorResponse), service.active) }
    }

    private fun tutorResponse(tutor: PrivateTutor) = PrivateTutorResponse(tutor.id, tutor.type, tutor.staffUserId, tutor.displayName, tutor.bio, tutor.active)
    private fun requestResponse(request: PrivateTutoringRequest): PrivateTutoringRequestResponse {
        val child = child(request.childId, request.organizationId)
        val invoice = request.invoiceId?.let { invoices.findById(it).orElse(null) }
        return PrivateTutoringRequestResponse(request.id, child.id, child.fullName(), request.serviceName, request.providerName, request.durationMinutes, request.price, request.pricingType, request.preferredAt, request.scheduledAt, request.parentNote, request.decisionReason, request.status, request.invoiceId, invoice?.status, request.createdAt)
    }
    private fun service(serviceId: UUID, organizationId: UUID) = services.findById(serviceId).orElseThrow { IllegalArgumentException("Private tutoring service was not found") }.also { require(it.organizationId == organizationId) { "Private tutoring service belongs to a different organization" } }
    private fun tutor(tutorId: UUID, organizationId: UUID) = tutors.findById(tutorId).orElseThrow { IllegalArgumentException("Tutor was not found") }.also { require(it.organizationId == organizationId) { "Tutor belongs to a different organization" } }
    private fun request(requestId: UUID, organizationId: UUID) = requests.findById(requestId).orElseThrow { IllegalArgumentException("Private tutoring request was not found") }.also { require(it.organizationId == organizationId) { "Private tutoring request belongs to a different organization" } }
    private fun child(childId: UUID, organizationId: UUID) = children.findById(childId).orElseThrow { IllegalArgumentException("Child was not found") }.also { require(it.organizationId == organizationId) { "Child belongs to a different organization" } }
    private fun com.daycare.api.persistence.Child.fullName() = listOfNotNull(firstName, lastName).joinToString(" ")
    private fun publishManagement(organizationId: UUID) = realtime.publishToTenantRoles(organizationId, setOf(Role.STAFF_ADMIN), setOf(RealtimeFlag.PRIVATE_TUTORING))
    private fun notifyStaffAdmins(organizationId: UUID, title: String, body: String, actionPath: String) = memberships.findAllByOrganizationId(organizationId).filter { it.active && it.role == Role.STAFF_ADMIN }.forEach { notifications.notify(organizationId, it.userId, title, body, actionPath, setOf(RealtimeFlag.PRIVATE_TUTORING)) }
}
