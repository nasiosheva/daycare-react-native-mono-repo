package com.daycare.api.config

import com.daycare.api.domain.*
import com.daycare.api.persistence.*
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Profile
import org.springframework.core.annotation.Order
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.nio.charset.StandardCharsets
import java.time.Instant
import java.time.LocalDate
import java.util.Base64
import java.util.UUID

@Component
@Profile("default")
@Order(1)
@ConditionalOnProperty(prefix = "daycare", name = ["local-seed-enabled"], havingValue = "true")
class LocalDemoDataSeeder(
    private val users: UserProfileRepository,
    private val platformAdministrators: PlatformAdministratorRepository,
    private val organizations: OrganizationRepository,
    private val organizationTypes: OrganizationTypeAssignmentRepository,
    private val branches: BranchRepository,
    private val academicYears: AcademicYearRepository,
    private val curriculumPrograms: CurriculumProgramRepository,
    private val levels: LearningLevelRepository,
    private val levelPrograms: LearningLevelCurriculumProgramRepository,
    private val classrooms: ClassroomRepository,
    private val memberships: MembershipRepository,
    private val children: ChildRepository,
    private val placements: ChildPlacementRepository,
    private val guardians: GuardianLinkRepository,
    private val childPrograms: ChildProgramRepository,
    private val childAssignments: ChildStaffAssignmentRepository,
    private val classroomAssignments: ClassroomStaffAssignmentRepository,
    private val classroomPrograms: ClassroomProgramRepository,
    private val attendance: AttendanceRepository,
    private val development: DevelopmentEntryRepository,
    private val invitations: InvitationRepository,
    private val notifications: NotificationRepository,
    private val devices: DeviceTokenRepository,
    private val audits: AuditLogRepository,
    private val subscriptions: TenantSubscriptionRepository,
    private val tenantPayments: TenantPaymentRepository,
    private val plans: ServicePlanRepository,
    private val invoices: InvoiceRepository,
    private val paymentProofs: PaymentProofRepository,
    private val entitlements: ServiceEntitlementRepository,
    private val bookings: BookingRepository,
    private val branchCapacities: BranchCapacitySettingRepository,
    private val capacityReservations: CapacityReservationRepository,
    private val discounts: ServicePlanDiscountRepository,
    private val redemptions: ServicePlanDiscountRedemptionRepository,
    private val templates: ServicePlanTemplateRepository,
    private val parentEnrollments: ParentEnrollmentRepository,
    private val paymentInstructions: TenantPaymentInstructionRepository,
    private val passwordEncoder: PasswordEncoder,
    @Value("\${daycare.local-seed-admin-email}") private val platformAdminEmail: String,
) : ApplicationRunner {
    @Transactional
    override fun run(args: ApplicationArguments) {
        if (organizations.existsById(id("tenant-pelangi"))) return
        val today = LocalDate.now()
        val now = Instant.now()
        val tenant = id("tenant-pelangi")
        val pendingTenant = id("tenant-paud")
        val trialTenant = id("tenant-tk")
        val branch = id("branch-pelangi")
        val classroom = id("classroom-pelangi")
        val parent = user("parent", "Bunda Aruna", "bunda@local.test", "bunda", RegistrationRole.PARENT)
        val applicant = user("applicant", "Bunda Nadia", "nadia@local.test", "nadia", RegistrationRole.PARENT)
        val staffAdmin = user("staff-admin", "Ibu Maya", "owner@pelangi.local.test", "owner")
        val teacher = user("teacher", "Miss Rani", "rani@pelangi.local.test", "rani")
        users.saveAll(listOf(parent, applicant, staffAdmin, teacher))

        organizations.saveAll(listOf(Organization(id = tenant, name = "Daycare Pelangi"), Organization(id = pendingTenant, name = "PAUD Mentari"), Organization(id = trialTenant, name = "TK Angkasa")))
        organizationTypes.saveAll(listOf(
            OrganizationTypeAssignment(id = id("type-daycare"), organizationId = tenant, type = InstitutionTypeCodes.DAYCARE),
            OrganizationTypeAssignment(id = id("type-paud"), organizationId = pendingTenant, type = InstitutionTypeCodes.PAUD),
            OrganizationTypeAssignment(id = id("type-tk"), organizationId = trialTenant, type = InstitutionTypeCodes.TK),
        ))
        branches.saveAll(listOf(
            Branch(id = branch, organizationId = tenant, name = "Cabang Kemang", primary = true),
            Branch(id = id("branch-paud"), organizationId = pendingTenant, name = "Cabang Cilandak", primary = true),
            Branch(id = id("branch-tk"), organizationId = trialTenant, name = "Cabang Tebet", primary = true),
        ))
        val academicYear = id("academic-year")
        val curriculum = id("curriculum")
        val level = id("level-toddler")
        academicYears.save(AcademicYear(id = academicYear, organizationId = tenant, name = "${today.year}/${today.plusYears(1).year}", startsOn = LocalDate.of(today.year, 7, 1), endsOn = LocalDate.of(today.year + 1, 6, 30)))
        curriculumPrograms.save(CurriculumProgram(id = curriculum, organizationId = tenant, academicYearId = academicYear, name = "Kurikulum Tumbuh Ceria", description = "Program perkembangan motorik, bahasa, dan sosial emosional."))
        levels.save(LearningLevel(id = level, organizationId = tenant, name = "Toddler", minAgeMonths = 18, maxAgeMonths = 48, displayOrder = 1))
        levelPrograms.save(LearningLevelCurriculumProgram(id = id("level-curriculum"), learningLevelId = level, curriculumProgramId = curriculum))
        classrooms.save(Classroom(id = classroom, organizationId = tenant, branchId = branch, learningLevelId = level, academicYearId = academicYear, name = "Kelas Pelangi", capacity = 12))

        memberships.saveAll(listOf(
            Membership(id = id("membership-owner"), userId = staffAdmin.id, organizationId = tenant, role = Role.STAFF_ADMIN),
            Membership(id = id("membership-teacher"), userId = teacher.id, organizationId = tenant, role = Role.STAFF, branchId = branch, classroomId = classroom),
            Membership(id = id("membership-parent"), userId = parent.id, organizationId = tenant, role = Role.PARENT),
        ))
        val aruna = Child(id = id("child-aruna"), organizationId = tenant, branchId = branch, classroomId = classroom, firstName = "Aruna", lastName = "Putri", gender = Gender.FEMALE, dateOfBirth = today.minusYears(3))
        val citra = Child(id = id("child-citra"), organizationId = tenant, branchId = branch, classroomId = classroom, firstName = "Citra", lastName = "Lestari", gender = Gender.FEMALE, dateOfBirth = today.minusYears(2))
        val bima = Child(id = id("child-bima"), organizationId = tenant, branchId = branch, firstName = "Bima", lastName = "Pratama", gender = Gender.MALE, dateOfBirth = today.minusYears(4), enrollmentStatus = ChildEnrollmentStatus.PENDING)
        val damar = Child(id = id("child-damar"), organizationId = tenant, branchId = branch, firstName = "Damar", lastName = "Saputra", gender = Gender.MALE, dateOfBirth = today.minusYears(2), enrollmentStatus = ChildEnrollmentStatus.PENDING)
        children.saveAll(listOf(aruna, citra, bima, damar))
        placements.saveAll(listOf(
            ChildPlacement(id = id("placement-aruna"), organizationId = tenant, childId = aruna.id, classroomId = classroom, learningLevelId = level, academicYearId = academicYear, startsOn = today.minusMonths(4)),
            ChildPlacement(id = id("placement-citra"), organizationId = tenant, childId = citra.id, classroomId = classroom, learningLevelId = level, academicYearId = academicYear, startsOn = today.minusMonths(2)),
        ))
        guardians.saveAll(listOf(GuardianLink(id = id("guardian-aruna"), childId = aruna.id, userId = parent.id), GuardianLink(id = id("guardian-citra"), childId = citra.id, userId = parent.id), GuardianLink(id = id("guardian-bima"), childId = bima.id, userId = applicant.id), GuardianLink(id = id("guardian-damar"), childId = damar.id, userId = applicant.id)))
        childPrograms.save(ChildProgram(id = id("child-program"), organizationId = tenant, childId = aruna.id, name = "Stimulasi Bahasa", description = "Membaca cerita dan mengenal kosakata harian."))
        childAssignments.save(ChildStaffAssignment(id = id("child-teacher"), organizationId = tenant, childId = aruna.id, userId = teacher.id, assignmentRole = "MISS"))
        classroomAssignments.save(ClassroomStaffAssignment(id = id("classroom-teacher"), organizationId = tenant, classroomId = classroom, userId = teacher.id, assignmentRole = "MISS"))
        classroomPrograms.save(ClassroomProgram(id = id("classroom-program"), organizationId = tenant, classroomId = classroom, name = "Seni dan Motorik", description = "Kolase, musik, dan permainan gerak."))

        val subscription = TenantSubscription(id = id("subscription-active"), organizationId = tenant, plan = TenantSubscriptionPlan.STANDARD, status = TenantSubscriptionStatus.ACTIVE, periodStart = today.withDayOfMonth(1), periodEnd = today.plusMonths(1).minusDays(1), monthlyFee = BigDecimal("750000"))
        val pendingSubscription = TenantSubscription(id = id("subscription-pending"), organizationId = pendingTenant, plan = TenantSubscriptionPlan.STARTER, status = TenantSubscriptionStatus.PENDING_PAYMENT, periodStart = today, periodEnd = today.plusMonths(1).minusDays(1), monthlyFee = BigDecimal("500000"))
        val trialSubscription = TenantSubscription(id = id("subscription-trial"), organizationId = trialTenant, plan = TenantSubscriptionPlan.PREMIUM, status = TenantSubscriptionStatus.TRIAL, periodStart = today, periodEnd = today.plusMonths(3).minusDays(1), trialEndsAt = today.plusMonths(3).minusDays(1))
        subscriptions.saveAll(listOf(subscription, pendingSubscription, trialSubscription))
        tenantPayments.saveAll(listOf(TenantPayment(id = id("payment-active"), subscriptionId = subscription.id, organizationId = tenant, amount = BigDecimal("750000"), status = TenantPaymentStatus.PAID, dueDate = today.minusDays(7), paidAt = now.minusSeconds(86_400)), TenantPayment(id = id("payment-pending"), subscriptionId = pendingSubscription.id, organizationId = pendingTenant, amount = BigDecimal("500000"), status = TenantPaymentStatus.PENDING, dueDate = today.plusDays(7)), TenantPayment(id = id("payment-trial"), subscriptionId = trialSubscription.id, organizationId = trialTenant, amount = BigDecimal("1500000"), status = TenantPaymentStatus.PENDING, dueDate = today.plusMonths(3))))
        val monthlyPlan = ServicePlan(id = id("plan-monthly"), organizationId = tenant, name = "Paket Bulanan Pelangi", type = ServicePlanType.MONTHLY, price = BigDecimal("1200000"), bookingRequiresApproval = false, dailyCapacity = 12)
        val weeklyPlan = ServicePlan(id = id("plan-weekly"), organizationId = tenant, name = "Paket Mingguan Lima Hari", type = ServicePlanType.WEEKLY, price = BigDecimal("450000"), creditCount = 5, unusedCreditPolicy = UnusedCreditPolicy.CARRY_FORWARD, carryForwardDays = 30, bookingRequiresApproval = true, dailyCapacity = 12)
        plans.saveAll(listOf(monthlyPlan, weeklyPlan))
        paymentInstructions.save(TenantPaymentInstruction(id = id("payment-instruction-pelangi"), organizationId = tenant, name = "BCA", accountHolder = "Daycare Pelangi", accountNumber = "1234567890", note = "Gunakan nama anak pada berita transfer."))
        branchCapacities.save(BranchCapacitySetting(id = id("branch-capacity"), organizationId = tenant, branchId = branch, dailyCapacity = 12))
        templates.save(ServicePlanTemplate(id = id("weekly-template"), organizationId = tenant, name = "Template Mingguan Sekolah", type = ServicePlanType.WEEKLY, suggestedPrice = BigDecimal("450000"), creditCount = 5, unusedCreditPolicy = UnusedCreditPolicy.CARRY_FORWARD, carryForwardDays = 30, bookingRequiresApproval = true, dailyCapacity = 12))
        val promo = ServicePlanDiscount(id = id("promo"), organizationId = tenant, servicePlanId = weeklyPlan.id, kind = ServicePlanDiscountKind.PROMO_CODE, name = "Promo Saudara", promoCode = "SAUDARA10", type = ServicePlanDiscountType.PERCENTAGE, value = BigDecimal("10"), usageLimit = 20)
        discounts.saveAll(listOf(promo, ServicePlanDiscount(id = id("automatic-discount"), organizationId = tenant, servicePlanId = monthlyPlan.id, kind = ServicePlanDiscountKind.AUTOMATIC, name = "Diskon Pendaftaran", type = ServicePlanDiscountType.FIXED_AMOUNT, value = BigDecimal("50000"))))
        val invoiceAruna = invoice("invoice-aruna", tenant, parent.id, "LOCAL-INV-0001", BigDecimal("1200000"), BigDecimal.ZERO, InvoiceStatus.PAID, today.minusDays(2), now.minusSeconds(86_400))
        val invoiceCitra = invoice("invoice-citra", tenant, parent.id, "LOCAL-INV-0002", BigDecimal("450000"), BigDecimal.ZERO, InvoiceStatus.PAID, today.minusDays(1), now.minusSeconds(43_200))
        val invoiceBima = invoice("invoice-bima", tenant, applicant.id, "LOCAL-INV-0003", BigDecimal("450000"), BigDecimal("45000"), InvoiceStatus.PAID, today.minusDays(1), now.minusSeconds(43_200), promo.name, promo.promoCode)
        val invoiceDamar = invoice("invoice-damar", tenant, applicant.id, "LOCAL-INV-0004", BigDecimal("450000"), BigDecimal.ZERO, InvoiceStatus.PAYMENT_SUBMITTED, today.plusDays(2), null)
        invoices.saveAll(listOf(invoiceAruna, invoiceCitra, invoiceBima, invoiceDamar))
        paymentProofs.save(PaymentProof(id = id("payment-proof-damar"), invoiceId = invoiceDamar.id, status = PaymentProofStatus.SUBMITTED, fileName = "bukti-transfer.png", contentType = "image/png", imageData = Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9D6H8AAAAASUVORK5CYII="), note = "Transfer untuk Damar", submittedAt = now.minusSeconds(1_800)))
        redemptions.save(ServicePlanDiscountRedemption(id = id("promo-redemption"), discountId = promo.id, invoiceId = invoiceBima.id))
        val entitlementAruna = entitlement("entitlement-aruna", tenant, branch, aruna.id, parent.id, monthlyPlan, invoiceAruna.id, EntitlementStatus.ACTIVE, null, 0, today)
        val entitlementCitra = entitlement("entitlement-citra", tenant, branch, citra.id, parent.id, weeklyPlan, invoiceCitra.id, EntitlementStatus.ACTIVE, 5, 1, today)
        val entitlementBima = entitlement("entitlement-bima", tenant, branch, bima.id, applicant.id, weeklyPlan, invoiceBima.id, EntitlementStatus.ACTIVE, 5, 0, today)
        val entitlementDamar = entitlement("entitlement-damar", tenant, branch, damar.id, applicant.id, weeklyPlan, invoiceDamar.id, EntitlementStatus.PENDING_PAYMENT, 5, 0, today)
        entitlements.saveAll(listOf(entitlementAruna, entitlementCitra, entitlementBima, entitlementDamar))
        val booking = Booking(id = id("booking-citra"), organizationId = tenant, branchId = branch, childId = citra.id, entitlementId = entitlementCitra.id, invoiceId = invoiceCitra.id, bookingDate = today.plusDays(1), status = BookingStatus.PENDING_APPROVAL, planName = weeklyPlan.name)
        bookings.save(booking)
        capacityReservations.save(CapacityReservation(id = id("capacity-citra"), organizationId = tenant, branchId = branch, servicePlanId = weeklyPlan.id, entitlementId = entitlementCitra.id, bookingId = booking.id, capacityDate = booking.bookingDate, status = CapacityReservationStatus.HELD))
        parentEnrollments.saveAll(listOf(
            ParentEnrollment(id = id("enrollment-bima"), userId = applicant.id, organizationId = tenant, branchId = branch, childId = bima.id, invoiceId = invoiceBima.id, entitlementId = entitlementBima.id, selectedPlanId = weeklyPlan.id, selectedPlanName = weeklyPlan.name, selectedPlanType = weeklyPlan.type, selectedSubtotalAmount = invoiceBima.subtotalAmount, selectedDiscountAmount = invoiceBima.discountAmount, selectedDiscountName = invoiceBima.discountName, selectedDiscountCode = invoiceBima.discountCode, selectedTotalAmount = invoiceBima.totalAmount, selectedCreditCount = weeklyPlan.creditCount, selectedUnusedCreditPolicy = weeklyPlan.unusedCreditPolicy, selectedCarryForwardDays = weeklyPlan.carryForwardDays, selectedBookingRequiresApproval = weeklyPlan.bookingRequiresApproval, status = ParentEnrollmentStatus.APPROVED),
            ParentEnrollment(id = id("enrollment-damar"), userId = applicant.id, organizationId = tenant, branchId = branch, childId = damar.id, invoiceId = invoiceDamar.id, entitlementId = entitlementDamar.id, selectedPlanId = weeklyPlan.id, selectedPlanName = weeklyPlan.name, selectedPlanType = weeklyPlan.type, selectedSubtotalAmount = invoiceDamar.subtotalAmount, selectedDiscountAmount = invoiceDamar.discountAmount, selectedDiscountName = invoiceDamar.discountName, selectedDiscountCode = invoiceDamar.discountCode, selectedTotalAmount = invoiceDamar.totalAmount, selectedCreditCount = weeklyPlan.creditCount, selectedUnusedCreditPolicy = weeklyPlan.unusedCreditPolicy, selectedCarryForwardDays = weeklyPlan.carryForwardDays, selectedBookingRequiresApproval = weeklyPlan.bookingRequiresApproval, status = ParentEnrollmentStatus.APPROVED),
        ))
        attendance.save(AttendanceRecord(id = id("attendance-aruna"), organizationId = tenant, branchId = branch, childId = aruna.id, operationalDate = today, checkedInAt = now.minusSeconds(7_200), checkInMethod = "MANUAL"))
        development.save(DevelopmentEntry(id = id("development-aruna"), organizationId = tenant, branchId = branch, childId = aruna.id, authorUserId = teacher.id, category = "ACTIVITY", title = "Kolase warna", content = "Aruna mengikuti aktivitas kolase dengan antusias.", recordedAt = now.minusSeconds(3_600)))
        invitations.save(Invitation(id = id("invitation-teacher"), organizationId = tenant, email = "guru-baru@pelangi.local.test", role = Role.STAFF, branchId = branch, classroomId = classroom, status = InvitationStatus.PENDING))
        notifications.save(Notification(id = id("notification-parent"), organizationId = tenant, recipientUserId = parent.id, title = "Perkembangan Aruna", body = "Kolase warna telah dibagikan oleh Miss Rani.", actionPath = "/development"))
        devices.save(DeviceToken(id = id("device-parent"), organizationId = tenant, userId = parent.id, token = "ExponentPushToken[local-demo-parent]", platform = "android"))
        audits.save(AuditLog(id = id("audit-attendance"), organizationId = tenant, actorUserId = teacher.id, entityType = "ATTENDANCE", entityId = id("attendance-aruna"), action = "CHECK_IN", source = "MANUAL"))
        requireCompleteSeed()
    }

    private fun user(key: String, displayName: String, email: String, username: String, registrationRole: RegistrationRole? = null) = UserProfile(id = id("user-$key"), firebaseUid = "local:$username", displayName = displayName, username = username, email = email, registrationRole = registrationRole, localPasswordHash = passwordEncoder.encode("123123"))
    private fun invoice(key: String, organizationId: UUID, payerUserId: UUID, number: String, subtotal: BigDecimal, discount: BigDecimal, status: InvoiceStatus, dueDate: LocalDate, paidAt: Instant?, discountName: String? = null, discountCode: String? = null) = Invoice(id = id(key), organizationId = organizationId, payerUserId = payerUserId, invoiceNumber = number, subtotalAmount = subtotal, discountAmount = discount, discountName = discountName, discountCode = discountCode, totalAmount = subtotal - discount, status = status, dueDate = dueDate, paidAt = paidAt)
    private fun entitlement(key: String, organizationId: UUID, branchId: UUID, childId: UUID, ownerUserId: UUID, plan: ServicePlan, invoiceId: UUID, status: EntitlementStatus, totalCredits: Int?, reservedCredits: Int, today: LocalDate) = ServiceEntitlement(id = id(key), organizationId = organizationId, branchId = branchId, childId = childId, ownerUserId = ownerUserId, planId = plan.id, invoiceId = invoiceId, planName = plan.name, planType = plan.type, status = status, totalCredits = totalCredits, reservedCredits = reservedCredits, bookingRequiresApproval = plan.bookingRequiresApproval, periodStart = today, periodEnd = if (plan.type == ServicePlanType.MONTHLY) today.plusMonths(1).minusDays(1) else today.plusDays(6), validUntil = if (plan.type == ServicePlanType.MONTHLY) today.plusMonths(1).minusDays(1) else today.plusDays(36))
    private fun id(key: String): UUID = UUID.nameUUIDFromBytes("umur-emas-local-seed:$key".toByteArray(StandardCharsets.UTF_8))
    private fun requireCompleteSeed() {
        val counts = mapOf(
            "users" to users.count(), "platform_administrators" to platformAdministrators.count(), "organizations" to organizations.count(), "organization_types" to organizationTypes.count(), "branches" to branches.count(), "academic_years" to academicYears.count(), "curriculum_programs" to curriculumPrograms.count(), "learning_levels" to levels.count(), "learning_level_curriculum_programs" to levelPrograms.count(), "classrooms" to classrooms.count(), "memberships" to memberships.count(), "children" to children.count(), "child_placements" to placements.count(), "guardian_links" to guardians.count(), "child_programs" to childPrograms.count(), "child_staff_assignments" to childAssignments.count(), "classroom_staff_assignments" to classroomAssignments.count(), "classroom_programs" to classroomPrograms.count(), "attendance_records" to attendance.count(), "development_entries" to development.count(), "invitations" to invitations.count(), "notifications" to notifications.count(), "device_tokens" to devices.count(), "audit_log" to audits.count(), "tenant_subscriptions" to subscriptions.count(), "tenant_payments" to tenantPayments.count(), "service_plans" to plans.count(), "invoices" to invoices.count(), "payment_proofs" to paymentProofs.count(), "service_entitlements" to entitlements.count(), "bookings" to bookings.count(), "branch_capacity_settings" to branchCapacities.count(), "capacity_reservations" to capacityReservations.count(), "service_plan_discounts" to discounts.count(), "service_plan_discount_redemptions" to redemptions.count(), "service_plan_templates" to templates.count(), "parent_enrollments" to parentEnrollments.count(), "tenant_payment_instructions" to paymentInstructions.count(),
        )
        require(counts.values.all { it > 0L }) { "Local demo seed is incomplete: ${counts.filterValues { it == 0L }.keys.joinToString()}" }
    }
}
