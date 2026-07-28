package com.daycare.api.persistence

import com.daycare.api.domain.InvitationStatus
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.Lock
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

interface UserProfileRepository : JpaRepository<UserProfile, UUID> { fun findByFirebaseUid(firebaseUid: String): UserProfile?; fun findByEmailIgnoreCase(email: String): UserProfile?; fun findByPhoneNumber(phoneNumber: String): UserProfile?; fun findByUsernameIgnoreCase(username: String): UserProfile? }
interface RevokedAccessTokenRepository : JpaRepository<RevokedAccessToken, UUID> { fun existsByTokenHash(tokenHash: String): Boolean; fun deleteAllByExpiresAtBefore(expiresAt: Instant) }
interface MembershipRepository : JpaRepository<Membership, UUID> {
    fun findAllByUserIdAndOrganizationId(userId: UUID, organizationId: UUID): List<Membership>
    fun findAllByUserId(userId: UUID): List<Membership>
    fun findAllByOrganizationId(organizationId: UUID): List<Membership>

    @Query("""
        select distinct membership.organizationId
        from Membership membership, UserProfile user
        where membership.userId = user.id
          and membership.role = com.daycare.api.domain.Role.STAFF_ADMIN
          and (lower(user.email) like lower(concat('%', :query, '%'))
            or lower(user.displayName) like lower(concat('%', :query, '%')))
    """)
    fun findOrganizationIdsByStaffAdminSearch(@Param("query") query: String): List<UUID>
}
interface OrganizationRepository : JpaRepository<Organization, UUID> { fun findAllByNameContainingIgnoreCase(name: String): List<Organization> }
interface OrganizationTypeAssignmentRepository : JpaRepository<OrganizationTypeAssignment, UUID> { fun findAllByOrganizationId(organizationId: UUID): List<OrganizationTypeAssignment>; fun existsByType(type: String): Boolean }
interface InstitutionTypeDefinitionRepository : JpaRepository<InstitutionTypeDefinition, String> { fun findAllByActiveTrueOrderByNameAsc(): List<InstitutionTypeDefinition>; fun existsByNameIgnoreCase(name: String): Boolean; fun findByNameIgnoreCase(name: String): InstitutionTypeDefinition? }
interface AcademicYearRepository : JpaRepository<AcademicYear, UUID> { fun findAllByOrganizationIdOrderByStartsOnDesc(organizationId: UUID): List<AcademicYear> }
interface CurriculumProgramRepository : JpaRepository<CurriculumProgram, UUID> {
    fun findAllByOrganizationIdOrderByNameAsc(organizationId: UUID): List<CurriculumProgram>
    fun findAllByOrganizationIdIsNullOrderByNameAsc(): List<CurriculumProgram>
    fun findAllByOrganizationIdAndActiveTrueOrderByNameAsc(organizationId: UUID): List<CurriculumProgram>
    fun findAllByOrganizationIdIsNullAndActiveTrueOrderByNameAsc(): List<CurriculumProgram>

    @Query("""
        select program
        from CurriculumProgram program
        where program.active = true
          and (program.organizationId is null or program.organizationId = :organizationId)
          and (lower(program.name) like lower(concat('%', :search, '%'))
            or lower(program.description) like lower(concat('%', :search, '%')))
        order by case when program.organizationId is null then 0 else 1 end, program.name asc
    """)
    fun searchAvailableForOrganization(@Param("organizationId") organizationId: UUID, @Param("search") search: String): List<CurriculumProgram>

