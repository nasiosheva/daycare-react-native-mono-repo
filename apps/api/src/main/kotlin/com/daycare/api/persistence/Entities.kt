package com.daycare.api.persistence

import com.daycare.api.domain.InvitationStatus
import com.daycare.api.domain.InstitutionTypeCodes
import com.daycare.api.domain.Role
import com.daycare.api.domain.RegistrationRole
import com.daycare.api.domain.ChildEnrollmentStatus
import com.daycare.api.domain.Gender
import com.daycare.api.domain.GoalCheckInOutcome
import com.daycare.api.domain.GoalDomain
import com.daycare.api.domain.ChildGoalStatus
import com.daycare.api.domain.ChildGoalOutcome
import com.daycare.api.domain.ParentEnrollmentStatus
import com.daycare.api.domain.ServicePlanType
import com.daycare.api.domain.UnusedCreditPolicy
import com.daycare.api.domain.TenantPaymentStatus
import com.daycare.api.domain.TenantSubscriptionPlan
import com.daycare.api.domain.TenantSubscriptionStatus
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

@Entity @Table(name = "users")
class UserProfile(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "firebase_uid", nullable = false, unique = true) var firebaseUid: String = "",
    @Column(nullable = false) var displayName: String = "",
    var username: String? = null,
    var email: String? = null,
    @Enumerated(EnumType.STRING) @Column(name = "registration_role") var registrationRole: RegistrationRole? = null,
    @Column(name = "local_password_hash") var localPasswordHash: String? = null,
    @Column(name = "phone_number") var phoneNumber: String? = null,
    @Enumerated(EnumType.STRING) @Column(nullable = false) var gender: Gender = Gender.UNSPECIFIED,
    @Column(name = "date_of_birth") var dateOfBirth: LocalDate? = null,
    @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(),
)

@Entity @Table(name = "revoked_access_tokens")
class RevokedAccessToken(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "token_hash", nullable = false, unique = true, length = 64) var tokenHash: String = "",
    @Column(name = "expires_at", nullable = false) var expiresAt: Instant = Instant.now(),
    @Column(name = "revoked_at", nullable = false) var revokedAt: Instant = Instant.now(),
)

@Entity @Table(name = "organizations")
class Organization(@Id var id: UUID = UUID.randomUUID(), @Column(nullable = false) var name: String = "", @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now())

@Entity
@Table(name = "organization_types", uniqueConstraints = [UniqueConstraint(columnNames = ["organization_id", "type_code"])])
class OrganizationTypeAssignment(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(name = "type_code", nullable = false) var type: String = InstitutionTypeCodes.DAYCARE,
)

@Entity @Table(name = "institution_type_definitions")
class InstitutionTypeDefinition(
    @Id @Column(name = "code", nullable = false, updatable = false) var code: String = "",
    @Column(name = "name", nullable = false) var name: String = "",
    @Column(name = "active", nullable = false) var active: Boolean = true,
)

@Entity @Table(name = "academic_years")
class AcademicYear(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(nullable = false) var name: String = "",
    @Column(name = "starts_on", nullable = false) var startsOn: LocalDate = LocalDate.now(),
    @Column(name = "ends_on", nullable = false) var endsOn: LocalDate = LocalDate.now(),
    @Column(nullable = false) var active: Boolean = true,
)

@Entity @Table(name = "curriculum_programs")
class CurriculumProgram(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id") var organizationId: UUID? = null,
    @Column(name = "academic_year_id") var academicYearId: UUID? = null,
    @Column(nullable = false) var name: String = "",
    @Column(nullable = false) var description: String = "",
    @Column(name = "is_template", nullable = false) var isTemplate: Boolean = false,
    @Column(nullable = false) var active: Boolean = true,
)

