package com.daycare.api.domain

enum class Role { ADMIN, STAFF, PARENT }
enum class AttendanceMethod { MANUAL, QR }
enum class AttendanceAction { CHECK_IN, CHECK_OUT }
enum class DevelopmentCategory { ACTIVITY, MEAL, NAP, OBSERVATION }
enum class ServicePlanType { DAILY, WEEKLY, MONTHLY }
enum class UnusedCreditPolicy { CARRY_FORWARD, EXPIRE }
enum class EntitlementStatus { PENDING_PAYMENT, ACTIVE, EXPIRED, EXHAUSTED }
enum class BookingStatus { PENDING_PAYMENT, PENDING_APPROVAL, CONFIRMED, REJECTED, CANCELLED, COMPLETED }
enum class InvoiceStatus { PENDING, PAID, OVERDUE, VOID }
enum class InvitationStatus { PENDING, ACCEPTED, EXPIRED }
