package com.daycare.api.config

import com.daycare.api.domain.BookingStatus
import com.daycare.api.domain.EntitlementStatus
import com.daycare.api.domain.Gender
import com.daycare.api.domain.InvitationStatus
import com.daycare.api.domain.InvoiceStatus
import com.daycare.api.domain.InstitutionType
import com.daycare.api.domain.Role
import com.daycare.api.domain.RegistrationRole
import com.daycare.api.domain.ServicePlanType
import com.daycare.api.domain.TenantPaymentStatus
import com.daycare.api.domain.TenantSubscriptionPlan
import com.daycare.api.domain.TenantSubscriptionStatus
import com.daycare.api.domain.UnusedCreditPolicy
import com.daycare.api.persistence.AttendanceRecord
import com.daycare.api.persistence.AttendanceRepository
import com.daycare.api.persistence.AcademicYear
import com.daycare.api.persistence.AcademicYearRepository
import com.daycare.api.persistence.Booking
import com.daycare.api.persistence.BookingRepository
import com.daycare.api.persistence.Branch
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.ChildStaffAssignment
import com.daycare.api.persistence.ChildStaffAssignmentRepository
import com.daycare.api.persistence.Classroom
import com.daycare.api.persistence.ClassroomRepository
import com.daycare.api.persistence.DevelopmentEntry
import com.daycare.api.persistence.DevelopmentEntryRepository
import com.daycare.api.persistence.GuardianLink
import com.daycare.api.persistence.GuardianLinkRepository
import com.daycare.api.persistence.Invitation
import com.daycare.api.persistence.InvitationRepository
import com.daycare.api.persistence.Invoice
import com.daycare.api.persistence.InvoiceRepository
import com.daycare.api.persistence.PaymentProof
import com.daycare.api.persistence.PaymentProofRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.Notification
import com.daycare.api.persistence.NotificationRepository
import com.daycare.api.persistence.Organization
import com.daycare.api.persistence.OrganizationRepository
import com.daycare.api.persistence.OrganizationTypeAssignment
import com.daycare.api.persistence.OrganizationTypeAssignmentRepository
import com.daycare.api.persistence.PlatformAdministrator
import com.daycare.api.persistence.PlatformAdministratorRepository
import com.daycare.api.persistence.CurriculumProgram
import com.daycare.api.persistence.CurriculumProgramRepository
import com.daycare.api.persistence.ServiceEntitlement
import com.daycare.api.persistence.ServiceEntitlementRepository
import com.daycare.api.persistence.ServicePlan
import com.daycare.api.persistence.ServicePlanRepository
import com.daycare.api.persistence.TenantPayment
import com.daycare.api.persistence.TenantPaymentRepository
import com.daycare.api.persistence.TenantSubscription
import com.daycare.api.persistence.TenantSubscriptionRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate
import java.util.Base64
import java.util.UUID

