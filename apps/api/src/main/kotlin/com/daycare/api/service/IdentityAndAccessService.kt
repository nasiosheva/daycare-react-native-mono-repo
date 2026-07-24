package com.daycare.api.service

import com.daycare.api.domain.InvitationStatus
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.Role
import com.daycare.api.domain.RegistrationRole
import com.daycare.api.domain.TenantSubscriptionStatus
import com.daycare.api.persistence.InvitationRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.OrganizationRepository
import com.daycare.api.persistence.PlatformAdministrator
import com.daycare.api.persistence.PlatformAdministratorRepository
import com.daycare.api.persistence.TenantSubscriptionRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

@Service
class IdentityService(
    private val users: UserProfileRepository,
    private val memberships: MembershipRepository,
    private val invitations: InvitationRepository,
) {
    @Transactional
    fun sync(jwt: Jwt): UserProfile {
        val email = jwt.getClaimAsString("email")
        val phoneNumber = jwt.getClaimAsString("phone_number")
        val user = users.findByFirebaseUid(jwt.subject) ?: UserProfile(firebaseUid = jwt.subject, registrationRole = RegistrationRole.PARENT)
        user.displayName = jwt.getClaimAsString("name") ?: email ?: phoneNumber ?: "Pengguna"
        user.email = email
        user.phoneNumber = phoneNumber
        val saved = users.save(user)
        invitations.findAllByStatus(InvitationStatus.PENDING)
            .filter { invitation -> invitation.expiresAt.isAfter(Instant.now()) && ((email != null && invitation.email.equals(email, true)) || (phoneNumber != null && invitation.phoneNumber == phoneNumber)) }
            .forEach { invitation ->
                memberships.save(Membership(userId = saved.id, organizationId = invitation.organizationId, role = invitation.role, branchId = invitation.branchId, classroomId = invitation.classroomId))
                invitation.status = InvitationStatus.ACCEPTED
            }
        return saved
    }
}

data class AccessScope(val user: UserProfile, val membership: Membership, val institutionTypes: Set<String>, val capabilities: Set<InstitutionCapability>)

@Service
class AccessService(
    private val identityService: IdentityService,
    private val memberships: MembershipRepository,
    private val organizations: OrganizationRepository,
    private val platformAccess: PlatformAccessService,
    private val subscriptions: TenantSubscriptionRepository,
    private val organizationCapabilities: OrganizationCapabilitiesService,
) {
    @Transactional
    fun currentUser(jwt: Jwt): CurrentUserResponse {
        val user = identityService.sync(jwt)
        return CurrentUserResponse(user.id, user.displayName, user.registrationRole, platformAccess.isPlatformAdmin(user), memberships.findAllByUserId(user.id).filter { it.active || it.role in setOf(Role.STAFF_ADMIN, Role.STAFF) }.sortedByDescending { it.active }.map { membership ->
            val name = organizations.findById(membership.organizationId).map { it.name }.orElse("Unknown organization")
            val capabilities = organizationCapabilities.forOrganization(membership.organizationId)
            MembershipResponse(membership.organizationId, name, membership.role, membership.active, membership.branchId, membership.classroomId, membership.canManageChildPrograms, membership.canManageDevelopmentCategories, capabilities.types, capabilities.capabilities)
        })
    }

    @Transactional
    fun require(jwt: Jwt, organizationId: UUID, allowedRoles: Set<Role>, requiredCapability: InstitutionCapability? = null, readOnly: Boolean = false): AccessScope {
        val user = identityService.sync(jwt)
        val membership = memberships.findAllByUserIdAndOrganizationId(user.id, organizationId).sortedByDescending { it.active }.firstOrNull { (it.active || (readOnly && it.role in setOf(Role.STAFF_ADMIN, Role.STAFF))) && it.role in allowedRoles }
            ?: throw AccessDeniedException("You do not have permission for this organization")
        val subscription = subscriptions.findByOrganizationId(organizationId)
        if (subscription != null) {
            if (subscription.status == TenantSubscriptionStatus.TRIAL && subscription.trialEndsAt?.isBefore(java.time.LocalDate.now()) == true) subscription.status = TenantSubscriptionStatus.PENDING_PAYMENT
            if (subscription.status !in setOf(TenantSubscriptionStatus.ACTIVE, TenantSubscriptionStatus.TRIAL)) throw AccessDeniedException("Tenant subscription is not active")
        }
        val capabilities = organizationCapabilities.forOrganization(organizationId)
        if (requiredCapability != null && requiredCapability !in capabilities.capabilities) throw AccessDeniedException("This feature is not enabled for the institution")
        return AccessScope(user, membership, capabilities.types, capabilities.capabilities)
    }

    fun requireWritable(scope: AccessScope) {
        if (!scope.membership.active) throw AccessDeniedException("Your tenant access is read-only")
    }
}

@Service
class PlatformAccessService(
    private val identityService: IdentityService,
    private val administrators: PlatformAdministratorRepository,
    @org.springframework.beans.factory.annotation.Value("\${daycare.platform-admin-emails:}") private val bootstrapEmails: String,
) {
    @Transactional
    fun requirePlatformAdmin(jwt: Jwt): UserProfile {
        val user = identityService.sync(jwt)
        if (!isPlatformAdmin(user)) throw AccessDeniedException("You do not have platform administrator access")
        return user
    }

    fun isPlatformAdmin(user: UserProfile): Boolean {
        val configuredEmails = bootstrapEmails.split(',').map { it.trim() }.filter { it.isNotBlank() }.map { it.lowercase() }.toSet()
        if (user.email?.lowercase() in configuredEmails && !administrators.existsById(user.id)) administrators.save(PlatformAdministrator(userId = user.id))
        return administrators.existsById(user.id)
    }
}

data class MembershipResponse(val organizationId: UUID, val organizationName: String, val role: Role, val active: Boolean, val branchId: UUID?, val classroomId: UUID?, val canManageChildPrograms: Boolean, val canManageDevelopmentCategories: Boolean, val institutionTypes: Set<String>, val capabilities: Set<InstitutionCapability>)
data class CurrentUserResponse(val id: UUID, val displayName: String, val registrationRole: RegistrationRole?, val isPlatformAdmin: Boolean, val memberships: List<MembershipResponse>)
