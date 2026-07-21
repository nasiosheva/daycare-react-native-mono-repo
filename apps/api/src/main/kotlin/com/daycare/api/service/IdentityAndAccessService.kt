package com.daycare.api.service

import com.daycare.api.domain.InvitationStatus
import com.daycare.api.domain.Role
import com.daycare.api.persistence.InvitationRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.OrganizationRepository
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
        val user = users.findByFirebaseUid(jwt.subject) ?: UserProfile(firebaseUid = jwt.subject)
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

data class AccessScope(val user: UserProfile, val membership: Membership)

@Service
class AccessService(
    private val identityService: IdentityService,
    private val memberships: MembershipRepository,
    private val organizations: OrganizationRepository,
) {
    @Transactional
    fun currentUser(jwt: Jwt): CurrentUserResponse {
        val user = identityService.sync(jwt)
        return CurrentUserResponse(user.id, user.displayName, memberships.findAllByUserId(user.id).map { membership ->
            val name = organizations.findById(membership.organizationId).map { it.name }.orElse("Unknown organization")
            MembershipResponse(membership.organizationId, name, membership.role, membership.branchId, membership.classroomId)
        })
    }

    @Transactional
    fun require(jwt: Jwt, organizationId: UUID, allowedRoles: Set<Role>): AccessScope {
        val user = identityService.sync(jwt)
        val membership = memberships.findAllByUserIdAndOrganizationId(user.id, organizationId).firstOrNull { it.role in allowedRoles }
            ?: throw AccessDeniedException("You do not have permission for this organization")
        return AccessScope(user, membership)
    }
}

data class MembershipResponse(val organizationId: UUID, val organizationName: String, val role: Role, val branchId: UUID?, val classroomId: UUID?)
data class CurrentUserResponse(val id: UUID, val displayName: String, val memberships: List<MembershipResponse>)
