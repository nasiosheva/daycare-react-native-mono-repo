package com.daycare.api.service

import com.daycare.api.domain.InvitationStatus
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.InstitutionType
import com.daycare.api.domain.Role
import com.daycare.api.domain.TenantPaymentStatus
import com.daycare.api.domain.TenantSubscriptionPlan
import com.daycare.api.domain.TenantSubscriptionStatus
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Invitation
import com.daycare.api.persistence.InvitationRepository
import com.daycare.api.persistence.Organization
import com.daycare.api.persistence.OrganizationRepository
import com.daycare.api.persistence.OrganizationTypeAssignment
import com.daycare.api.persistence.OrganizationTypeAssignmentRepository
import com.daycare.api.persistence.PlatformAdministrator
import com.daycare.api.persistence.PlatformAdministratorRepository
import com.daycare.api.persistence.TenantPayment
import com.daycare.api.persistence.TenantPaymentRepository
import com.daycare.api.persistence.TenantSubscription
import com.daycare.api.persistence.TenantSubscriptionRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.Membership
import jakarta.validation.constraints.DecimalMin
import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.Size
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

data class CreateTenantRequest(
    @field:NotBlank @field:Size(max = 200) val tenantName: String,
    @field:NotBlank @field:Size(max = 200) val branchName: String,
    val institutionTypes: Set<InstitutionType>?,
    val subscriptionPlan: TenantSubscriptionPlan,
    @field:DecimalMin("1") val monthlyFee: BigDecimal?,
    @field:Min(1) @field:Max(12) val trialMonths: Int?,
    @field:NotBlank @field:Size(min = 2, max = 100) val staffAdminName: String,
    @field:Email @field:NotBlank val staffAdminEmail: String,
    @field:NotBlank @field:Size(min = 6, max = 128) val staffAdminPassword: String,
)

data class TenantPaymentResponse(val id: UUID, val amount: BigDecimal, val status: TenantPaymentStatus, val dueDate: LocalDate, val paidAt: Instant?)
data class TenantStaffAdminResponse(val id: UUID, val email: String?, val displayName: String?, val status: String)
data class TenantResponse(
    val id: UUID,
    val name: String,
    val branchName: String?,
    val institutionTypes: Set<InstitutionType>,
    val capabilities: Set<InstitutionCapability>,
    val subscriptionPlan: TenantSubscriptionPlan?,
    val subscriptionStatus: TenantSubscriptionStatus?,
    val periodStart: LocalDate?,
    val periodEnd: LocalDate?,
    val trialEndsAt: LocalDate?,
    val monthlyFee: BigDecimal?,
    val staffAdmin: TenantStaffAdminResponse?,
    val payments: List<TenantPaymentResponse>,
)
data class UpdateTenantRequest(
    @field:NotBlank @field:Size(max = 200) val tenantName: String,
    @field:NotBlank @field:Size(max = 200) val branchName: String,
    val institutionTypes: Set<InstitutionType>,
    val subscriptionPlan: TenantSubscriptionPlan,
    @field:DecimalMin("1") val monthlyFee: BigDecimal?,
)
data class RenewTenantSubscriptionRequest(@field:DecimalMin("1") val monthlyFee: BigDecimal?)
data class CreatePlatformAdminRequest(
    @field:Email @field:NotBlank val email: String,
    @field:NotBlank @field:Size(min = 2, max = 100) val username: String,
    @field:Size(min = 6, max = 128) val password: String,
)