@Entity @Table(name = "curriculum_program_development_programs")
class CurriculumProgramDevelopmentProgram(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "curriculum_program_id", nullable = false) var curriculumProgramId: UUID = UUID.randomUUID(),
    @Column(name = "development_program_id", nullable = false) var developmentProgramId: UUID = UUID.randomUUID(),
)

@Entity @Table(name = "curriculum_activities")
class CurriculumActivity(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(nullable = false) var name: String = "",
    @Column(nullable = false) var description: String = "",
    @Column(nullable = false) var active: Boolean = true,
    @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(),
)

@Entity @Table(name = "curriculum_activity_assessments")
class CurriculumActivityAssessment(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(name = "activity_id", nullable = false) var activityId: UUID = UUID.randomUUID(),
    @Column(nullable = false) var name: String = "",
    @Column(nullable = false) var description: String = "",
    @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(),
)

@Entity @Table(name = "platform_administrators")
class PlatformAdministrator(
    @Id @Column(name = "user_id") var userId: UUID = UUID.randomUUID(),
    @Column(name = "pin_hash") var pinHash: String? = null,
    @Column(name = "pin_changed_at") var pinChangedAt: Instant? = null,
    @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(),
)

@Entity @Table(name = "tenant_subscriptions")
class TenantSubscription(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false, unique = true) var organizationId: UUID = UUID.randomUUID(),
    @Enumerated(EnumType.STRING) @Column(name = "plan_code", nullable = false) var plan: TenantSubscriptionPlan = TenantSubscriptionPlan.STARTER,
    @Enumerated(EnumType.STRING) @Column(nullable = false) var status: TenantSubscriptionStatus = TenantSubscriptionStatus.PENDING_PAYMENT,
    @Column(name = "period_start", nullable = false) var periodStart: LocalDate = LocalDate.now(),
    @Column(name = "period_end", nullable = false) var periodEnd: LocalDate = LocalDate.now(),
    @Column(name = "trial_ends_at") var trialEndsAt: LocalDate? = null,
    @Column(name = "monthly_fee", precision = 14, scale = 2) var monthlyFee: java.math.BigDecimal? = null,
)

@Entity @Table(name = "tenant_payments")
class TenantPayment(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "subscription_id", nullable = false) var subscriptionId: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(nullable = false, precision = 14, scale = 2) var amount: java.math.BigDecimal = java.math.BigDecimal.ZERO,
    @Enumerated(EnumType.STRING) @Column(nullable = false) var status: TenantPaymentStatus = TenantPaymentStatus.PENDING,
    @Column(name = "due_date", nullable = false) var dueDate: LocalDate = LocalDate.now(),
    @Column(name = "paid_at") var paidAt: Instant? = null,
    @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(),
)

@Entity @Table(name = "branches")
class Branch(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(nullable = false) var name: String = "",
    @Column(nullable = false) var timezone: String = "Asia/Jakarta",
    @Column(nullable = false) var active: Boolean = true,
    @Column(name = "is_primary", nullable = false) var primary: Boolean = false,
)

@Entity @Table(name = "learning_levels")
class LearningLevel(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id") var organizationId: UUID? = null,
    @Column(nullable = false) var name: String = "",
    @Column(name = "min_age_months") var minAgeMonths: Int? = null,
    @Column(name = "max_age_months") var maxAgeMonths: Int? = null,
    @Column(name = "display_order", nullable = false) var displayOrder: Int = 0,
    @Column(name = "is_template", nullable = false) var isTemplate: Boolean = false,
    @Column(nullable = false) var active: Boolean = true,
)

@Entity
@Table(name = "learning_level_curriculum_programs")
class LearningLevelCurriculumProgram(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "learning_level_id", nullable = false) var learningLevelId: UUID = UUID.randomUUID(),
    @Column(name = "curriculum_program_id", nullable = false) var curriculumProgramId: UUID = UUID.randomUUID(),
)

