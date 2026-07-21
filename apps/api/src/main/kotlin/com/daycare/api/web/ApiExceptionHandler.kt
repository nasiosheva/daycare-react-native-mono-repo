package com.daycare.api.web

import com.daycare.api.service.AttendanceConflict
import org.springframework.context.MessageSource
import org.springframework.http.HttpStatus
import org.springframework.http.ProblemDetail
import org.springframework.security.access.AccessDeniedException
import org.springframework.context.i18n.LocaleContextHolder
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class ApiExceptionHandler(private val messages: MessageSource) {
    @ExceptionHandler(IllegalArgumentException::class)
    fun invalidRequest(error: IllegalArgumentException): ProblemDetail = problem(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", error.message)
    @ExceptionHandler(IllegalStateException::class)
    fun invalidState(error: IllegalStateException): ProblemDetail = problem(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", error.message)
    @ExceptionHandler(AttendanceConflict::class)
    fun conflict(error: AttendanceConflict): ProblemDetail = problem(HttpStatus.CONFLICT, "ATTENDANCE_CONFLICT", error.message)
    @ExceptionHandler(AccessDeniedException::class)
    fun forbidden(error: AccessDeniedException): ProblemDetail = problem(HttpStatus.FORBIDDEN, "FORBIDDEN", error.message)
    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun validationError(error: MethodArgumentNotValidException): ProblemDetail = problem(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "validation")
    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun unreadableRequest(error: HttpMessageNotReadableException): ProblemDetail = problem(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "invalid_request")

    private fun problem(status: HttpStatus, code: String, detail: String?): ProblemDetail = ProblemDetail.forStatusAndDetail(status, messageFor(detail)).apply { setProperty("code", code) }

    private fun messageFor(detail: String?): String = messages.getMessage(errorKeys[detail] ?: "error.request", null, LocaleContextHolder.getLocale())

    private companion object {
        val errorKeys = mapOf(
            "validation" to "error.validation", "invalid_request" to "error.invalidRequest",
            "You do not have permission for this organization" to "error.organizationAccess",
            "Tenant subscription is not active" to "error.subscriptionInactive",
            "This feature is not enabled for the institution" to "error.featureUnavailable",
            "You do not have platform administrator access" to "error.platformAdminAccess",
            "Platform administrators do not have tenant child access" to "error.platformChildAccess",
            "Child belongs to a different branch" to "error.childBranch", "You cannot access this child" to "error.childAccess", "Child belongs to a different organization" to "error.childOrganization",
            "Child is already checked in" to "error.alreadyCheckedIn", "Attendance for this operational day is closed" to "error.attendanceClosed", "Child must be checked in before check-out" to "error.checkInRequired",
            "Child does not have a confirmed booking or active monthly plan" to "error.bookingEligibility", "Booking service entitlement was not found" to "error.entitlementNotFound", "Booking service entitlement is not active" to "error.entitlementInactive",
            "QR token is invalid" to "error.qrInvalid", "QR token has expired" to "error.qrExpired", "QR token is required" to "error.qrRequired",
            "Child was not found" to "error.childNotFound", "Child branch was not found" to "error.branchNotFound", "Branch was not found" to "error.branchNotFound",
            "Service plan was not found" to "error.servicePlanNotFound", "Service entitlement was not found" to "error.entitlementNotFound", "Invoice entitlement was not found" to "error.entitlementNotFound", "Booking was not found" to "error.bookingNotFound", "Invoice was not found" to "error.invoiceNotFound", "Invoice belongs to a different organization" to "error.invoiceOrganization",
            "Tenant payment was not found" to "error.tenantPaymentNotFound", "Tenant subscription was not found" to "error.tenantSubscriptionNotFound", "Tenant was not found" to "error.tenantNotFound", "Tenant branch was not found" to "error.branchNotFound", "Academic year was not found" to "error.academicYearNotFound",
            "At least one institution type is required" to "error.institutionTypeRequired", "Monthly fee is required to renew a tenant subscription" to "error.tenantRenewalFee", "An active subscription can only be renewed after its current period ends" to "error.tenantRenewalActive", "Only a suspended subscription can be reactivated manually" to "error.tenantReactivate",
            "Staff Admin invitation was not found" to "error.staffAdminInvitationNotFound",
            "Child program was not found" to "error.childProgramNotFound", "Child program belongs to a different child" to "error.childProgramScope",
            "Only active Staff Admin or Staff users can be assigned to a child" to "error.childAssignmentStaff", "Staff member is already assigned to this child" to "error.childAssignmentDuplicate",
            "Child staff assignment was not found" to "error.childAssignmentNotFound", "Child staff assignment belongs to a different child" to "error.childAssignmentScope",
            "Only active Staff Admin or Staff users in this tenant can have their password changed" to "error.staffPasswordAccess", "Tenant user was not found" to "error.tenantUserNotFound", "Platform administrator record was not found" to "error.platformAdminNotFound"
        )
    }
}