@Component
@Profile("simulation")
@ConditionalOnProperty(prefix = "daycare", name = ["simulation-seed-enabled"], havingValue = "true")
class SimulationDataSeeder(
    private val users: UserProfileRepository,
    private val platformAdministrators: PlatformAdministratorRepository,
    private val organizations: OrganizationRepository,
    private val organizationTypes: OrganizationTypeAssignmentRepository,
    private val academicYears: AcademicYearRepository,
    private val curriculumPrograms: CurriculumProgramRepository,
    private val branches: BranchRepository,
    private val classrooms: ClassroomRepository,
    private val memberships: MembershipRepository,
    private val children: ChildRepository,
    private val staffAssignments: ChildStaffAssignmentRepository,
    private val guardians: GuardianLinkRepository,
    private val subscriptions: TenantSubscriptionRepository,
    private val tenantPayments: TenantPaymentRepository,
    private val plans: ServicePlanRepository,
    private val invoices: InvoiceRepository,
    private val paymentProofs: PaymentProofRepository,
    private val entitlements: ServiceEntitlementRepository,
    private val bookings: BookingRepository,
    private val developmentEntries: DevelopmentEntryRepository,
    private val attendance: AttendanceRepository,
    private val invitations: InvitationRepository,
    private val notifications: NotificationRepository,
) : ApplicationRunner {
    @Transactional
    override fun run(args: ApplicationArguments) {
        if (organizations.existsById(Ids.activeTenant)) return

        val today = LocalDate.now()
        val now = Instant.now()
        val academicYearStart = LocalDate.of(today.year, 7, 1)
        val academicYearEnd = academicYearStart.plusYears(1).minusDays(1)
        users.saveAll(listOf(
            UserProfile(id = Ids.platformAdmin, firebaseUid = "simulation-platform-admin", displayName = "Admin Platform Simulasi", email = "admin@simulation.local"),
            UserProfile(id = Ids.staffAdmin, firebaseUid = "simulation-staff-admin", displayName = "Kepala Sekolah Pelangi", email = "owner@pelangi.simulation.local"),
            UserProfile(id = Ids.teacher, firebaseUid = "simulation-teacher", displayName = "Miss Rani", email = "rani@pelangi.simulation.local"),
            UserProfile(id = Ids.parent, firebaseUid = "simulation-parent", displayName = "Bunda Aruna", email = "bunda@pelangi.simulation.local", registrationRole = RegistrationRole.PARENT),
        ))
        platformAdministrators.save(PlatformAdministrator(userId = Ids.platformAdmin))

        organizations.saveAll(listOf(
            Organization(id = Ids.activeTenant, name = "Daycare Pelangi"),
            Organization(id = Ids.pendingTenant, name = "Daycare Mentari"),
            Organization(id = Ids.trialTenant, name = "Daycare Angkasa"),
        ))
        organizationTypes.saveAll(listOf(
            OrganizationTypeAssignment(id = Ids.activeTenantType, organizationId = Ids.activeTenant, type = InstitutionType.DAYCARE),
            OrganizationTypeAssignment(id = Ids.pendingTenantType, organizationId = Ids.pendingTenant, type = InstitutionType.PAUD),
            OrganizationTypeAssignment(id = Ids.trialTenantType, organizationId = Ids.trialTenant, type = InstitutionType.TK),
        ))
        academicYears.save(AcademicYear(id = Ids.paudAcademicYear, organizationId = Ids.pendingTenant, name = "${academicYearStart.year}/${academicYearEnd.year}", startsOn = academicYearStart, endsOn = academicYearEnd))
        curriculumPrograms.save(CurriculumProgram(id = Ids.paudCurriculum, organizationId = Ids.pendingTenant, academicYearId = Ids.paudAcademicYear, name = "Kurikulum PAUD 2026/2027", description = "Program pembelajaran fondasi untuk kelompok usia dini."))
        branches.saveAll(listOf(
            Branch(id = Ids.activeBranch, organizationId = Ids.activeTenant, name = "Cabang Kemang"),
            Branch(id = Ids.pendingBranch, organizationId = Ids.pendingTenant, name = "Cabang Cilandak"),
            Branch(id = Ids.trialBranch, organizationId = Ids.trialTenant, name = "Cabang Tebet"),
        ))
        classrooms.save(Classroom(id = Ids.activeClassroom, organizationId = Ids.activeTenant, branchId = Ids.activeBranch, name = "Kelas Pelangi"))

        memberships.saveAll(listOf(
            Membership(id = Ids.staffAdminMembership, userId = Ids.staffAdmin, organizationId = Ids.activeTenant, role = Role.STAFF_ADMIN),
            Membership(id = Ids.teacherMembership, userId = Ids.teacher, organizationId = Ids.activeTenant, role = Role.STAFF, branchId = Ids.activeBranch, classroomId = Ids.activeClassroom),
            Membership(id = Ids.parentMembership, userId = Ids.parent, organizationId = Ids.activeTenant, role = Role.PARENT),
        ))

        subscriptions.saveAll(listOf(
            TenantSubscription(id = Ids.activeSubscription, organizationId = Ids.activeTenant, plan = TenantSubscriptionPlan.STANDARD, status = TenantSubscriptionStatus.ACTIVE, periodStart = today.withDayOfMonth(1), periodEnd = today.plusMonths(1).minusDays(1), monthlyFee = java.math.BigDecimal("750000")),
            TenantSubscription(id = Ids.pendingSubscription, organizationId = Ids.pendingTenant, plan = TenantSubscriptionPlan.STARTER, status = TenantSubscriptionStatus.PENDING_PAYMENT, periodStart = today, periodEnd = today.plusMonths(1).minusDays(1), monthlyFee = java.math.BigDecimal("500000")),
            TenantSubscription(id = Ids.trialSubscription, organizationId = Ids.trialTenant, plan = TenantSubscriptionPlan.PREMIUM, status = TenantSubscriptionStatus.TRIAL, periodStart = today, periodEnd = today.plusMonths(3).minusDays(1), trialEndsAt = today.plusMonths(3).minusDays(1)),
        ))
        tenantPayments.saveAll(listOf(
            TenantPayment(id = Ids.activeTenantPayment, subscriptionId = Ids.activeSubscription, organizationId = Ids.activeTenant, amount = BigDecimal("750000"), status = TenantPaymentStatus.PAID, dueDate = today.minusDays(7), paidAt = now.minusSeconds(3 * 24 * 60 * 60L)),
            TenantPayment(id = Ids.pendingTenantPayment, subscriptionId = Ids.pendingSubscription, organizationId = Ids.pendingTenant, amount = BigDecimal("350000"), status = TenantPaymentStatus.PENDING, dueDate = today.plusDays(7)),
            TenantPayment(id = Ids.trialTenantPayment, subscriptionId = Ids.trialSubscription, organizationId = Ids.trialTenant, amount = BigDecimal("1500000"), status = TenantPaymentStatus.PENDING, dueDate = today.plusMonths(3)),
        ))

        val child = children.save(Child(id = Ids.child, organizationId = Ids.activeTenant, branchId = Ids.activeBranch, classroomId = Ids.activeClassroom, firstName = "Aruna", lastName = "Putri", gender = Gender.FEMALE, dateOfBirth = today.minusYears(4)))
        staffAssignments.save(ChildStaffAssignment(id = Ids.childTeacherAssignment, organizationId = Ids.activeTenant, childId = child.id, userId = Ids.teacher, assignmentRole = "MISS"))
        guardians.save(GuardianLink(id = Ids.guardianLink, childId = child.id, userId = Ids.parent))

        val monthlyPlan = plans.save(ServicePlan(id = Ids.monthlyPlan, organizationId = Ids.activeTenant, name = "Paket Bulanan Pelangi", type = ServicePlanType.MONTHLY, price = BigDecimal("1200000"), bookingRequiresApproval = false))
        plans.save(ServicePlan(id = Ids.weeklyPlan, organizationId = Ids.activeTenant, name = "Paket Mingguan", type = ServicePlanType.WEEKLY, price = BigDecimal("450000"), creditCount = 5, unusedCreditPolicy = UnusedCreditPolicy.CARRY_FORWARD, carryForwardDays = 30, bookingRequiresApproval = true))
        val invoice = invoices.save(Invoice(id = Ids.invoice, organizationId = Ids.activeTenant, payerUserId = Ids.parent, invoiceNumber = "SIM-INV-0001", totalAmount = monthlyPlan.price, status = InvoiceStatus.PAID, dueDate = today.minusDays(2), paidAt = now.minusSeconds(24 * 60 * 60L)))
        paymentProofs.save(PaymentProof(id = Ids.paymentProof, invoiceId = invoice.id, status = com.daycare.api.domain.PaymentProofStatus.VERIFIED, fileName = "simulasi-bukti.png", contentType = "image/png", imageData = Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9D6H8AAAAASUVORK5CYII="), note = "Bukti pembayaran simulasi", submittedAt = now.minusSeconds(25 * 60 * 60L), reviewedAt = now.minusSeconds(24 * 60 * 60L), reviewedByUserId = Ids.staffAdmin))
        val entitlement = entitlements.save(ServiceEntitlement(id = Ids.entitlement, organizationId = Ids.activeTenant, branchId = Ids.activeBranch, childId = child.id, ownerUserId = Ids.parent, planId = monthlyPlan.id, invoiceId = invoice.id, planName = monthlyPlan.name, planType = monthlyPlan.type, status = EntitlementStatus.ACTIVE, bookingRequiresApproval = false, periodStart = today.withDayOfMonth(1), periodEnd = today.plusMonths(1).minusDays(1), validUntil = today.plusMonths(1).minusDays(1)))
        bookings.save(Booking(id = Ids.booking, organizationId = Ids.activeTenant, branchId = Ids.activeBranch, childId = child.id, entitlementId = entitlement.id, invoiceId = invoice.id, bookingDate = today.plusDays(1), status = BookingStatus.CONFIRMED, planName = monthlyPlan.name))
        developmentEntries.save(DevelopmentEntry(id = Ids.developmentEntry, organizationId = Ids.activeTenant, branchId = Ids.activeBranch, childId = child.id, authorUserId = Ids.teacher, category = "ACTIVITY", title = "Kolase warna", content = "Aruna mengikuti aktivitas kolase dengan antusias.", recordedAt = now.minusSeconds(3600)))
        attendance.save(AttendanceRecord(id = Ids.attendanceRecord, organizationId = Ids.activeTenant, branchId = Ids.activeBranch, childId = child.id, operationalDate = today, checkedInAt = now.minusSeconds(7200), checkInMethod = "MANUAL"))
        invitations.save(Invitation(id = Ids.pendingTeacherInvitation, organizationId = Ids.activeTenant, email = "guru-baru@pelangi.simulation.local", role = Role.STAFF, branchId = Ids.activeBranch, classroomId = Ids.activeClassroom, status = InvitationStatus.PENDING))
        invitations.save(Invitation(id = Ids.trialStaffAdminInvitation, organizationId = Ids.trialTenant, email = "owner@angkasa.simulation.local", role = Role.STAFF_ADMIN, status = InvitationStatus.PENDING))
        notifications.save(Notification(id = Ids.notification, organizationId = Ids.activeTenant, recipientUserId = Ids.parent, title = "Perkembangan Aruna", body = "Kolase warna telah dibagikan oleh Miss Rani."))
    }

    private object Ids {
        val platformAdmin: UUID = UUID.fromString("a0000000-0000-0000-0000-000000000001")
        val staffAdmin: UUID = UUID.fromString("a0000000-0000-0000-0000-000000000002")
        val teacher: UUID = UUID.fromString("a0000000-0000-0000-0000-000000000003")
        val parent: UUID = UUID.fromString("a0000000-0000-0000-0000-000000000004")
        val activeTenant: UUID = UUID.fromString("b0000000-0000-0000-0000-000000000001")
        val pendingTenant: UUID = UUID.fromString("b0000000-0000-0000-0000-000000000002")
        val trialTenant: UUID = UUID.fromString("b0000000-0000-0000-0000-000000000003")
        val activeTenantType: UUID = UUID.fromString("b0000000-0000-0000-0000-000000000004")
        val pendingTenantType: UUID = UUID.fromString("b0000000-0000-0000-0000-000000000005")
        val trialTenantType: UUID = UUID.fromString("b0000000-0000-0000-0000-000000000006")
        val activeBranch: UUID = UUID.fromString("c0000000-0000-0000-0000-000000000001")
        val pendingBranch: UUID = UUID.fromString("c0000000-0000-0000-0000-000000000002")
        val trialBranch: UUID = UUID.fromString("c0000000-0000-0000-0000-000000000003")
        val activeClassroom: UUID = UUID.fromString("d0000000-0000-0000-0000-000000000001")
        val staffAdminMembership: UUID = UUID.fromString("e0000000-0000-0000-0000-000000000001")
        val teacherMembership: UUID = UUID.fromString("e0000000-0000-0000-0000-000000000002")
        val parentMembership: UUID = UUID.fromString("e0000000-0000-0000-0000-000000000003")
        val activeSubscription: UUID = UUID.fromString("f0000000-0000-0000-0000-000000000001")
        val pendingSubscription: UUID = UUID.fromString("f0000000-0000-0000-0000-000000000002")
        val trialSubscription: UUID = UUID.fromString("f0000000-0000-0000-0000-000000000003")
        val activeTenantPayment: UUID = UUID.fromString("10000000-0000-0000-0000-000000000001")
        val pendingTenantPayment: UUID = UUID.fromString("10000000-0000-0000-0000-000000000002")
        val trialTenantPayment: UUID = UUID.fromString("10000000-0000-0000-0000-000000000003")
        val child: UUID = UUID.fromString("20000000-0000-0000-0000-000000000001")
        val guardianLink: UUID = UUID.fromString("20000000-0000-0000-0000-000000000002")
        val childTeacherAssignment: UUID = UUID.fromString("20000000-0000-0000-0000-000000000003")
        val monthlyPlan: UUID = UUID.fromString("30000000-0000-0000-0000-000000000001")
        val weeklyPlan: UUID = UUID.fromString("30000000-0000-0000-0000-000000000002")
        val invoice: UUID = UUID.fromString("40000000-0000-0000-0000-000000000001")
        val paymentProof: UUID = UUID.fromString("40000000-0000-0000-0000-000000000002")
        val entitlement: UUID = UUID.fromString("50000000-0000-0000-0000-000000000001")
        val booking: UUID = UUID.fromString("60000000-0000-0000-0000-000000000001")
        val developmentEntry: UUID = UUID.fromString("70000000-0000-0000-0000-000000000001")
        val attendanceRecord: UUID = UUID.fromString("80000000-0000-0000-0000-000000000001")
        val pendingTeacherInvitation: UUID = UUID.fromString("90000000-0000-0000-0000-000000000001")
        val notification: UUID = UUID.fromString("90000000-0000-0000-0000-000000000002")
        val trialStaffAdminInvitation: UUID = UUID.fromString("90000000-0000-0000-0000-000000000003")
        val paudAcademicYear: UUID = UUID.fromString("90000000-0000-0000-0000-000000000004")
        val paudCurriculum: UUID = UUID.fromString("90000000-0000-0000-0000-000000000005")
    }
}
