package com.daycare.api.service

import com.daycare.api.domain.EducationEnrollmentMode
import com.daycare.api.domain.EducationOfferingStatus
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.Role
import com.daycare.api.domain.institutionCapabilities
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.EducationOffering
import com.daycare.api.persistence.EducationOfferingRepository
import com.daycare.api.persistence.OrganizationTypeAssignmentRepository
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

data class EducationOfferingResponse(
    val id: UUID,
    val branchId: UUID,
    val institutionType: String,
    val enrollmentMode: EducationEnrollmentMode,
    val capabilities: Set<InstitutionCapability>,
    val status: EducationOfferingStatus,
    val programCode: String,
    val revision: Long,
)

data class UpsertEducationOfferingRequest(
    val branchId: UUID,
    val institutionType: String,
    val enrollmentMode: EducationEnrollmentMode,
    val programCode: String? = null,
)

data class SetEducationOfferingStatusRequest(val status: EducationOfferingStatus)

data class UiAccessContextResponse(
    val organizationId: UUID,
    val role: Role,
    val active: Boolean,
    val revision: Long,
    val offerings: List<EducationOfferingResponse>,
)

@Service
class EducationOfferingService(
    private val access: AccessService,
    private val offerings: EducationOfferingRepository,
    private val branches: BranchRepository,
    private val organizationTypes: OrganizationTypeAssignmentRepository,
) {
    @Transactional(readOnly = true)
    fun context(jwt: Jwt, organizationId: UUID): UiAccessContextResponse {
        val scope = access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF, Role.PARENT), readOnly = true)
        val visible = offerings.findAllByOrganizationIdOrderByCreatedAtAsc(organizationId)
            .filter { it.status == EducationOfferingStatus.PUBLISHED }
            .map(::response)
        return UiAccessContextResponse(organizationId, scope.membership.role, scope.membership.active, visible.maxOfOrNull { it.revision } ?: 0, visible)
    }

    @Transactional(readOnly = true)
    fun list(jwt: Jwt, organizationId: UUID): List<EducationOfferingResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN), readOnly = true)
        return offerings.findAllByOrganizationIdOrderByCreatedAtAsc(organizationId).map(::response)
    }

    @Transactional
    fun create(jwt: Jwt, organizationId: UUID, request: UpsertEducationOfferingRequest): EducationOfferingResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        val branch = branches.findById(request.branchId).orElseThrow { IllegalArgumentException("Branch was not found") }
        require(branch.organizationId == organizationId && branch.active) { "Branch is not available" }
        val type = request.institutionType.trim().uppercase()
        require(organizationTypes.findAllByOrganizationId(organizationId).any { it.type == type }) { "Institution type is not enabled for this tenant" }
        val mode = expectedMode(type)
        require(request.enrollmentMode == mode) { "Enrollment mode does not match institution type" }
        val programCode = request.programCode?.trim()?.uppercase()?.ifBlank { "DEFAULT" } ?: "DEFAULT"
        val entity = offerings.save(EducationOffering(organizationId = organizationId, branchId = branch.id, institutionType = type, enrollmentMode = mode, capabilities = encode(institutionCapabilities(setOf(type))), programCode = programCode))
        return response(entity)
    }

    @Transactional
    fun changeStatus(jwt: Jwt, organizationId: UUID, offeringId: UUID, request: SetEducationOfferingStatusRequest): EducationOfferingResponse {
        access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN))
        val offering = offering(offeringId, organizationId)
        require(legalTransition(offering.status, request.status)) { "Offering status transition is not allowed" }
        offering.status = request.status
        offering.revision += 1
        offering.updatedAt = Instant.now()
        return response(offering)
    }

    fun requirePublishedCapability(organizationId: UUID, offeringId: UUID, capability: InstitutionCapability): EducationOffering {
        val offering = offering(offeringId, organizationId)
        if (offering.status != EducationOfferingStatus.PUBLISHED || capability !in decode(offering.capabilities)) throw AccessDeniedException("This feature is not enabled for the offering")
        return offering
    }

    private fun offering(id: UUID, organizationId: UUID) = offerings.findById(id).orElseThrow { IllegalArgumentException("Education offering was not found") }.also { require(it.organizationId == organizationId) { "Education offering belongs to a different organization" } }
    private fun expectedMode(type: String) = if (type == "DAYCARE") EducationEnrollmentMode.DAYCARE_SERVICE else EducationEnrollmentMode.SCHOOL_ADMISSION
    private fun legalTransition(from: EducationOfferingStatus, to: EducationOfferingStatus) = when (from) {
        EducationOfferingStatus.DRAFT -> to == EducationOfferingStatus.PUBLISHED
        EducationOfferingStatus.PUBLISHED -> to in setOf(EducationOfferingStatus.PAUSED, EducationOfferingStatus.CLOSED)
        EducationOfferingStatus.PAUSED -> to in setOf(EducationOfferingStatus.PUBLISHED, EducationOfferingStatus.CLOSED)
        EducationOfferingStatus.CLOSED -> to == EducationOfferingStatus.ARCHIVED
        EducationOfferingStatus.ARCHIVED -> false
    }
    private fun response(offering: EducationOffering) = EducationOfferingResponse(offering.id, offering.branchId, offering.institutionType, offering.enrollmentMode, decode(offering.capabilities), offering.status, offering.programCode, offering.revision)
    private fun encode(capabilities: Set<InstitutionCapability>) = capabilities.joinToString(",") { it.name }
    private fun decode(value: String) = value.split(',').mapNotNull { item -> item.takeIf(String::isNotBlank)?.let { runCatching { InstitutionCapability.valueOf(it) }.getOrNull() } }.toSet()
}