@Entity @Table(name = "classrooms")
class Classroom(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(name = "branch_id", nullable = false) var branchId: UUID = UUID.randomUUID(),
    @Column(nullable = false) var name: String = "",
    @Column(name = "learning_level_id") var learningLevelId: UUID? = null,
    @Column(name = "academic_year_id") var academicYearId: UUID? = null,
    var capacity: Int? = null,
    @Column(nullable = false) var active: Boolean = true,
)

@Entity @Table(name = "child_placements")
class ChildPlacement(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(name = "child_id", nullable = false) var childId: UUID = UUID.randomUUID(),
    @Column(name = "classroom_id", nullable = false) var classroomId: UUID = UUID.randomUUID(),
    @Column(name = "learning_level_id") var learningLevelId: UUID? = null,
    @Column(name = "academic_year_id") var academicYearId: UUID? = null,
    @Column(name = "starts_on", nullable = false) var startsOn: LocalDate = LocalDate.now(),
    @Column(name = "ended_on") var endedOn: LocalDate? = null,
    @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "classroom_staff_assignments", uniqueConstraints = [UniqueConstraint(columnNames = ["classroom_id", "user_id"])])
class ClassroomStaffAssignment(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(name = "classroom_id", nullable = false) var classroomId: UUID = UUID.randomUUID(),
    @Column(name = "user_id", nullable = false) var userId: UUID = UUID.randomUUID(),
    @Column(name = "assignment_role", nullable = false) var assignmentRole: String = "STAFF",
    @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "classroom_programs", uniqueConstraints = [UniqueConstraint(columnNames = ["classroom_id", "name"])])
class ClassroomProgram(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(name = "classroom_id", nullable = false) var classroomId: UUID = UUID.randomUUID(),
    @Column(nullable = false) var name: String = "",
    @Column(nullable = false) var description: String = "",
    @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(),
)

@Entity @Table(name = "memberships")
class Membership(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "user_id", nullable = false) var userId: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Enumerated(EnumType.STRING) @Column(nullable = false) var role: Role = Role.PARENT,
    @Column(name = "branch_id") var branchId: UUID? = null,
    @Column(name = "classroom_id") var classroomId: UUID? = null,
    @Column(nullable = false) var active: Boolean = true,
    @Column(name = "primary_staff_admin", nullable = false) var primaryStaffAdmin: Boolean = false,
    @Column(name = "can_manage_child_programs", nullable = false) var canManageChildPrograms: Boolean = false,
    @Column(name = "can_manage_development_categories", nullable = false) var canManageDevelopmentCategories: Boolean = false,
)

@Entity @Table(name = "children")
class Child(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(name = "branch_id", nullable = false) var branchId: UUID = UUID.randomUUID(),
    @Column(name = "classroom_id") var classroomId: UUID? = null,
    @Column(name = "first_name", nullable = false) var firstName: String = "",
    @Column(name = "last_name") var lastName: String? = null,
    @Column(nullable = true) var nisn: String? = null,
    @Enumerated(EnumType.STRING) @Column(nullable = false) var gender: Gender = Gender.UNSPECIFIED,
    @Column(name = "date_of_birth", nullable = false) var dateOfBirth: LocalDate = LocalDate.now(),
    @Enumerated(EnumType.STRING) @Column(name = "enrollment_status", nullable = false) var enrollmentStatus: ChildEnrollmentStatus = ChildEnrollmentStatus.ACTIVE,
    @Column(nullable = false) var active: Boolean = true,
)

@Entity @Table(name = "development_programs")
class DevelopmentProgram(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id") var organizationId: UUID? = null,
    @Column(name = "learning_level_id", nullable = false) var learningLevelId: UUID = UUID.randomUUID(),
    @Column(nullable = false) var name: String = "",
    @Column(nullable = false) var description: String = "",
    @Column(name = "duration_days", nullable = false) var durationDays: Int = 1,
    @Column(name = "minimum_yes_percent", nullable = false) var minimumYesPercent: Int = 0,
    @Column(name = "minimum_yes_streak", nullable = false) var minimumYesStreak: Int = 0,
    @Enumerated(EnumType.STRING) @Column(nullable = false) var domain: GoalDomain = GoalDomain.KEMANDIRIAN,
    @Column(name = "is_template", nullable = false) var isTemplate: Boolean = false,
    @Column(nullable = false) var active: Boolean = true,
    @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(),
)

