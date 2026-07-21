package com.daycare.api.persistence

import com.daycare.api.domain.InvitationStatus
import org.springframework.data.jpa.repository.JpaRepository
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.Lock
import java.time.LocalDate
import java.util.UUID

interface UserProfileRepository : JpaRepository<UserProfile, UUID> { fun findByFirebaseUid(firebaseUid: String): UserProfile?; fun findByEmailIgnoreCase(email: String): UserProfile?; fun findByUsernameIgnoreCase(username: String): UserProfile? }
interface MembershipRepository : JpaRepository<Membership, UUID> { fun findAllByUserIdAndOrganizationId(userId: UUID, organizationId: UUID): List<Membership>; fun findAllByUserId(userId: UUID): List<Membership>; fun findAllByOrganizationId(organizationId: UUID): List<Membership> }
interface OrganizationRepository : JpaRepository<Organization, UUID>
interface OrganizationTypeAssignmentRepository : JpaRepository<OrganizationTypeAssignment, UUID> { fun findAllByOrganizationId(organizationId: UUID): List<OrganizationTypeAssignment> }
interface AcademicYearRepository : JpaRepository<AcademicYear, UUID> { fun findAllByOrganizationIdOrderByStartsOnDesc(organizationId: UUID): List<AcademicYear> }
interface CurriculumProgramRepository : JpaRepository<CurriculumProgram, UUID> { fun findAllByOrganizationIdOrderByNameAsc(organizationId: UUID): List<CurriculumProgram> }
interface LearningLevelRepository : JpaRepository<LearningLevel, UUID> { fun findAllByOrganizationIdOrderByDisplayOrderAscNameAsc(organizationId: UUID): List<LearningLevel> }
interface LearningLevelCurriculumProgramRepository : JpaRepository<LearningLevelCurriculumProgram, UUID> { fun findAllByLearningLevelId(learningLevelId: UUID): List<LearningLevelCurriculumProgram>; fun deleteAllByLearningLevelId(learningLevelId: UUID) }
interface PlatformAdministratorRepository : JpaRepository<PlatformAdministrator, UUID>
interface TenantSubscriptionRepository : JpaRepository<TenantSubscription, UUID> { fun findByOrganizationId(organizationId: UUID): TenantSubscription? }
interface TenantPaymentRepository : JpaRepository<TenantPayment, UUID> { fun findAllByOrganizationIdOrderByCreatedAtDesc(organizationId: UUID): List<TenantPayment> }
interface BranchRepository : JpaRepository<Branch, UUID> { fun findFirstByOrganizationId(organizationId: UUID): Branch?; fun findAllByOrganizationId(organizationId: UUID): List<Branch>; @Lock(LockModeType.PESSIMISTIC_WRITE) fun findWithLockById(id: UUID): Branch? }
interface ClassroomRepository : JpaRepository<Classroom, UUID> { fun findAllByOrganizationIdOrderByNameAsc(organizationId: UUID): List<Classroom>; fun findAllByOrganizationIdAndActiveTrueOrderByNameAsc(organizationId: UUID): List<Classroom> }
interface ChildPlacementRepository : JpaRepository<ChildPlacement, UUID> { fun findByChildIdAndEndedOnIsNull(childId: UUID): ChildPlacement?; fun findAllByOrganizationIdAndChildIdOrderByStartsOnDesc(organizationId: UUID, childId: UUID): List<ChildPlacement>; fun findAllByClassroomIdAndEndedOnIsNull(classroomId: UUID): List<ChildPlacement>; fun countByClassroomIdAndEndedOnIsNull(classroomId: UUID): Long }
interface ClassroomStaffAssignmentRepository : JpaRepository<ClassroomStaffAssignment, UUID> { fun findAllByOrganizationIdAndClassroomIdOrderByCreatedAtDesc(organizationId: UUID, classroomId: UUID): List<ClassroomStaffAssignment>; fun findAllByOrganizationIdAndUserId(organizationId: UUID, userId: UUID): List<ClassroomStaffAssignment>; fun existsByOrganizationIdAndClassroomIdAndUserId(organizationId: UUID, classroomId: UUID, userId: UUID): Boolean }
interface ChildRepository : JpaRepository<Child, UUID> { fun findAllByOrganizationId(organizationId: UUID): List<Child>; fun findAllByOrganizationIdAndBranchId(organizationId: UUID, branchId: UUID): List<Child> }
interface ParentEnrollmentRepository : JpaRepository<ParentEnrollment, UUID> { fun findAllByOrganizationIdAndStatusOrderByCreatedAtAsc(organizationId: UUID, status: com.daycare.api.domain.ParentEnrollmentStatus): List<ParentEnrollment>; fun findAllByUserIdOrderByCreatedAtDesc(userId: UUID): List<ParentEnrollment>; fun findByInvoiceId(invoiceId: UUID): ParentEnrollment? }
interface ChildProgramRepository : JpaRepository<ChildProgram, UUID> { fun findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId: UUID, childId: UUID): List<ChildProgram> }
interface ChildStaffAssignmentRepository : JpaRepository<ChildStaffAssignment, UUID> {
    fun findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId: UUID, childId: UUID): List<ChildStaffAssignment>
    fun findAllByOrganizationIdAndUserId(organizationId: UUID, userId: UUID): List<ChildStaffAssignment>
    fun existsByOrganizationIdAndChildIdAndUserId(organizationId: UUID, childId: UUID, userId: UUID): Boolean
    fun existsByChildIdAndUserId(childId: UUID, userId: UUID): Boolean
}
interface GuardianLinkRepository : JpaRepository<GuardianLink, UUID> { fun findAllByUserId(userId: UUID): List<GuardianLink>; fun existsByChildIdAndUserId(childId: UUID, userId: UUID): Boolean; fun findAllByChildId(childId: UUID): List<GuardianLink> }
interface AttendanceRepository : JpaRepository<AttendanceRecord, UUID> { fun findByChildIdAndOperationalDate(childId: UUID, operationalDate: LocalDate): AttendanceRecord? }
interface InvitationRepository : JpaRepository<Invitation, UUID> { fun findAllByStatus(status: InvitationStatus): List<Invitation>; fun findAllByOrganizationIdAndStatus(organizationId: UUID, status: InvitationStatus): List<Invitation> }
interface NotificationRepository : JpaRepository<Notification, UUID> { fun findAllByRecipientUserIdAndOrganizationIdOrderByCreatedAtDesc(recipientUserId: UUID, organizationId: UUID): List<Notification> }
interface DeviceTokenRepository : JpaRepository<DeviceToken, UUID> { fun findAllByUserIdAndOrganizationId(userId: UUID, organizationId: UUID): List<DeviceToken>; fun findByToken(token: String): DeviceToken? }
interface DevelopmentEntryRepository : JpaRepository<DevelopmentEntry, UUID> { fun findAllByOrganizationIdAndChildIdOrderByRecordedAtDesc(organizationId: UUID, childId: UUID): List<DevelopmentEntry> }