    @Query("""
        select program
        from CurriculumProgram program
        where (program.organizationId is null or program.organizationId = :organizationId)
          and (lower(program.name) like lower(concat('%', :search, '%'))
            or lower(program.description) like lower(concat('%', :search, '%')))
        order by case when program.organizationId is null then 0 else 1 end, program.name asc
    """)
    fun searchIncludingArchivedForOrganization(@Param("organizationId") organizationId: UUID, @Param("search") search: String): List<CurriculumProgram>
}
interface CurriculumProgramDevelopmentProgramRepository : JpaRepository<CurriculumProgramDevelopmentProgram, UUID> {
    fun findAllByCurriculumProgramId(curriculumProgramId: UUID): List<CurriculumProgramDevelopmentProgram>
    fun deleteAllByCurriculumProgramId(curriculumProgramId: UUID)
    fun existsByCurriculumProgramIdAndDevelopmentProgramId(curriculumProgramId: UUID, developmentProgramId: UUID): Boolean
}
interface CurriculumActivityRepository : JpaRepository<CurriculumActivity, UUID> { fun findAllByOrganizationIdOrderByCreatedAtDesc(organizationId: UUID): List<CurriculumActivity> }
interface CurriculumActivityAssessmentRepository : JpaRepository<CurriculumActivityAssessment, UUID> { fun findAllByOrganizationIdAndActivityIdOrderByCreatedAtDesc(organizationId: UUID, activityId: UUID): List<CurriculumActivityAssessment> }
interface LearningLevelRepository : JpaRepository<LearningLevel, UUID> {
    fun findAllByOrganizationIdOrderByDisplayOrderAscNameAsc(organizationId: UUID): List<LearningLevel>
    fun findAllByOrganizationIdIsNullOrderByDisplayOrderAscNameAsc(): List<LearningLevel>
}
interface LearningLevelCurriculumProgramRepository : JpaRepository<LearningLevelCurriculumProgram, UUID> { fun findAllByLearningLevelId(learningLevelId: UUID): List<LearningLevelCurriculumProgram>; fun existsByLearningLevelIdAndCurriculumProgramId(learningLevelId: UUID, curriculumProgramId: UUID): Boolean; fun deleteAllByLearningLevelId(learningLevelId: UUID) }
interface PlatformAdministratorRepository : JpaRepository<PlatformAdministrator, UUID>
interface TenantSubscriptionRepository : JpaRepository<TenantSubscription, UUID> { fun findByOrganizationId(organizationId: UUID): TenantSubscription? }
interface TenantPaymentRepository : JpaRepository<TenantPayment, UUID> { fun findAllByOrganizationIdOrderByCreatedAtDesc(organizationId: UUID): List<TenantPayment> }
interface BranchRepository : JpaRepository<Branch, UUID> { fun findFirstByOrganizationId(organizationId: UUID): Branch?; fun findByOrganizationIdAndPrimaryTrue(organizationId: UUID): Branch?; fun findAllByOrganizationId(organizationId: UUID): List<Branch>; fun findAllByOrganizationIdAndActiveTrueOrderByNameAsc(organizationId: UUID): List<Branch>; fun findAllByOrganizationIdAndNameContainingIgnoreCase(organizationId: UUID, name: String): List<Branch>; @Lock(LockModeType.PESSIMISTIC_WRITE) fun findWithLockById(id: UUID): Branch? }
interface BranchOperatingHourRepository : JpaRepository<BranchOperatingHour, UUID> { fun findAllByBranchIdOrderByDayOfWeekAsc(branchId: UUID): List<BranchOperatingHour>; fun deleteAllByBranchId(branchId: UUID) }
interface BranchOvertimeRateTierRepository : JpaRepository<BranchOvertimeRateTier, UUID> { fun findAllByBranchIdOrderByDisplayOrderAsc(branchId: UUID): List<BranchOvertimeRateTier>; fun deleteAllByBranchId(branchId: UUID) }
interface OvertimeChargeRepository : JpaRepository<OvertimeCharge, UUID> { fun findAllByOrganizationIdOrderByOperationalDateDesc(organizationId: UUID): List<OvertimeCharge>; fun findByInvoiceId(invoiceId: UUID): OvertimeCharge?; fun findAllByOrganizationIdAndChildIdAndOperationalDate(organizationId: UUID, childId: UUID, operationalDate: LocalDate): List<OvertimeCharge> }
interface OvertimeChargeTierSnapshotRepository : JpaRepository<OvertimeChargeTierSnapshot, UUID> { fun findAllByOvertimeChargeIdOrderByDisplayOrderAsc(overtimeChargeId: UUID): List<OvertimeChargeTierSnapshot>; fun deleteAllByOvertimeChargeId(overtimeChargeId: UUID) }
interface ClassroomRepository : JpaRepository<Classroom, UUID> { fun findAllByOrganizationIdOrderByNameAsc(organizationId: UUID): List<Classroom>; fun findAllByOrganizationIdAndActiveTrueOrderByNameAsc(organizationId: UUID): List<Classroom> }
interface ChildPlacementRepository : JpaRepository<ChildPlacement, UUID> {
    fun findByChildIdAndEndedOnIsNull(childId: UUID): ChildPlacement?
    fun findAllByOrganizationIdAndChildIdOrderByStartsOnDesc(organizationId: UUID, childId: UUID): List<ChildPlacement>
    fun findAllByClassroomIdAndEndedOnIsNull(classroomId: UUID): List<ChildPlacement>

