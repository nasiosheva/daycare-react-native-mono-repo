package com.daycare.api.domain

enum class Role { ADMIN, STAFF_ADMIN, STAFF, PARENT }
enum class RegistrationRole { PARENT }
enum class ChildEnrollmentStatus { PENDING, ACTIVE }
enum class Gender { MALE, FEMALE, UNSPECIFIED }
enum class GoalCheckInOutcome { YES, NO }
enum class ChildGoalStatus { ACTIVE, COMPLETED }
enum class ChildGoalOutcome { ACHIEVED, NOT_ACHIEVED }
enum class StaffLeaveRequestType { LEAVE, SICK }
enum class StaffLeaveRequestStatus { PENDING, APPROVED, REJECTED, CANCELLED }
enum class ParentOccupation { PNS, PEGAWAI_SWASTA, PEGAWAI_BUMN, PENGUSAHA, WIRASWASTA, PROFESIONAL, FREELANCER, IBU_RUMAH_TANGGA, TIDAK_BEKERJA, LAINNYA }
enum class ParentIncomeRange { NO_INCOME, UNDER_3_MILLION, THREE_TO_FIVE_MILLION, FIVE_TO_TEN_MILLION, TEN_TO_TWENTY_MILLION, OVER_TWENTY_MILLION }
enum class ParentEnrollmentStatus { PENDING_APPROVAL, APPROVED, REJECTED, EXPIRED, CANCELLED }
enum class ChildCareRole { STAFF, NURSE, MISS }
enum class AttendanceMethod { MANUAL, QR }
enum class AttendanceAction { CHECK_IN, CHECK_OUT }
enum class ChildAbsencePurpose { SICK, OUT_OF_TOWN, FAMILY_EVENT, EMERGENCY, OTHER }
enum class ChildAbsenceRequestStatus { PENDING, APPROVED, REJECTED, CANCELLED }
enum class IncidentSeverity { MINOR, MODERATE, SERIOUS }
enum class IncidentCategory { INJURY, ILLNESS, BEHAVIOR, OTHER }
enum class DevelopmentMediaKind { PHOTO, AUDIO }
enum class DevelopmentCategory { ACTIVITY, MEAL, NAP, OBSERVATION }
enum class GoalDomain { KEMANDIRIAN, BAHASA_KOMUNIKASI, KOGNITIF, MOTORIK_HALUS, MOTORIK_KASAR, SOSIAL_EMOSI }
enum class PlatformKnowledgeCandidateStatus { CANDIDATE, APPROVED, REJECTED, ARCHIVED }
enum class ServicePlanType { DAILY, WEEKLY, MONTHLY }
enum class UnusedCreditPolicy { CARRY_FORWARD, EXPIRE }
enum class ServicePlanDiscountKind { AUTOMATIC, PROMO_CODE }
enum class ServicePlanDiscountType { PERCENTAGE, FIXED_AMOUNT }
enum class CapacityReservationStatus { HELD, RELEASED }
enum class EntitlementStatus { PENDING_PAYMENT, ACTIVE, EXPIRED, EXHAUSTED }
enum class BookingStatus { PENDING_PAYMENT, PENDING_APPROVAL, CONFIRMED, REJECTED, CANCELLED, COMPLETED }
enum class InvoiceStatus { PENDING, PAYMENT_SUBMITTED, PAID, OVERDUE, VOID }
enum class InvoiceSource { SERVICE, OVERTIME, PRIVATE_TUTORING }
enum class PrivateTutorType { STAFF, EXTERNAL }
enum class PrivateTutoringRequestStatus { PENDING_APPROVAL, PENDING_PAYMENT, CONFIRMED, REJECTED, CANCELLED }
enum class PaymentProofStatus { SUBMITTED, VERIFIED, REJECTED }
enum class InvitationStatus { PENDING, ACCEPTED, EXPIRED }
enum class PushNotificationMuteDuration { ONE_HOUR, ONE_WEEK, ONE_MONTH }
enum class TenantSubscriptionPlan { STARTER, STANDARD, PREMIUM }
enum class TenantSubscriptionStatus { TRIAL, PENDING_PAYMENT, ACTIVE, SUSPENDED, EXPIRED }
enum class TenantPaymentStatus { PENDING, PAID, VOID }
enum class InstitutionCapability { DAYCARE_OPERATIONS, ACADEMIC_CURRICULUM }

object InstitutionTypeCodes {
    const val DAYCARE = "DAYCARE"
    const val PAUD = "PAUD"
    const val TK = "TK"
    val builtIn = setOf(DAYCARE, PAUD, TK)
}

fun institutionCapabilities(types: Set<String>): Set<InstitutionCapability> = buildSet {
    if (InstitutionTypeCodes.DAYCARE in types) add(InstitutionCapability.DAYCARE_OPERATIONS)
    if (InstitutionTypeCodes.PAUD in types || InstitutionTypeCodes.TK in types) add(InstitutionCapability.ACADEMIC_CURRICULUM)
}