@Entity @Table(name = "development_program_items")
class DevelopmentProgramItem(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id") var organizationId: UUID? = null,
    @Column(name = "development_program_id", nullable = false) var developmentProgramId: UUID = UUID.randomUUID(),
    @Column(nullable = false) var name: String = "",
    @Column(name = "display_order", nullable = false) var displayOrder: Int = 0,
    @Column(nullable = false) var active: Boolean = true,
    @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(),
)

@Entity @Table(name = "child_goals")
class ChildGoal(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(name = "child_id", nullable = false) var childId: UUID = UUID.randomUUID(),
    @Column(name = "program_id", nullable = false) var programId: UUID = UUID.randomUUID(),
    @Column(name = "starts_on", nullable = false) var startsOn: LocalDate = LocalDate.now(),
    @Enumerated(EnumType.STRING) @Column(nullable = false) var status: ChildGoalStatus = ChildGoalStatus.ACTIVE,
    @Enumerated(EnumType.STRING) @Column(name = "final_outcome") var finalOutcome: ChildGoalOutcome? = null,
    @Column(name = "final_summary", length = 2000) var finalSummary: String? = null,
    @Column(name = "finalized_by_user_id") var finalizedByUserId: UUID? = null,
    @Column(name = "finalized_at") var finalizedAt: Instant? = null,
    @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(),
)

@Entity @Table(name = "child_goal_check_ins", uniqueConstraints = [UniqueConstraint(columnNames = ["child_goal_id", "indicator_id", "check_in_date"])])
class ChildGoalCheckIn(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(name = "child_goal_id", nullable = false) var childGoalId: UUID = UUID.randomUUID(),
    @Column(name = "indicator_id", nullable = false) var indicatorId: UUID = UUID.randomUUID(),
    @Column(name = "check_in_date", nullable = false) var checkInDate: LocalDate = LocalDate.now(),
    @Enumerated(EnumType.STRING) @Column(nullable = false) var outcome: GoalCheckInOutcome = GoalCheckInOutcome.NO,
    @Column(length = 500) var note: String? = null,
    @Column(name = "photo_content_type", length = 50) var photoContentType: String? = null,
    @Column(name = "photo_data") var photoData: ByteArray? = null,
    @Column(name = "audio_content_type", length = 50) var audioContentType: String? = null,
    @Column(name = "audio_data") var audioData: ByteArray? = null,
    @Column(name = "audio_duration_ms") var audioDurationMs: Int? = null,
    @Column(name = "recorded_by_user_id", nullable = false) var recordedByUserId: UUID = UUID.randomUUID(),
    @Column(name = "recorded_at", nullable = false) var recordedAt: Instant = Instant.now(),
)

