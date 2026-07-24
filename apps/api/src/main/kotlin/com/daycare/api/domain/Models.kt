package com.daycare.api.domain

enum class Role { ADMIN, STAFF_ADMIN, STAFF, PARENT }
enum class RegistrationRole { PARENT }
enum class ChildEnrollmentStatus { PENDING, ACTIVE }
enum class Gender { MALE, FEMALE, UNSPECIFIED }
enum class GoalCheckInOutcome { YES, NO }
enum class ChildGoalStatus { ACTIVE, COMPLETED }
enum class ChildGoalOutcome { ACHIEVED, NOT_ACHIEVED }
enum class ParentEnrollmentStatus { PENDING_PAYMENT, PENDING_APPROVAL, APPROVED, REJECTED, EXPIRED, CANCELLED }
enum class ChildCareRole { STAFF, NURSE, MISS }
enum class AttendanceMethod { MANUAL, QR }
enum class AttendanceAction { CHECK_IN, CHECK_OUT }
enum class DevelopmentCategory { ACTIVITY, MEAL, NAP, OBSERVATION }
enum class ServicePlanType { DAILY, WEEKLY, MONTHLY }
enum class UnusedCreditPolicy { CARRY_FORWARD, EXPIRE }
enum class ServicePlanDiscountKind { AUTOMATIC, PROMO_CODE }
enum class ServicePlanDiscountType { PERCENTAGE, FIXED_AMOUNT }
enum class CapacityReservationStatus { HELD, RELEASED }
enum class EntitlementStatus { PENDING_PAYMENT, ACTIVE, EXPIRED, EXHAUSTED }
enum class BookingStatus { PENDING_PAYMENT, PENDING_APPROVAL, CONFIRMED, REJECTED, CANCELLED, COMPLETED }
enum class InvoiceStatus { PENDING, PAYMENT_SUBMITTED, PAID, OVERDUE, VOID }
enum class PaymentProofStatus { SUBMITTED, VERIFIED, REJECTED }
enum class InvitationStatus { PENDING, ACCEPTED, EXPIRED }
enum class PushNotificationMuteDuration { ONE_HOUR, ONE_WEEK, ONE_MONTH }
enum class TenantSubscriptionPlan { STARTER, STANDARD, PREMIUM }
enum class TenantSubscriptionStatus { TRIAL, PENDING_PAYMENT, ACTIVE, SUSPENDED, EXPIRED }
enum class TenantPaymentStatus { PENDING, PAID, VOID }
enum class InstitutionType { DAYCARE, PAUD, TK }
enum class InstitutionCapability { DAYCARE_OPERATIONS, ACADEMIC_CURRICULUM }

fun institutionCapabilities(types: Set<InstitutionType>): Set<InstitutionCapability> = buildSet {
    if (InstitutionType.DAYCARE in types) add(InstitutionCapability.DAYCARE_OPERATIONS)
    if (InstitutionType.PAUD in types || InstitutionType.TK in types) add(InstitutionCapability.ACADEMIC_CURRICULUM)
}
