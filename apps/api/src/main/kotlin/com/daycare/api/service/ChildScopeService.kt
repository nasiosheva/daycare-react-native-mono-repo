package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.GuardianLinkRepository
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import java.util.UUID

@Service
class ChildScopeService(
    private val children: ChildRepository,
    private val guardians: GuardianLinkRepository,
) {
    fun visibleChildren(scope: AccessScope, organizationId: UUID): List<Child> = when (scope.membership.role) {
        Role.STAFF_ADMIN -> children.findAllByOrganizationId(organizationId)
        Role.STAFF -> scope.membership.branchId?.let { children.findAllByOrganizationIdAndBranchId(organizationId, it) } ?: children.findAllByOrganizationId(organizationId)
        Role.PARENT -> guardians.findAllByUserId(scope.user.id).mapNotNull { children.findById(it.childId).orElse(null) }.filter { it.organizationId == organizationId }
        Role.ADMIN -> throw AccessDeniedException("Platform administrators do not have tenant child access")
    }

    fun requireStaffManagedChild(scope: AccessScope, childId: UUID, organizationId: UUID): Child {
        val child = requireOrganizationChild(childId, organizationId)
        if (scope.membership.role == Role.STAFF && scope.membership.branchId != null && scope.membership.branchId != child.branchId) throw AccessDeniedException("Child belongs to a different branch")
        return child
    }

    fun requireParentLinkedChild(scope: AccessScope, childId: UUID, organizationId: UUID): Child {
        val child = requireOrganizationChild(childId, organizationId)
        if (!guardians.existsByChildIdAndUserId(childId, scope.user.id)) throw AccessDeniedException("You cannot access this child")
        return child
    }

    private fun requireOrganizationChild(childId: UUID, organizationId: UUID): Child {
        val child = children.findById(childId).orElseThrow { IllegalArgumentException("Child was not found") }
        if (child.organizationId != organizationId) throw AccessDeniedException("Child belongs to a different organization")
        return child
    }
}
