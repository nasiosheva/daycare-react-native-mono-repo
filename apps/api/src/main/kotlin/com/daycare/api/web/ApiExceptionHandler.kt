package com.daycare.api.web

import com.daycare.api.service.AttendanceConflict
import com.daycare.api.service.InvalidLocalCredentialsException
import com.daycare.api.service.IdentityRegistrationRequiredException
import com.daycare.api.service.LocalAuthenticationError
import com.daycare.api.service.FirebaseIdentityError
import com.daycare.api.service.TenantUserAccountError
import com.daycare.api.service.DevelopmentEntryMediaError
import com.daycare.api.service.ChildIncidentError
import com.daycare.api.service.ParentEnrollmentError
import com.daycare.api.service.TenantPaymentInstructionError
import com.daycare.api.service.StaffLeaveRequestError
import com.daycare.api.service.ChildAttendanceReportError
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
    @ExceptionHandler(InvalidLocalCredentialsException::class)
    fun invalidLocalCredentials(error: InvalidLocalCredentialsException): ProblemDetail = problem(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_FAILED", error.message)
    @ExceptionHandler(IdentityRegistrationRequiredException::class)
    fun registrationRequired(error: IdentityRegistrationRequiredException): ProblemDetail = problem(HttpStatus.CONFLICT, "REGISTRATION_REQUIRED", error.message)
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
            LocalAuthenticationError.INVALID_CREDENTIALS to "error.invalidLocalCredentials",
            LocalAuthenticationError.DISPLAY_NAME_REQUIRED to "error.localDisplayNameRequired",
            LocalAuthenticationError.EMAIL_REQUIRED to "error.localEmailRequired",
            LocalAuthenticationError.PASSWORD_TOO_SHORT to "error.localPasswordTooShort",
            LocalAuthenticationError.EMAIL_REGISTERED to "error.emailRegistered",
            LocalAuthenticationError.USER_NOT_FOUND to "error.localUserNotFound",
            LocalAuthenticationError.VERIFIED_EMAIL_MISMATCH to "error.verifiedEmailMismatch",
            LocalAuthenticationError.PHONE_REGISTERED to "error.phoneRegistered",
            "identity.registration_required" to "error.identityRegistrationRequired",
            FirebaseIdentityError.ACCOUNT_READ_FAILED to "error.firebaseAccountReadFailed",
            FirebaseIdentityError.ACCOUNT_CREATE_FAILED to "error.firebaseAccountCreateFailed",
            FirebaseIdentityError.PASSWORD_UPDATE_FAILED to "error.firebasePasswordUpdateFailed",
            FirebaseIdentityError.SERVICE_ACCOUNT_MISSING to "error.firebaseConfiguration",
            TenantUserAccountError.DISPLAY_NAME_REQUIRED to "error.tenantUserDisplayNameRequired",
            TenantUserAccountError.USERNAME_REQUIRED to "error.tenantUserUsernameRequired",
            TenantUserAccountError.USERNAME_REGISTERED to "error.tenantUserUsernameRegistered",
            TenantUserAccountError.EMAIL_REQUIRED to "error.tenantUserEmailRequired",
            TenantUserAccountError.PASSWORD_TOO_SHORT to "error.tenantUserPasswordTooShort",
            TenantUserAccountError.EMAIL_REGISTERED to "error.emailRegistered",
            TenantUserAccountError.STAFF_EDIT_NOT_ALLOWED to "error.tenantUserStaffEditNotAllowed",
            DevelopmentEntryMediaError.NOT_FOUND to "error.developmentEntryNotFound",
            DevelopmentEntryMediaError.UNAVAILABLE to "error.developmentEntryUnavailable",
            DevelopmentEntryMediaError.PHOTO_MISSING to "error.developmentPhotoMissing",
            DevelopmentEntryMediaError.PHOTO_TYPE to "error.developmentPhotoType",
            DevelopmentEntryMediaError.PHOTO_INVALID to "error.developmentPhotoInvalid",
            DevelopmentEntryMediaError.PHOTO_TOO_LARGE to "error.developmentPhotoTooLarge",
            DevelopmentEntryMediaError.MEDIA_NOT_FOUND to "error.developmentMediaNotFound",
            DevelopmentEntryMediaError.AUDIO_TYPE to "error.developmentAudioType",
            DevelopmentEntryMediaError.AUDIO_INVALID to "error.developmentAudioInvalid",
            DevelopmentEntryMediaError.AUDIO_TOO_LARGE to "error.developmentAudioTooLarge",
            ChildIncidentError.NOT_FOUND to "error.childIncidentNotFound",
            ChildIncidentError.UNAVAILABLE to "error.childIncidentUnavailable",
            ChildIncidentError.PHOTO_MISSING to "error.childIncidentPhotoMissing",
            ChildIncidentError.PHOTO_TYPE to "error.childIncidentPhotoType",
            ChildIncidentError.PHOTO_INVALID to "error.childIncidentPhotoInvalid",
            ChildIncidentError.PHOTO_TOO_LARGE to "error.childIncidentPhotoTooLarge",
            ParentEnrollmentError.ALREADY_ACTIVE to "error.parentEnrollmentAlreadyActive",
            ParentEnrollmentError.BOOKINGS_NOT_ALLOWED to "error.parentEnrollmentBookingsNotAllowed",
            ParentEnrollmentError.NOT_FOUND to "error.parentEnrollmentNotFound",
            ParentEnrollmentError.CANNOT_APPROVE to "error.parentEnrollmentCannotApprove",
            ParentEnrollmentError.PAYMENT_INSTRUCTION_REQUIRED to "error.parentEnrollmentPaymentInstructionRequired",
            ParentEnrollmentError.PARENT_NOT_FOUND to "error.parentEnrollmentParentNotFound",
            ParentEnrollmentError.CANNOT_RETRY to "error.parentEnrollmentCannotRetry",
            ParentEnrollmentError.CANNOT_CANCEL to "error.parentEnrollmentCannotCancel",
            TenantPaymentInstructionError.NOT_FOUND to "error.paymentInstructionNotFound",
            StaffLeaveRequestError.NOT_FOUND to "error.staffLeaveRequestNotFound",
            StaffLeaveRequestError.UNAVAILABLE to "error.staffLeaveRequestUnavailable",
            StaffLeaveRequestError.EVIDENCE_MISSING to "error.staffLeaveEvidenceMissing",
            StaffLeaveRequestError.EVIDENCE_TYPE to "error.staffLeaveEvidenceType",
            StaffLeaveRequestError.EVIDENCE_INVALID to "error.staffLeaveEvidenceInvalid",
            StaffLeaveRequestError.EVIDENCE_TOO_LARGE to "error.staffLeaveEvidenceTooLarge",
            StaffLeaveRequestError.START_DATE_PAST to "error.staffLeaveStartDatePast",
            StaffLeaveRequestError.DATE_RANGE to "error.staffLeaveDateRange",
            StaffLeaveRequestError.PERIOD_CONFLICT to "error.staffLeavePeriodConflict",
            StaffLeaveRequestError.REASON_REQUIRED to "error.staffLeaveReasonRequired",
            StaffLeaveRequestError.NOT_PENDING to "error.staffLeaveNotPending",
            StaffLeaveRequestError.REJECTION_REASON_REQUIRED to "error.staffLeaveRejectionReasonRequired",
            ChildAttendanceReportError.DATE_RANGE.name to "error.childAttendanceReportDateRange",
            "You do not have permission for this organization" to "error.organizationAccess",
            "Tenant subscription is not active" to "error.subscriptionInactive",
            "This feature is not enabled for the institution" to "error.featureUnavailable",
            "You do not have platform administrator access" to "error.platformAdminAccess",
            "Platform administrators do not have tenant child access" to "error.platformChildAccess",
            "Child belongs to a different branch" to "error.childBranch", "You cannot access this child" to "error.childAccess", "Child belongs to a different organization" to "error.childOrganization",
            "Child is already checked in" to "error.alreadyCheckedIn", "Attendance for this operational day is closed" to "error.attendanceClosed", "Child must be checked in before check-out" to "error.checkInRequired",
            "Child does not have a confirmed booking or active monthly plan" to "error.bookingEligibility", "Booking service entitlement was not found" to "error.entitlementNotFound", "Booking service entitlement is not active" to "error.entitlementInactive",
            "QR token is invalid" to "error.qrInvalid", "QR token has expired" to "error.qrExpired", "QR token is required" to "error.qrRequired",
            "Child was not found" to "error.childNotFound", "Child branch was not found" to "error.branchNotFound", "Branch was not found" to "error.branchNotFound", "Branch belongs to a different organization" to "error.branchUnavailable",
            "Service plan was not found" to "error.servicePlanNotFound", "Service entitlement was not found" to "error.entitlementNotFound", "Invoice entitlement was not found" to "error.entitlementNotFound", "Booking was not found" to "error.bookingNotFound", "Invoice was not found" to "error.invoiceNotFound", "Invoice belongs to a different organization" to "error.invoiceOrganization",
            "Branch capacity is full for one or more booking dates" to "error.branchCapacityFull", "Service plan capacity is full for one or more booking dates" to "error.servicePlanCapacityFull", "Daily capacity must be positive" to "error.dailyCapacity", "Daily capacity cannot be lower than held reservations" to "error.dailyCapacityHeld",
            "Promo code is invalid or expired" to "error.promoInvalid", "Service plan discount was not found" to "error.discountNotFound", "Service plan discount belongs to a different service plan" to "error.discountScope", "Service plan template was not found" to "error.templateNotFound", "Service plan template belongs to a different organization" to "error.templateScope",
            "Tenant payment was not found" to "error.tenantPaymentNotFound", "Tenant subscription was not found" to "error.tenantSubscriptionNotFound", "Tenant was not found" to "error.tenantNotFound", "Tenant branch was not found" to "error.branchNotFound", "Academic year was not found" to "error.academicYearNotFound",
            "At least one institution type is required" to "error.institutionTypeRequired", "Monthly fee must not be set when tenant uses a trial" to "error.tenantTrialMonthlyFee", "Monthly fee is required to renew a tenant subscription" to "error.tenantRenewalFee", "An active subscription can only be renewed after its current period ends" to "error.tenantRenewalActive", "Only a suspended subscription can be reactivated manually" to "error.tenantReactivate",
            "Institution type already exists" to "error.institutionTypeDuplicate", "Institution type is not available" to "error.institutionTypeUnavailable", "Institution type name is invalid" to "error.institutionTypeNameInvalid",
            "Institution type was not found" to "error.institutionTypeNotFound", "Built-in institution type cannot be deleted" to "error.institutionTypeBuiltIn", "Institution type is used by a tenant" to "error.institutionTypeInUse", "Institution type logo must be a valid HTTPS URL" to "error.institutionTypeLogoInvalid", "Institution type parameters exceed the allowed limit" to "error.institutionTypeParametersLimit", "Institution type parameter key is invalid" to "error.institutionTypeParameterKeyInvalid", "Institution type parameter value is too long" to "error.institutionTypeParameterValueTooLong", "Institution type parameter key is duplicated" to "error.institutionTypeParameterKeyDuplicate",
            "Staff Admin account was not found" to "error.staffAdminAccountNotFound", "Primary Staff Admin cannot be removed" to "error.primaryStaffAdminProtected", "Primary Staff Admin cannot be edited" to "error.primaryStaffAdminEditProtected",
            "Staff Admin invitation was not found" to "error.staffAdminInvitationNotFound",
            "Child program was not found" to "error.childProgramNotFound", "Child program belongs to a different child" to "error.childProgramScope",
            "Child program step was not found" to "error.childProgramStepNotFound", "Child program step belongs to a different program" to "error.childProgramStepScope",
            "Child program has history and cannot be deleted" to "error.childProgramHistory", "Child program step has notes and cannot be deleted" to "error.childProgramStepHistory",
            "Child program must be shared with Parent first" to "error.childProgramParentShareRequired", "Child program is not shared with Parent" to "error.childProgramNotShared",
            "You do not have permission to manage child programs" to "error.childProgramPermission", "Only active Staff users in this tenant can have child program permission changed" to "error.childProgramPermissionStaff",
            "Only active Staff Admin or Staff users can be assigned to a child" to "error.childAssignmentStaff", "Staff member is already assigned to this child" to "error.childAssignmentDuplicate",
            "Child staff assignment was not found" to "error.childAssignmentNotFound", "Child staff assignment belongs to a different child" to "error.childAssignmentScope",
            "Parent account was not found" to "error.childGuardianNotFound", "This account is not linked to this child" to "error.childGuardianNotLinked",
            "Only active Staff Admin or Staff users in this tenant can have their password changed" to "error.staffPasswordAccess", "Tenant user was not found" to "error.tenantUserNotFound", "Platform administrator record was not found" to "error.platformAdminNotFound",
            "Tenant staff administrators can create only STAFF_ADMIN or STAFF users" to "error.staffAccountRole",
            "Branch is not available for this organization" to "error.branchUnavailable",
            "Device notification preference is not available" to "error.deviceNotificationPreferenceUnavailable",
            "A branch is required for Staff accounts" to "error.staffBranchRequired",
            "Staff member does not belong to this child's branch" to "error.childAssignmentBranch",
            "Staff member does not belong to this classroom's branch" to "error.classroomAssignmentBranch",
            "Staff member cannot place this child in the selected classroom" to "error.childPlacementScope",
            "Curriculum activity was not found" to "error.activityNotFound", "Curriculum activity belongs to a different organization" to "error.activityOrganization",
            "Curriculum activity assessment was not found" to "error.activityAssessmentNotFound", "Curriculum activity assessment belongs to a different activity" to "error.activityAssessmentScope",
            "Program is inactive" to "error.developmentProgramInactive", "Program does not match the child's class" to "error.developmentProgramChildScope",
            "Curriculum program was not found" to "error.curriculumProgramNotFound", "Curriculum program is not available" to "error.curriculumProgramUnavailable", "Development program is not part of the curriculum program" to "error.curriculumProgramDevelopmentProgramScope",
            "Child already has this active program" to "error.goalAlreadyActive", "Goal is already completed" to "error.goalCompleted", "Check-in date must be within the program period" to "error.goalCheckInDateRange", "Batch check-ins must include every active indicator exactly once" to "error.goalCheckInBatchIncomplete",
            "Program was not found" to "error.developmentProgramNotFound", "Program belongs to a different organization" to "error.developmentProgramOrganization", "Program is not global" to "error.developmentProgramNotGlobal", "Global program cannot be modified" to "error.developmentProgramGlobalReadOnly",
            "Child goal was not found" to "error.goalNotFound", "Child goal belongs to a different organization" to "error.goalOrganization",
            "Program needs at least one active indicator" to "error.goalIndicatorRequired", "Program indicator was not found" to "error.goalIndicatorNotFound", "Program indicator belongs to a different program" to "error.goalIndicatorScope", "Program indicator is archived" to "error.goalIndicatorArchived",
            "Development category was not found" to "error.developmentCategoryNotFound", "Development category is not available" to "error.developmentCategoryScope", "This category is used by existing development entries" to "error.developmentCategoryInUse",
            "Category name is required" to "error.developmentCategoryNameRequired", "This is already a built-in category" to "error.developmentCategoryBuiltIn", "A category with this name already exists" to "error.developmentCategoryDuplicate", "Staff Admin permission is required to add development categories" to "error.developmentCategoryPermission",
        )
    }
}
