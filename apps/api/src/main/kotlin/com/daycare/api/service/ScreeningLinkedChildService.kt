package com.daycare.api.service

import com.daycare.api.domain.ChildEnrollmentStatus
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.OrganizationRepository
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.util.UUID

data class ScreeningLinkedChildResponse(
    val childId: UUID,
    val childName: String,
    val dateOfBirth: LocalDate,
    val organizationId: UUID,
    val organizationName: String,
    val branchId: UUID,
    val branchName: String,
)

/**
 * Read-only account-level list used to let Parent choose a legally linked child
 * as the subject of a future screening session. It never exposes screening
 * data and never changes the tenant child or guardian relationship.
 */
@Service
class ScreeningLinkedChildService(
    private val identity: IdentityService,
    private val guardians: GuardianLinkRepository,
    private val children: ChildRepository,
    private val organizations: OrganizationRepository,
    private val branches: BranchRepository,
) {
    @Transactional(readOnly = true)
    fun mine(jwt: Jwt): List<ScreeningLinkedChildResponse> {
        val parent = requireRegisteredParent(identity.sync(jwt))
        return guardians.findAllByUserId(parent.id)
            .mapNotNull { link -> children.findById(link.childId).orElse(null) }
            .filter { it.active && it.enrollmentStatus == ChildEnrollmentStatus.ACTIVE }
            .map { child ->
                val organizationName = organizations.findById(child.organizationId).map { it.name }.orElse("Unknown organization")
                val branchName = branches.findById(child.branchId).map { it.name }.orElse("Unknown branch")
                ScreeningLinkedChildResponse(child.id, listOfNotNull(child.firstName, child.lastName).joinToString(" "), child.dateOfBirth, child.organizationId, organizationName, child.branchId, branchName)
            }
            .distinctBy { it.childId }
            .sortedWith(compareBy<ScreeningLinkedChildResponse> { it.childName.lowercase() }.thenBy { it.organizationName.lowercase() })
    }
}