@Service
class PlatformAdministrationService(
    private val platformAccess: PlatformAccessService,
    private val organizations: OrganizationRepository,
    private val organizationTypes: OrganizationTypeAssignmentRepository,
    private val organizationCapabilities: OrganizationCapabilitiesService,
    private val branches: BranchRepository,
    private val subscriptions: TenantSubscriptionRepository,
    private val payments: TenantPaymentRepository,
    private val invitations: InvitationRepository,
    private val memberships: MembershipRepository,
    private val users: UserProfileRepository,
    private val platformAdministrators: PlatformAdministratorRepository,
    private val firebaseAdminIdentity: FirebaseAdminIdentityService,
    private val tenantUserAccounts: TenantUserAccountService,
) {
    @Transactional
    fun tenants(jwt: Jwt): List<TenantResponse> {
        platformAccess.requirePlatformAdmin(jwt)
        return organizations.findAll().map(::tenantResponse)
    }

    @Transactional
    fun tenant(jwt: Jwt, organizationId: UUID): TenantResponse {
        platformAccess.requirePlatformAdmin(jwt)
        return tenantResponse(requireOrganization(organizationId))
    }

    @Transactional
    fun createTenant(jwt: Jwt, request: CreateTenantRequest): TenantResponse {
        platformAccess.requirePlatformAdmin(jwt)
        val organization = organizations.save(Organization(name = request.tenantName.trim()))
        val institutionTypes = request.institutionTypes?.takeIf { it.isNotEmpty() } ?: setOf(InstitutionType.DAYCARE)
        organizationTypes.saveAll(institutionTypes.map { type -> OrganizationTypeAssignment(organizationId = organization.id, type = type) })
        branches.save(Branch(organizationId = organization.id, name = request.branchName.trim()))
        val today = LocalDate.now()
        val isTrial = request.trialMonths != null
        require(isTrial || request.monthlyFee != null) { "Monthly fee is required when tenant does not use a trial" }
        require(!isTrial || request.monthlyFee == null) { "Monthly fee must not be set when tenant uses a trial" }
        val periodEnd = if (isTrial) today.plusMonths(request.trialMonths!!.toLong()).minusDays(1) else today.plusMonths(1).minusDays(1)
        val subscription = subscriptions.save(TenantSubscription(
            organizationId = organization.id,
            plan = request.subscriptionPlan,
            status = if (isTrial) TenantSubscriptionStatus.TRIAL else TenantSubscriptionStatus.PENDING_PAYMENT,
            periodStart = today,
            periodEnd = periodEnd,
            trialEndsAt = if (isTrial) periodEnd else null,
            monthlyFee = request.monthlyFee,
        ))
        if (!isTrial) payments.save(TenantPayment(subscriptionId = subscription.id, organizationId = organization.id, amount = request.monthlyFee!!, dueDate = today))
        val staffAdmin = tenantUserAccounts.create(request.staffAdminName, request.staffAdminEmail, request.staffAdminPassword)
        memberships.save(Membership(userId = staffAdmin.id, organizationId = organization.id, role = Role.STAFF_ADMIN))
        return tenantResponse(organization)
    }

    @Transactional
    fun updateTenant(jwt: Jwt, organizationId: UUID, request: UpdateTenantRequest): TenantResponse {
        platformAccess.requirePlatformAdmin(jwt)
        require(request.institutionTypes.isNotEmpty()) { "At least one institution type is required" }
        val organization = requireOrganization(organizationId)
        organization.name = request.tenantName.trim()
        val branch = branches.findFirstByOrganizationId(organizationId) ?: throw IllegalArgumentException("Tenant branch was not found")
        branch.name = request.branchName.trim()
        organizationTypes.deleteAll(organizationTypes.findAllByOrganizationId(organizationId))
        organizationTypes.flush()
        organizationTypes.saveAll(request.institutionTypes.map { OrganizationTypeAssignment(organizationId = organizationId, type = it) })
        subscriptions.findByOrganizationId(organizationId)?.let { subscription ->
            subscription.plan = request.subscriptionPlan
            if (request.monthlyFee != null) subscription.monthlyFee = request.monthlyFee
        }
        return tenantResponse(organization)
    }

    @Transactional
    fun renewSubscription(jwt: Jwt, organizationId: UUID, request: RenewTenantSubscriptionRequest): TenantResponse {
        platformAccess.requirePlatformAdmin(jwt)
        val organization = requireOrganization(organizationId)
        val subscription = subscriptions.findByOrganizationId(organizationId) ?: throw IllegalArgumentException("Tenant subscription was not found")
        val monthlyFee = request.monthlyFee ?: subscription.monthlyFee ?: throw IllegalArgumentException("Monthly fee is required to renew a tenant subscription")
        val today = LocalDate.now()
        require(subscription.status != TenantSubscriptionStatus.ACTIVE || !subscription.periodEnd.isAfter(today)) { "An active subscription can only be renewed after its current period ends" }
        payments.findAllByOrganizationIdOrderByCreatedAtDesc(organizationId).filter { it.status == TenantPaymentStatus.PENDING }.forEach { it.status = TenantPaymentStatus.VOID }
        subscription.monthlyFee = monthlyFee
        subscription.status = TenantSubscriptionStatus.PENDING_PAYMENT
        subscription.periodStart = today
        subscription.periodEnd = today.plusMonths(1).minusDays(1)
        subscription.trialEndsAt = null
        payments.save(TenantPayment(subscriptionId = subscription.id, organizationId = organizationId, amount = monthlyFee, dueDate = today))
        return tenantResponse(organization)
    }

    @Transactional
    fun setSubscriptionStatus(jwt: Jwt, organizationId: UUID, status: TenantSubscriptionStatus): TenantResponse {
        platformAccess.requirePlatformAdmin(jwt)
        require(status in setOf(TenantSubscriptionStatus.ACTIVE, TenantSubscriptionStatus.SUSPENDED)) { "Only ACTIVE or SUSPENDED subscription status can be set manually" }
        val organization = requireOrganization(organizationId)
        val subscription = subscriptions.findByOrganizationId(organizationId) ?: throw IllegalArgumentException("Tenant subscription was not found")
        if (status == TenantSubscriptionStatus.ACTIVE) require(subscription.status == TenantSubscriptionStatus.SUSPENDED) { "Only a suspended subscription can be reactivated manually" }
        subscription.status = status
        return tenantResponse(organization)
    }

    @Transactional
    fun createPlatformAdmin(jwt: Jwt, request: CreatePlatformAdminRequest): UUID {
        platformAccess.requirePlatformAdmin(jwt)
        val email = request.email.trim().lowercase()
        val username = request.username.trim()
        val firebaseUid = firebaseAdminIdentity.createEmailPasswordUser(email, username, request.password)
        val user = users.save(UserProfile(firebaseUid = firebaseUid, email = email, displayName = username))
        return platformAdministrators.save(PlatformAdministrator(userId = user.id)).userId
    }

    @Transactional
    fun markPaymentPaid(jwt: Jwt, organizationId: UUID, paymentId: UUID): TenantResponse {
        platformAccess.requirePlatformAdmin(jwt)
        val payment = payments.findById(paymentId).orElseThrow { IllegalArgumentException("Tenant payment was not found") }
        require(payment.organizationId == organizationId) { "Tenant payment belongs to a different tenant" }
        require(payment.status == TenantPaymentStatus.PENDING) { "Tenant payment is not awaiting payment" }
        payment.status = TenantPaymentStatus.PAID
        payment.paidAt = Instant.now()
        val subscription = subscriptions.findById(payment.subscriptionId).orElseThrow { IllegalArgumentException("Tenant subscription was not found") }
        subscription.status = TenantSubscriptionStatus.ACTIVE
        val organization = organizations.findById(organizationId).orElseThrow { IllegalArgumentException("Tenant was not found") }
        return tenantResponse(organization)
    }

    @Transactional
    fun voidPayment(jwt: Jwt, organizationId: UUID, paymentId: UUID): TenantResponse {
        platformAccess.requirePlatformAdmin(jwt)
        val payment = payments.findById(paymentId).orElseThrow { IllegalArgumentException("Tenant payment was not found") }
        require(payment.organizationId == organizationId) { "Tenant payment belongs to a different tenant" }
        require(payment.status == TenantPaymentStatus.PENDING) { "Tenant payment is not awaiting payment" }
        payment.status = TenantPaymentStatus.VOID
        return tenantResponse(requireOrganization(organizationId))
    }

    @Transactional
    fun refreshStaffAdminInvitation(jwt: Jwt, organizationId: UUID): TenantResponse {
        platformAccess.requirePlatformAdmin(jwt)
        val invitation = invitations.findAllByOrganizationIdAndStatus(organizationId, InvitationStatus.PENDING)
            .firstOrNull { it.role == Role.STAFF_ADMIN }
            ?: throw IllegalArgumentException("Staff Admin invitation was not found")
        invitation.expiresAt = Instant.now().plusSeconds(604800)
        return tenantResponse(requireOrganization(organizationId))
    }

    @Transactional
    fun cancelStaffAdminInvitation(jwt: Jwt, organizationId: UUID): TenantResponse {
        platformAccess.requirePlatformAdmin(jwt)
        val invitation = invitations.findAllByOrganizationIdAndStatus(organizationId, InvitationStatus.PENDING)
            .firstOrNull { it.role == Role.STAFF_ADMIN }
            ?: throw IllegalArgumentException("Staff Admin invitation was not found")
        invitation.status = InvitationStatus.EXPIRED
        return tenantResponse(requireOrganization(organizationId))
    }

    private fun tenantResponse(organization: Organization): TenantResponse {
        val subscription = subscriptions.findByOrganizationId(organization.id)
        if (subscription?.status == TenantSubscriptionStatus.TRIAL && subscription.trialEndsAt?.isBefore(LocalDate.now()) == true) subscription.status = TenantSubscriptionStatus.PENDING_PAYMENT
        if (subscription?.status == TenantSubscriptionStatus.ACTIVE && subscription.periodEnd.isBefore(LocalDate.now())) subscription.status = TenantSubscriptionStatus.EXPIRED
        val capabilities = organizationCapabilities.forOrganization(organization.id)
        val activeStaffAdmin = memberships.findAllByOrganizationId(organization.id).firstOrNull { it.role == Role.STAFF_ADMIN }?.let { membership ->
            users.findById(membership.userId).orElse(null)?.let { user -> TenantStaffAdminResponse(membership.id, user.email, user.displayName, "ACTIVE") }
        }
        val pendingStaffAdmin = invitations.findAllByOrganizationIdAndStatus(organization.id, InvitationStatus.PENDING)
            .firstOrNull { it.role == Role.STAFF_ADMIN }
            ?.let { invitation -> TenantStaffAdminResponse(invitation.id, invitation.email ?: invitation.phoneNumber, null, "PENDING") }
        return TenantResponse(organization.id, organization.name, branches.findFirstByOrganizationId(organization.id)?.name, capabilities.types, capabilities.capabilities, subscription?.plan, subscription?.status, subscription?.periodStart, subscription?.periodEnd, subscription?.trialEndsAt, subscription?.monthlyFee, activeStaffAdmin ?: pendingStaffAdmin, payments.findAllByOrganizationIdOrderByCreatedAtDesc(organization.id).map { TenantPaymentResponse(it.id, it.amount, it.status, it.dueDate, it.paidAt) })
    }

    private fun requireOrganization(organizationId: UUID) = organizations.findById(organizationId).orElseThrow { IllegalArgumentException("Tenant was not found") }
}