    @Query("""
        select count(placement)
        from ChildPlacement placement, Child child
        where placement.classroomId = :classroomId
          and placement.endedOn is null
          and placement.childId = child.id
          and child.enrollmentStatus = :enrollmentStatus
          and child.active = true
    """)
    fun countByClassroomIdAndActiveEnrollmentStatus(
        @Param("classroomId") classroomId: UUID,
        @Param("enrollmentStatus") enrollmentStatus: com.daycare.api.domain.ChildEnrollmentStatus,
    ): Long
}
interface ClassroomStaffAssignmentRepository : JpaRepository<ClassroomStaffAssignment, UUID> { fun findAllByOrganizationIdAndClassroomIdOrderByCreatedAtDesc(organizationId: UUID, classroomId: UUID): List<ClassroomStaffAssignment>; fun findAllByOrganizationIdAndUserId(organizationId: UUID, userId: UUID): List<ClassroomStaffAssignment>; fun existsByOrganizationIdAndClassroomIdAndUserId(organizationId: UUID, classroomId: UUID, userId: UUID): Boolean }
interface ClassroomProgramRepository : JpaRepository<ClassroomProgram, UUID> { fun findAllByOrganizationIdAndClassroomIdOrderByCreatedAtDesc(organizationId: UUID, classroomId: UUID): List<ClassroomProgram> }
interface ChildRepository : JpaRepository<Child, UUID> { fun findAllByOrganizationId(organizationId: UUID): List<Child>; fun findAllByOrganizationIdAndBranchId(organizationId: UUID, branchId: UUID): List<Child> }
interface ParentEnrollmentRepository : JpaRepository<ParentEnrollment, UUID> { fun findAllByOrganizationIdAndStatusOrderByCreatedAtAsc(organizationId: UUID, status: com.daycare.api.domain.ParentEnrollmentStatus): List<ParentEnrollment>; fun findAllByUserIdOrderByCreatedAtDesc(userId: UUID): List<ParentEnrollment>; fun findByInvoiceId(invoiceId: UUID): ParentEnrollment? }
interface TenantPaymentInstructionRepository : JpaRepository<TenantPaymentInstruction, UUID> { fun findAllByOrganizationIdOrderByDisplayOrderAscCreatedAtAsc(organizationId: UUID): List<TenantPaymentInstruction>; fun findAllByOrganizationIdAndActiveTrueOrderByDisplayOrderAscCreatedAtAsc(organizationId: UUID): List<TenantPaymentInstruction> }
interface ChildProgramRepository : JpaRepository<ChildProgram, UUID> { fun findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId: UUID, childId: UUID): List<ChildProgram> }
interface ChildStaffAssignmentRepository : JpaRepository<ChildStaffAssignment, UUID> {
    fun findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId: UUID, childId: UUID): List<ChildStaffAssignment>
    fun findAllByOrganizationIdAndUserId(organizationId: UUID, userId: UUID): List<ChildStaffAssignment>
    fun existsByOrganizationIdAndChildIdAndUserId(organizationId: UUID, childId: UUID, userId: UUID): Boolean
    fun existsByChildIdAndUserId(childId: UUID, userId: UUID): Boolean
}
interface GuardianLinkRepository : JpaRepository<GuardianLink, UUID> { fun findAllByUserId(userId: UUID): List<GuardianLink>; fun existsByChildIdAndUserId(childId: UUID, userId: UUID): Boolean; fun findAllByChildId(childId: UUID): List<GuardianLink> }
interface AttendanceRepository : JpaRepository<AttendanceRecord, UUID> { fun findByChildIdAndOperationalDate(childId: UUID, operationalDate: LocalDate): AttendanceRecord?; fun findAllByChildIdInAndOperationalDateIn(childIds: List<UUID>, operationalDates: List<LocalDate>): List<AttendanceRecord> }
interface InvitationRepository : JpaRepository<Invitation, UUID> { fun findAllByStatus(status: InvitationStatus): List<Invitation>; fun findAllByOrganizationIdAndStatus(organizationId: UUID, status: InvitationStatus): List<Invitation> }
interface NotificationRepository : JpaRepository<Notification, UUID> {
    fun findAllByRecipientUserIdAndOrganizationIdOrderByCreatedAtDesc(recipientUserId: UUID, organizationId: UUID): List<Notification>