@Entity @Table(name = "parent_enrollments")
class ParentEnrollment(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "user_id", nullable = false) var userId: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(name = "branch_id", nullable = false) var branchId: UUID = UUID.randomUUID(),
    @Column(name = "child_id", nullable = false) var childId: UUID = UUID.randomUUID(),
    @Column(name = "invoice_id") var invoiceId: UUID? = null,
    @Column(name = "entitlement_id") var entitlementId: UUID? = null,
    @Column(name = "selected_plan_id", nullable = false) var selectedPlanId: UUID = UUID.randomUUID(),
    @Column(name = "selected_plan_name", nullable = false) var selectedPlanName: String = "",
    @Enumerated(EnumType.STRING) @Column(name = "selected_plan_type", nullable = false) var selectedPlanType: ServicePlanType = ServicePlanType.DAILY,
    @Column(name = "selected_subtotal_amount", nullable = false, precision = 14, scale = 2) var selectedSubtotalAmount: java.math.BigDecimal = java.math.BigDecimal.ZERO,
    @Column(name = "selected_discount_amount", nullable = false, precision = 14, scale = 2) var selectedDiscountAmount: java.math.BigDecimal = java.math.BigDecimal.ZERO,
    @Column(name = "selected_discount_name") var selectedDiscountName: String? = null,
    @Column(name = "selected_discount_code") var selectedDiscountCode: String? = null,
    @Column(name = "selected_total_amount", nullable = false, precision = 14, scale = 2) var selectedTotalAmount: java.math.BigDecimal = java.math.BigDecimal.ZERO,
    @Column(name = "selected_credit_count") var selectedCreditCount: Int? = null,
    @Enumerated(EnumType.STRING) @Column(name = "selected_unused_credit_policy") var selectedUnusedCreditPolicy: UnusedCreditPolicy? = null,
    @Column(name = "selected_carry_forward_days") var selectedCarryForwardDays: Int? = null,
    @Column(name = "selected_booking_requires_approval", nullable = false) var selectedBookingRequiresApproval: Boolean = true,
    @Enumerated(EnumType.STRING) @Column(nullable = false) var status: ParentEnrollmentStatus = ParentEnrollmentStatus.PENDING_APPROVAL,
    @Column(name = "rejection_reason") var rejectionReason: String? = null,
    @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(),
    @Column(name = "approved_at") var approvedAt: Instant? = null,
)

@Entity @Table(name = "tenant_payment_instructions")
class TenantPaymentInstruction(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(nullable = false) var name: String = "",
    @Column(name = "account_holder", nullable = false) var accountHolder: String = "",
    @Column(name = "account_number", nullable = false) var accountNumber: String = "",
    @Column(length = 500) var note: String? = null,
    @Column(nullable = false) var active: Boolean = true,
    @Column(name = "display_order", nullable = false) var displayOrder: Int = 0,
    @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "child_programs")
class ChildProgram(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(name = "child_id", nullable = false) var childId: UUID = UUID.randomUUID(),
    @Column(nullable = false) var name: String = "",
    @Column(nullable = false) var description: String = "",
    @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "child_staff_assignments", uniqueConstraints = [UniqueConstraint(columnNames = ["child_id", "user_id"])])
class ChildStaffAssignment(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(name = "child_id", nullable = false) var childId: UUID = UUID.randomUUID(),
    @Column(name = "user_id", nullable = false) var userId: UUID = UUID.randomUUID(),
    @Column(name = "assignment_role", nullable = false) var assignmentRole: String = "STAFF",
    @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(),
)

@Entity @Table(name = "guardian_links")
class GuardianLink(@Id var id: UUID = UUID.randomUUID(), @Column(name = "child_id", nullable = false) var childId: UUID = UUID.randomUUID(), @Column(name = "user_id", nullable = false) var userId: UUID = UUID.randomUUID())

@Entity @Table(name = "attendance_records")
class AttendanceRecord(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(name = "branch_id", nullable = false) var branchId: UUID = UUID.randomUUID(),
    @Column(name = "child_id", nullable = false) var childId: UUID = UUID.randomUUID(),
    @Column(name = "operational_date", nullable = false) var operationalDate: LocalDate = LocalDate.now(),
    @Column(name = "checked_in_at") var checkedInAt: Instant? = null,
    @Column(name = "checked_out_at") var checkedOutAt: Instant? = null,
    @Column(name = "check_in_method") var checkInMethod: String? = null,
    @Column(name = "check_out_method") var checkOutMethod: String? = null,
)

