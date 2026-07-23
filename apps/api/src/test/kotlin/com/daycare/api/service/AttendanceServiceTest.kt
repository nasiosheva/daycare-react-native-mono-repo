package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.persistence.AttendanceRepository
import com.daycare.api.persistence.AuditLogRepository
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.Classroom
import com.daycare.api.persistence.ClassroomRepository
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.LearningLevel
import com.daycare.api.persistence.LearningLevelRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional
import java.util.UUID

class AttendanceServiceTest {
    @Test
    fun `Staff Admin child list narrows by branch level and classroom`() {
        val fixtures = Fixtures()
        val child = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, classroomId = fixtures.classroom.id, firstName = "Alya")
        val otherChild = Child(organizationId = fixtures.organizationId, branchId = fixtures.branch.id, classroomId = UUID.randomUUID(), firstName = "Bima")
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, Role.entries.toSet(), readOnly = true)).thenReturn(fixtures.scope)
        `when`(fixtures.branches.findById(fixtures.branch.id)).thenReturn(Optional.of(fixtures.branch))
        `when`(fixtures.levels.findById(fixtures.level.id)).thenReturn(Optional.of(fixtures.level))
        `when`(fixtures.classrooms.findById(fixtures.classroom.id)).thenReturn(Optional.of(fixtures.classroom))
        `when`(fixtures.childScopes.visibleChildren(fixtures.scope, fixtures.organizationId)).thenReturn(listOf(child, otherChild))

        val children = fixtures.service.listChildren(fixtures.jwt, fixtures.organizationId, ChildListFilter(fixtures.branch.id, fixtures.level.id, fixtures.classroom.id))

        assertEquals(listOf("Alya"), children.map { it.fullName })
    }

    @Test
    fun `child filter rejects classroom outside the selected branch`() {
        val fixtures = Fixtures()
        val otherBranch = Branch(organizationId = fixtures.organizationId)
        val classroom = Classroom(organizationId = fixtures.organizationId, branchId = otherBranch.id, learningLevelId = fixtures.level.id)
        `when`(fixtures.access.require(fixtures.jwt, fixtures.organizationId, Role.entries.toSet(), readOnly = true)).thenReturn(fixtures.scope)
        `when`(fixtures.branches.findById(fixtures.branch.id)).thenReturn(Optional.of(fixtures.branch))
        `when`(fixtures.classrooms.findById(classroom.id)).thenReturn(Optional.of(classroom))

        assertThrows(IllegalArgumentException::class.java) {
            fixtures.service.listChildren(fixtures.jwt, fixtures.organizationId, ChildListFilter(branchId = fixtures.branch.id, classroomId = classroom.id))
        }
    }

    private class Fixtures {
        val organizationId: UUID = UUID.randomUUID()
        val jwt: Jwt = mock(Jwt::class.java)
        val access: AccessService = mock(AccessService::class.java)
        val childScopes: ChildScopeService = mock(ChildScopeService::class.java)
        val branches: BranchRepository = mock(BranchRepository::class.java)
        val levels: LearningLevelRepository = mock(LearningLevelRepository::class.java)
        val classrooms: ClassroomRepository = mock(ClassroomRepository::class.java)
        val branch = Branch(organizationId = organizationId)
        val level = LearningLevel(organizationId = organizationId)
        val classroom = Classroom(organizationId = organizationId, branchId = branch.id, learningLevelId = level.id)
        val scope = AccessScope(UserProfile(), Membership(role = Role.STAFF_ADMIN), emptySet(), emptySet())
        val service = AttendanceService(
            access,
            mock(GuardianLinkRepository::class.java),
            childScopes,
            branches,
            levels,
            classrooms,
            mock(AttendanceRepository::class.java),
            mock(AuditLogRepository::class.java),
            mock(AttendanceQrService::class.java),
            mock(NotificationService::class.java),
            mock(BookingEligibilityService::class.java),
        )
    }
}