    @Query("""
        select notification from Notification notification
        where notification.recipientUserId = :recipientUserId and notification.organizationId = :organizationId
          and (lower(notification.title) like lower(concat('%', :query, '%'))
            or lower(notification.body) like lower(concat('%', :query, '%')))
        order by notification.createdAt desc
    """)
    fun searchByRecipientUserIdAndOrganizationId(@Param("recipientUserId") recipientUserId: UUID, @Param("organizationId") organizationId: UUID, @Param("query") query: String): List<Notification>
}
interface DeviceTokenRepository : JpaRepository<DeviceToken, UUID> { fun findAllByUserIdAndOrganizationId(userId: UUID, organizationId: UUID): List<DeviceToken>; fun findByToken(token: String): DeviceToken?; fun findByInstallationId(installationId: String): DeviceToken? }
interface StaffReminderRepository : JpaRepository<StaffReminder, UUID> { fun findAllByOrganizationIdAndUserIdOrderByCreatedAtDesc(organizationId: UUID, userId: UUID): List<StaffReminder>; fun findAllByActiveTrue(): List<StaffReminder> }
interface StaffReminderDeviceScheduleRepository : JpaRepository<StaffReminderDeviceSchedule, UUID> { fun findByReminderIdAndInstallationId(reminderId: UUID, installationId: String): StaffReminderDeviceSchedule? }
interface DevelopmentEntryRepository : JpaRepository<DevelopmentEntry, UUID> { fun findAllByOrganizationIdAndChildIdOrderByRecordedAtDesc(organizationId: UUID, childId: UUID): List<DevelopmentEntry>; fun existsByOrganizationIdAndCategory(organizationId: UUID, category: String): Boolean; fun existsByCategory(category: String): Boolean }
interface DevelopmentCategoryConfigRepository : JpaRepository<DevelopmentCategoryConfig, UUID> {
    fun findAllByOrganizationIdOrderByNameAsc(organizationId: UUID): List<DevelopmentCategoryConfig>
    fun findAllByOrganizationIdIsNullOrderByNameAsc(): List<DevelopmentCategoryConfig>
    fun existsByOrganizationIdAndNameIgnoreCase(organizationId: UUID, name: String): Boolean
    fun existsByOrganizationIdIsNullAndNameIgnoreCase(name: String): Boolean
}
interface DevelopmentProgramRepository : JpaRepository<DevelopmentProgram, UUID> {
    fun findAllByOrganizationIdOrderByCreatedAtDesc(organizationId: UUID): List<DevelopmentProgram>
    fun findAllByOrganizationIdIsNullOrderByCreatedAtDesc(): List<DevelopmentProgram>
    fun findByOrganizationIdAndLearningLevelIdAndDomain(organizationId: UUID?, learningLevelId: UUID, domain: com.daycare.api.domain.GoalDomain): DevelopmentProgram?

    @Query("""
        select program
        from DevelopmentProgram program
        where program.organizationId is null
          and (lower(program.name) like lower(concat('%', :search, '%'))
            or lower(program.description) like lower(concat('%', :search, '%')))
        order by program.createdAt desc
    """)
    fun searchGlobal(@Param("search") search: String): List<DevelopmentProgram>

    @Query("""
        select program
        from DevelopmentProgram program
        where program.organizationId is null or program.organizationId = :organizationId
        order by case when program.organizationId is null then 0 else 1 end, program.createdAt desc
    """)
    fun findVisibleToOrganization(@Param("organizationId") organizationId: UUID): List<DevelopmentProgram>

    @Query("""
        select program
        from DevelopmentProgram program
        where (program.organizationId is null or program.organizationId = :organizationId)
          and (lower(program.name) like lower(concat('%', :search, '%'))
            or lower(program.description) like lower(concat('%', :search, '%')))
        order by case when program.organizationId is null then 0 else 1 end, program.createdAt desc
    """)
    fun searchVisibleToOrganization(@Param("organizationId") organizationId: UUID, @Param("search") search: String): List<DevelopmentProgram>
}
interface DevelopmentProgramItemRepository : JpaRepository<DevelopmentProgramItem, UUID> { fun findAllByDevelopmentProgramIdOrderByDisplayOrderAsc(developmentProgramId: UUID): List<DevelopmentProgramItem> }
interface ChildGoalRepository : JpaRepository<ChildGoal, UUID> { fun findAllByOrganizationIdAndChildIdOrderByCreatedAtDesc(organizationId: UUID, childId: UUID): List<ChildGoal>; fun existsByChildIdAndProgramIdAndStatus(childId: UUID, programId: UUID, status: com.daycare.api.domain.ChildGoalStatus): Boolean; fun existsByProgramId(programId: UUID): Boolean; fun findAllByStatus(status: com.daycare.api.domain.ChildGoalStatus): List<ChildGoal> }
interface ChildGoalCheckInRepository : JpaRepository<ChildGoalCheckIn, UUID> { fun findAllByChildGoalIdOrderByCheckInDateAsc(childGoalId: UUID): List<ChildGoalCheckIn>; fun findByChildGoalIdAndIndicatorIdAndCheckInDate(childGoalId: UUID, indicatorId: UUID, checkInDate: LocalDate): ChildGoalCheckIn? }