@Entity @Table(name = "invitations")
class Invitation(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    var email: String? = null,
    @Column(name = "phone_number") var phoneNumber: String? = null,
    @Enumerated(EnumType.STRING) @Column(nullable = false) var role: Role = Role.PARENT,
    @Column(name = "branch_id") var branchId: UUID? = null,
    @Column(name = "classroom_id") var classroomId: UUID? = null,
    @Enumerated(EnumType.STRING) @Column(nullable = false) var status: InvitationStatus = InvitationStatus.PENDING,
    @Column(name = "expires_at", nullable = false) var expiresAt: Instant = Instant.now().plusSeconds(604800),
)

@Entity @Table(name = "notifications")
class Notification(@Id var id: UUID = UUID.randomUUID(), @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(), @Column(name = "recipient_user_id", nullable = false) var recipientUserId: UUID = UUID.randomUUID(), @Column(nullable = false) var title: String = "", @Column(nullable = false) var body: String = "", @Column(name = "action_path") var actionPath: String? = null, @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(), @Column(name = "read_at") var readAt: Instant? = null)

@Entity @Table(name = "device_tokens")
class DeviceToken(@Id var id: UUID = UUID.randomUUID(), @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(), @Column(name = "user_id", nullable = false) var userId: UUID = UUID.randomUUID(), @Column(nullable = false, unique = true) var token: String = "", @Column(nullable = false) var platform: String = "", @Column(name = "installation_id") var installationId: String? = null, @Column(name = "time_zone") var timeZone: String? = null, @Column(name = "push_muted_until") var pushMutedUntil: Instant? = null)

@Entity @Table(name = "staff_reminders")
class StaffReminder(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(name = "user_id", nullable = false) var userId: UUID = UUID.randomUUID(),
    @Column(nullable = false) var title: String = "",
    @Column(nullable = false) var description: String = "",
    @Column(nullable = false) var hour: Int = 17,
    @Column(nullable = false) var minute: Int = 0,
    @Column(nullable = false) var weekdays: String = "1,2,3,4,5,6,7",
    @Column(name = "target_code", nullable = false) var targetCode: String = "HOME",
    @Column(name = "action_path", nullable = false) var actionPath: String = "/home",
    @Column(nullable = false) var active: Boolean = true,
    @Column(name = "rule_version", nullable = false) var ruleVersion: Int = 1,
    @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(),
    @Column(name = "updated_at", nullable = false) var updatedAt: Instant = Instant.now(),
)

@Entity @Table(name = "staff_reminder_device_schedules")
class StaffReminderDeviceSchedule(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "reminder_id", nullable = false) var reminderId: UUID = UUID.randomUUID(),
    @Column(name = "installation_id", nullable = false) var installationId: String = "",
    @Column(name = "rule_version", nullable = false) var ruleVersion: Int = 0,
    @Column(name = "scheduled_at", nullable = false) var scheduledAt: Instant = Instant.now(),
)

@Entity @Table(name = "development_entries")
class DevelopmentEntry(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(name = "branch_id", nullable = false) var branchId: UUID = UUID.randomUUID(),
    @Column(name = "child_id", nullable = false) var childId: UUID = UUID.randomUUID(),
    @Column(name = "author_user_id", nullable = false) var authorUserId: UUID = UUID.randomUUID(),
    @Column(nullable = false, length = 64) var category: String = "OBSERVATION",
    @Column(nullable = false) var title: String = "",
    @Column(nullable = false) var content: String = "",
    @Column(name = "photo_content_type", length = 50) var photoContentType: String? = null,
    @Column(name = "photo_data") var photoData: ByteArray? = null,
    @Column(name = "recorded_at", nullable = false) var recordedAt: Instant = Instant.now(),
)

@Entity @Table(name = "development_categories")
class DevelopmentCategoryConfig(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id") var organizationId: UUID? = null,
    @Column(nullable = false, length = 120) var name: String = "",
    @Column(nullable = false) var active: Boolean = true,
    @Column(name = "created_by_user_id") var createdByUserId: UUID? = null,
    @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(),
)
