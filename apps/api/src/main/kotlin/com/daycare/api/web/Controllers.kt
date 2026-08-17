package com.daycare.api.web

import com.daycare.api.service.AccessService
import com.daycare.api.service.IdentityService
import com.daycare.api.service.AdministrationService
import com.daycare.api.service.AttendanceCommand
import com.daycare.api.service.AttendanceService
import com.daycare.api.service.PickupAuthorizationService
import com.daycare.api.service.CreatePickupAuthorizationRequest
import com.daycare.api.service.RevokePickupAuthorizationRequest
import com.daycare.api.service.EmergencyContactService
import com.daycare.api.service.CreateEmergencyContactRequest
import com.daycare.api.service.RevokeEmergencyContactRequest
import com.daycare.api.service.ConsentService
import com.daycare.api.service.ConsentDecisionRequest
import com.daycare.api.service.CreateConsentDefinitionRequest
import com.daycare.api.service.ReviseConsentDefinitionRequest
import com.daycare.api.service.SetConsentDefinitionActiveRequest
import com.daycare.api.service.BillingService
import com.daycare.api.service.BookingApprovalRequest
import com.daycare.api.service.CreateEntitlementBookingsRequest
import com.daycare.api.service.CreateServicePlanRequest
import com.daycare.api.service.CreateServicePlanDiscountRequest
import com.daycare.api.service.CreateChildRequest
import com.daycare.api.service.CreateChildAbsenceRequest
import com.daycare.api.service.DecideChildAbsenceRequest
import com.daycare.api.service.ChildAbsenceService
import com.daycare.api.service.CreateInvitationRequest
import com.daycare.api.service.CreateTenantUserRequest
import com.daycare.api.service.CreateTenantStaffAdminRequest
import com.daycare.api.service.UpdateTenantStaffAdminRequest
import com.daycare.api.service.CreateDevelopmentEntryRequest
import com.daycare.api.service.CreateDevelopmentCategoryRequest
import com.daycare.api.service.DevelopmentService
import com.daycare.api.service.UpdateDevelopmentCategoryRequest
import com.daycare.api.service.RegisterDeviceRequest
import com.daycare.api.service.UpdateDeviceNotificationPreferenceRequest
import com.daycare.api.service.CreateTenantRequest
import com.daycare.api.service.CreatePlatformAdminRequest
import com.daycare.api.service.ChangeTenantUserPasswordRequest
import com.daycare.api.service.UpdateTenantUserChildProgramPermissionRequest
import com.daycare.api.service.UpdateTenantUserDevelopmentCategoryPermissionRequest
import com.daycare.api.service.UpdateTenantUserRequest
import com.daycare.api.service.AcademicService
import com.daycare.api.service.LearningStructureService
import com.daycare.api.service.UpsertLearningLevelRequest
import com.daycare.api.service.UpsertClassroomRequest
import com.daycare.api.service.AssignClassroomStaffRequest
import com.daycare.api.service.CreateClassroomProgramRequest
import com.daycare.api.service.CreateChildPlacementRequest
import com.daycare.api.service.ChildListFilter
import com.daycare.api.service.ChildGuardianStatus
import com.daycare.api.service.BranchListFilter
import com.daycare.api.service.GoalService
import com.daycare.api.service.UpsertDevelopmentProgramRequest
import com.daycare.api.service.UpsertGoalIndicatorRequest
import com.daycare.api.service.AssignChildGoalRequest
import com.daycare.api.service.GoalCheckInRequest
import com.daycare.api.service.GoalCheckInBatchRequest
import com.daycare.api.service.FinalizeChildGoalRequest
import com.daycare.api.service.CorrectChildGoalConclusionRequest
import com.daycare.api.service.CreateAcademicYearRequest
import com.daycare.api.service.CreateCurriculumProgramRequest
import com.daycare.api.service.SetCurriculumProgramActiveRequest
import com.daycare.api.service.UpsertCurriculumActivityRequest
import com.daycare.api.service.CreateCurriculumActivityAssessmentRequest
import com.daycare.api.service.ChangePlatformAdminPinRequest
import com.daycare.api.service.PlatformAdminPinService
import com.daycare.api.service.PlatformAdministrationService
import com.daycare.api.service.ParentFamilyProfileService
import com.daycare.api.service.UpdateParentFamilyProfileRequest
import com.daycare.api.service.TenantReadinessService
import com.daycare.api.service.PlatformCurriculumService
import com.daycare.api.service.InstitutionTypeCatalogService
import com.daycare.api.service.CreateInstitutionTypeDefinitionRequest
import com.daycare.api.service.CreateGlobalCurriculumProgramRequest
import com.daycare.api.service.UpdateTenantRequest
import com.daycare.api.service.RenewTenantSubscriptionRequest
import com.daycare.api.service.ChildManagementService
import com.daycare.api.service.UpdateChildRequest
import com.daycare.api.service.CreateChildProgramRequest
import com.daycare.api.service.UpsertChildProgramTemplateRequest
import com.daycare.api.service.UpdateChildProgramRequest
import com.daycare.api.service.CreateChildProgramStepRequest
import com.daycare.api.service.UpdateChildProgramStepRequest
import com.daycare.api.service.CreateChildProgramStaffNoteRequest
import com.daycare.api.service.CreateChildProgramParentFeedbackRequest
import com.daycare.api.service.AssignChildStaffRequest
import com.daycare.api.service.BindChildGuardianRequest
import com.daycare.api.service.SetBranchCapacityRequest
import com.daycare.api.service.UpsertServicePlanTemplateRequest
import com.daycare.api.service.LocalAuthenticationService
import com.daycare.api.service.AccessTokenRevocationService
import com.daycare.api.service.ParentEnrollmentService
import com.daycare.api.service.ParentEnrollmentCheckoutRequest
import com.daycare.api.service.ParentChildTransferRequest
import com.daycare.api.service.ParentEnrollmentApprovalRequest
import com.daycare.api.service.ParentEnrollmentRetryRequest
import com.daycare.api.service.TenantPaymentInstructionService
import com.daycare.api.service.UpsertPaymentInstructionRequest
import com.daycare.api.service.CreateTenantBranchRequest
import com.daycare.api.service.UpdateTenantBranchRequest
import com.daycare.api.service.BranchManagementService
import com.daycare.api.service.StaffReminderService
import com.daycare.api.service.UpsertStaffReminderRequest
import com.daycare.api.service.UpdateStaffReminderActiveRequest
import com.daycare.api.service.SyncStaffReminderSchedulesRequest
import com.daycare.api.service.ChildReportExportService
import com.daycare.api.service.CreateStaffLeaveRequest
import com.daycare.api.service.DecideStaffLeaveRequest
import com.daycare.api.service.ReportExportFormat
import com.daycare.api.service.OvertimeService
import com.daycare.api.service.UpdateBranchOperatingHoursRequest
import com.daycare.api.service.CreateOvertimeChargeRequest
import com.daycare.api.service.StaffLeaveRequestService
import com.daycare.api.service.PrivateTutoringService
import com.daycare.api.service.UpsertPrivateTutoringServiceRequest
import com.daycare.api.service.UpsertPrivateTutorRequest
import com.daycare.api.service.CreatePrivateTutoringRequest
import com.daycare.api.service.DecidePrivateTutoringRequest
import com.daycare.api.service.ParentChildProfileService
import com.daycare.api.service.ChildHealthService
import com.daycare.api.service.UpsertChildHealthRecordRequest
import com.daycare.api.service.ChildIncidentService
import com.daycare.api.service.CreateChildIncidentRequest
import com.daycare.api.service.AnalyticsService
import com.daycare.api.service.EducationOfferingService
import com.daycare.api.service.UpsertEducationOfferingRequest
import com.daycare.api.service.SetEducationOfferingStatusRequest
import com.daycare.api.domain.Gender
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size
import org.springframework.http.HttpStatus
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ContentDisposition
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate
import java.util.UUID

data class LocalLoginRequest(@field:NotBlank @field:Size(max = 128) val identifier: String, @field:Size(min = 6, max = 128) val password: String)
data class LocalPasswordRequest(@field:Size(min = 6, max = 128) val password: String)
data class LocalProfileRequest(@field:NotBlank @field:Size(max = 128) val displayName: String)
data class UpdatePersonalDetailsRequest(@field:NotNull val gender: Gender, @field:NotNull val dateOfBirth: LocalDate)
data class UpdateUsernameRequest(@field:Size(min = 2, max = 100) val username: String? = null)
data class LocalRegistrationRequest(@field:NotBlank @field:Size(max = 128) val displayName: String, @field:NotBlank @field:Size(max = 254) val email: String, @field:NotBlank @field:Size(min = 6, max = 128) val password: String)

@RestController
@RequestMapping("/v1/auth/local")
class LocalAuthenticationController(private val localAuthentication: LocalAuthenticationService) {
    @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED)
    fun register(@AuthenticationPrincipal verifiedIdentity: Jwt?, @Valid @RequestBody request: LocalRegistrationRequest) = localAuthentication.register(request.displayName, request.email, request.password, verifiedIdentity)

    @PostMapping("/login")
    fun login(@Valid @RequestBody request: LocalLoginRequest) = localAuthentication.login(request.identifier, request.password)

    @PostMapping("/password") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun changePassword(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: LocalPasswordRequest) = localAuthentication.changePassword(jwt.subject, request.password)

    @PatchMapping("/profile")
    fun updateProfile(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: LocalProfileRequest) = localAuthentication.updateDisplayName(jwt.subject, request.displayName)
}

@RestController
@RequestMapping("/v1/auth")
@SecurityRequirement(name = "bearerAuth")
class AuthenticationSessionController(private val tokenRevocations: AccessTokenRevocationService) {
    @PostMapping("/logout") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun logout(@AuthenticationPrincipal jwt: Jwt) = tokenRevocations.revoke(jwt)
}

@RestController
@RequestMapping("/v1")
@SecurityRequirement(name = "bearerAuth")
class IdentityController(private val access: AccessService, private val identity: IdentityService, private val parentFamilyProfiles: ParentFamilyProfileService) {
    @GetMapping("/me") fun me(@AuthenticationPrincipal jwt: Jwt) = access.currentUser(jwt)

    @GetMapping("/auth/identity-check")
    fun identityCheck(@AuthenticationPrincipal jwt: Jwt) = identity.checkIdentity(jwt)

    @PatchMapping("/me")
    fun updateMe(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: UpdatePersonalDetailsRequest) = access.updatePersonalDetails(jwt, request.gender, request.dateOfBirth)

    @PatchMapping("/me/username")
    fun updateUsername(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: UpdateUsernameRequest) = access.updateUsername(jwt, request.username)

    @GetMapping("/parent-family-profile")
    fun parentFamilyProfile(@AuthenticationPrincipal jwt: Jwt) = parentFamilyProfiles.mine(jwt)

    @PutMapping("/parent-family-profile")
    fun updateParentFamilyProfile(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: UpdateParentFamilyProfileRequest) = parentFamilyProfiles.update(jwt, request)
}

@RestController
@RequestMapping("/v1/education-offerings")
@SecurityRequirement(name = "bearerAuth")
class EducationOfferingController(private val offerings: EducationOfferingService) {
    @GetMapping("/context")
    fun context(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = offerings.context(jwt, organizationId)

    @GetMapping
    fun list(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = offerings.list(jwt, organizationId)

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    fun create(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: UpsertEducationOfferingRequest) = offerings.create(jwt, organizationId, request)

    @PostMapping("/{offeringId}/status")
    fun status(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable offeringId: UUID, @Valid @RequestBody request: SetEducationOfferingStatusRequest) = offerings.changeStatus(jwt, organizationId, offeringId, request)
}

@RestController
@RequestMapping("/v1/parent-enrollment")
@SecurityRequirement(name = "bearerAuth")
class ParentEnrollmentController(private val enrollments: ParentEnrollmentService) {
    @GetMapping("/catalog")
    fun catalog(@AuthenticationPrincipal jwt: Jwt, @RequestParam(required = false) search: String?) = enrollments.catalog(jwt, search)

    @PostMapping("/checkout") @ResponseStatus(HttpStatus.CREATED)
    fun checkout(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: ParentEnrollmentCheckoutRequest) = enrollments.checkout(jwt, request)

    @PostMapping("/transfer") @ResponseStatus(HttpStatus.CREATED)
    fun transfer(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: ParentChildTransferRequest) = enrollments.transferCheckout(jwt, request)

    @GetMapping
    fun mine(@AuthenticationPrincipal jwt: Jwt) = enrollments.mine(jwt)

    @GetMapping("/pending-approval")
    fun pendingApprovals(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @RequestParam(required = false) branchId: UUID?, @RequestParam(required = false) search: String?) = enrollments.pendingApprovals(jwt, organizationId, BranchListFilter(branchId), search)

    @PostMapping("/{enrollmentId}/approval")
    fun decide(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable enrollmentId: UUID, @Valid @RequestBody request: ParentEnrollmentApprovalRequest) = enrollments.decide(jwt, organizationId, enrollmentId, request)

    @PostMapping("/{enrollmentId}/retry")
    fun retry(@AuthenticationPrincipal jwt: Jwt, @PathVariable enrollmentId: UUID, @Valid @RequestBody request: ParentEnrollmentRetryRequest) = enrollments.retry(jwt, enrollmentId, request)

    @PostMapping("/{enrollmentId}/cancel")
    fun cancel(@AuthenticationPrincipal jwt: Jwt, @PathVariable enrollmentId: UUID) = enrollments.cancel(jwt, enrollmentId)
}

@RestController
@RequestMapping("/v1/payment-instructions")
@SecurityRequirement(name = "bearerAuth")
class TenantPaymentInstructionController(private val paymentInstructions: TenantPaymentInstructionService) {
    @GetMapping
    fun list(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = paymentInstructions.list(jwt, organizationId)

    @GetMapping("/manage")
    fun listForManagement(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = paymentInstructions.listForManagement(jwt, organizationId)

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    fun create(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: UpsertPaymentInstructionRequest) = paymentInstructions.create(jwt, organizationId, request)

    @PatchMapping("/{instructionId}")
    fun update(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable instructionId: UUID, @Valid @RequestBody request: UpsertPaymentInstructionRequest) = paymentInstructions.update(jwt, organizationId, instructionId, request)

    @DeleteMapping("/{instructionId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable instructionId: UUID) = paymentInstructions.delete(jwt, organizationId, instructionId)
}

@RestController
@RequestMapping("/v1/private-tutoring")
@SecurityRequirement(name = "bearerAuth")
class PrivateTutoringController(private val privateTutoring: PrivateTutoringService) {
    @GetMapping("/manage/services")
    fun managedServices(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = privateTutoring.managedServices(jwt, organizationId)

    @PostMapping("/manage/services") @ResponseStatus(HttpStatus.CREATED)
    fun createService(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: UpsertPrivateTutoringServiceRequest) = privateTutoring.createService(jwt, organizationId, request)

    @PatchMapping("/manage/services/{serviceId}")
    fun updateService(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable serviceId: UUID, @Valid @RequestBody request: UpsertPrivateTutoringServiceRequest) = privateTutoring.updateService(jwt, organizationId, serviceId, request)

    @GetMapping("/manage/tutors")
    fun managedTutors(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = privateTutoring.managedTutors(jwt, organizationId)

    @PostMapping("/manage/tutors") @ResponseStatus(HttpStatus.CREATED)
    fun createTutor(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: UpsertPrivateTutorRequest) = privateTutoring.createTutor(jwt, organizationId, request)

    @PatchMapping("/manage/tutors/{tutorId}")
    fun updateTutor(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable tutorId: UUID, @Valid @RequestBody request: UpsertPrivateTutorRequest) = privateTutoring.updateTutor(jwt, organizationId, tutorId, request)

    @GetMapping("/manage/requests")
    fun managedRequests(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = privateTutoring.managedRequests(jwt, organizationId)

    @PostMapping("/manage/requests/{requestId}/decision")
    fun decideRequest(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable requestId: UUID, @Valid @RequestBody request: DecidePrivateTutoringRequest) = privateTutoring.decideRequest(jwt, organizationId, requestId, request)

    @GetMapping("/parent/services")
    fun parentServices(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @RequestParam childId: UUID) = privateTutoring.parentServices(jwt, organizationId, childId)

    @GetMapping("/parent/requests")
    fun parentRequests(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = privateTutoring.parentRequests(jwt, organizationId)

    @PostMapping("/parent/services/{serviceId}/requests") @ResponseStatus(HttpStatus.CREATED)
    fun createParentRequest(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable serviceId: UUID, @Valid @RequestBody request: CreatePrivateTutoringRequest) = privateTutoring.createParentRequest(jwt, organizationId, serviceId, request)

    @PostMapping("/parent/requests/{requestId}/cancel")
    fun cancelParentRequest(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable requestId: UUID) = privateTutoring.cancelParentRequest(jwt, organizationId, requestId)
}

@RestController
@RequestMapping("/v1/platform")
@SecurityRequirement(name = "bearerAuth")
class PlatformController(
    private val platformAdministration: PlatformAdministrationService,
    private val tenantReadiness: TenantReadinessService,
    private val platformAdminPin: PlatformAdminPinService,
    private val platformCurriculum: PlatformCurriculumService,
    private val institutionTypes: InstitutionTypeCatalogService,
    private val development: DevelopmentService,
    private val goalService: GoalService,
    private val learning: LearningStructureService,
) {

    @GetMapping("/development-categories")
    fun globalDevelopmentCategories(@AuthenticationPrincipal jwt: Jwt) = development.globalCategories(jwt)

    @PostMapping("/development-categories") @ResponseStatus(HttpStatus.CREATED)
    fun createGlobalDevelopmentCategory(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: CreateDevelopmentCategoryRequest) = development.createGlobalCategory(jwt, request)

    @PatchMapping("/development-categories/{categoryId}")
    fun updateGlobalDevelopmentCategory(@AuthenticationPrincipal jwt: Jwt, @PathVariable categoryId: UUID, @Valid @RequestBody request: UpdateDevelopmentCategoryRequest) = development.updateGlobalCategory(jwt, categoryId, request)

    @DeleteMapping("/development-categories/{categoryId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteGlobalDevelopmentCategory(@AuthenticationPrincipal jwt: Jwt, @PathVariable categoryId: UUID) = development.deleteGlobalCategory(jwt, categoryId)

    @GetMapping("/development-programs")
    fun globalDevelopmentPrograms(@AuthenticationPrincipal jwt: Jwt, @RequestParam(required = false) search: String?) = goalService.globalPrograms(jwt, search)

    @PostMapping("/development-programs") @ResponseStatus(HttpStatus.CREATED)
    fun createGlobalDevelopmentProgram(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: UpsertDevelopmentProgramRequest) = goalService.createGlobalProgram(jwt, request)

    @PatchMapping("/development-programs/{programId}")
    fun updateGlobalDevelopmentProgram(@AuthenticationPrincipal jwt: Jwt, @PathVariable programId: UUID, @Valid @RequestBody request: UpsertDevelopmentProgramRequest) = goalService.updateGlobalProgram(jwt, programId, request)

    @PostMapping("/development-programs/{programId}/revisions") @ResponseStatus(HttpStatus.CREATED)
    fun reviseGlobalDevelopmentProgram(@AuthenticationPrincipal jwt: Jwt, @PathVariable programId: UUID, @Valid @RequestBody request: UpsertDevelopmentProgramRequest) = goalService.reviseGlobalProgram(jwt, programId, request)

    @DeleteMapping("/development-programs/{programId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteGlobalDevelopmentProgram(@AuthenticationPrincipal jwt: Jwt, @PathVariable programId: UUID) = goalService.deleteGlobalProgram(jwt, programId)

    @GetMapping("/learning-levels")
    fun globalLearningLevels(@AuthenticationPrincipal jwt: Jwt) = learning.globalLevels(jwt)

    @PostMapping("/learning-levels") @ResponseStatus(HttpStatus.CREATED)
    fun createGlobalLearningLevel(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: UpsertLearningLevelRequest) = learning.createGlobalLevel(jwt, request)

    @PatchMapping("/learning-levels/{levelId}")
    fun updateGlobalLearningLevel(@AuthenticationPrincipal jwt: Jwt, @PathVariable levelId: UUID, @Valid @RequestBody request: UpsertLearningLevelRequest) = learning.updateGlobalLevel(jwt, levelId, request)

    @DeleteMapping("/learning-levels/{levelId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteGlobalLearningLevel(@AuthenticationPrincipal jwt: Jwt, @PathVariable levelId: UUID) = learning.deleteGlobalLevel(jwt, levelId)

    @GetMapping("/institution-types")
    fun institutionTypes(@AuthenticationPrincipal jwt: Jwt) = institutionTypes.list(jwt)

    @PostMapping("/institution-types") @ResponseStatus(HttpStatus.CREATED)
    fun createInstitutionType(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: CreateInstitutionTypeDefinitionRequest) = institutionTypes.create(jwt, request)

    @PatchMapping("/institution-types/{code}")
    fun updateInstitutionType(@AuthenticationPrincipal jwt: Jwt, @PathVariable code: String, @Valid @RequestBody request: CreateInstitutionTypeDefinitionRequest) = institutionTypes.update(jwt, code, request)

    @DeleteMapping("/institution-types/{code}") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteInstitutionType(@AuthenticationPrincipal jwt: Jwt, @PathVariable code: String) = institutionTypes.delete(jwt, code)

    @GetMapping("/tenants")
    fun tenants(@AuthenticationPrincipal jwt: Jwt, @RequestParam(required = false) search: String?) = platformAdministration.tenants(jwt, search)

    @GetMapping("/tenant-readiness")
    fun tenantReadiness(@AuthenticationPrincipal jwt: Jwt) = tenantReadiness.readiness(jwt)

    @PostMapping("/tenants") @ResponseStatus(HttpStatus.CREATED)
    fun createTenant(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: CreateTenantRequest) = platformAdministration.createTenant(jwt, request)

    @GetMapping("/tenants/{organizationId}")
    fun tenant(@AuthenticationPrincipal jwt: Jwt, @PathVariable organizationId: UUID) = platformAdministration.tenant(jwt, organizationId)

    @PatchMapping("/tenants/{organizationId}")
    fun updateTenant(@AuthenticationPrincipal jwt: Jwt, @PathVariable organizationId: UUID, @Valid @RequestBody request: UpdateTenantRequest) = platformAdministration.updateTenant(jwt, organizationId, request)

    @PostMapping("/tenants/{organizationId}/staff-admins") @ResponseStatus(HttpStatus.CREATED)
    fun createTenantStaffAdmin(@AuthenticationPrincipal jwt: Jwt, @PathVariable organizationId: UUID, @Valid @RequestBody request: CreateTenantStaffAdminRequest) = platformAdministration.createTenantStaffAdmin(jwt, organizationId, request)

    @PostMapping("/tenants/{organizationId}/staff-admins/{membershipId}/remove")
    fun removeTenantStaffAdmin(@AuthenticationPrincipal jwt: Jwt, @PathVariable organizationId: UUID, @PathVariable membershipId: UUID) = platformAdministration.removeTenantStaffAdmin(jwt, organizationId, membershipId)

    @PatchMapping("/tenants/{organizationId}/staff-admins/{membershipId}")
    fun updateTenantStaffAdmin(@AuthenticationPrincipal jwt: Jwt, @PathVariable organizationId: UUID, @PathVariable membershipId: UUID, @Valid @RequestBody request: UpdateTenantStaffAdminRequest) = platformAdministration.updateTenantStaffAdmin(jwt, organizationId, membershipId, request)

    @PostMapping("/tenants/{organizationId}/subscription/renew")
    fun renewSubscription(@AuthenticationPrincipal jwt: Jwt, @PathVariable organizationId: UUID, @Valid @RequestBody request: RenewTenantSubscriptionRequest) = platformAdministration.renewSubscription(jwt, organizationId, request)

    @PostMapping("/tenants/{organizationId}/subscription/{status}")
    fun setSubscriptionStatus(@AuthenticationPrincipal jwt: Jwt, @PathVariable organizationId: UUID, @PathVariable status: com.daycare.api.domain.TenantSubscriptionStatus) = platformAdministration.setSubscriptionStatus(jwt, organizationId, status)

    @PostMapping("/admins") @ResponseStatus(HttpStatus.CREATED)
    fun createPlatformAdmin(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: CreatePlatformAdminRequest) = mapOf("id" to platformAdministration.createPlatformAdmin(jwt, request))

    @PostMapping("/pin") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun changePin(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: ChangePlatformAdminPinRequest) = platformAdminPin.changePin(jwt, request)

    @GetMapping("/curriculum-programs")
    fun curriculumPrograms(@AuthenticationPrincipal jwt: Jwt, @RequestParam(defaultValue = "false") includeArchived: Boolean) = platformCurriculum.programs(jwt, includeArchived)

    @PostMapping("/curriculum-programs") @ResponseStatus(HttpStatus.CREATED)
    fun createCurriculumProgram(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: CreateGlobalCurriculumProgramRequest) = platformCurriculum.createProgram(jwt, request)

    @PatchMapping("/curriculum-programs/{programId}")
    fun updateCurriculumProgram(@AuthenticationPrincipal jwt: Jwt, @PathVariable programId: UUID, @Valid @RequestBody request: CreateGlobalCurriculumProgramRequest) = platformCurriculum.updateProgram(jwt, programId, request)

    @PatchMapping("/curriculum-programs/{programId}/active")
    fun setCurriculumProgramActive(@AuthenticationPrincipal jwt: Jwt, @PathVariable programId: UUID, @RequestBody request: SetCurriculumProgramActiveRequest) = platformCurriculum.setProgramActive(jwt, programId, request.active)

    @PostMapping("/global-curriculum-seed")
    fun seedGlobalCurriculum(@AuthenticationPrincipal jwt: Jwt) = platformCurriculum.seedGlobalCurriculum(jwt)

    @PostMapping("/tenants/{organizationId}/payments/{paymentId}/mark-paid")
    fun markPaymentPaid(@AuthenticationPrincipal jwt: Jwt, @PathVariable organizationId: UUID, @PathVariable paymentId: UUID) = platformAdministration.markPaymentPaid(jwt, organizationId, paymentId)

    @PostMapping("/tenants/{organizationId}/payments/{paymentId}/void")
    fun voidPayment(@AuthenticationPrincipal jwt: Jwt, @PathVariable organizationId: UUID, @PathVariable paymentId: UUID) = platformAdministration.voidPayment(jwt, organizationId, paymentId)

    @PostMapping("/tenants/{organizationId}/staff-admin-invitation/refresh")
    fun refreshStaffAdminInvitation(@AuthenticationPrincipal jwt: Jwt, @PathVariable organizationId: UUID) = platformAdministration.refreshStaffAdminInvitation(jwt, organizationId)

    @PostMapping("/tenants/{organizationId}/staff-admin-invitation/cancel")
    fun cancelStaffAdminInvitation(@AuthenticationPrincipal jwt: Jwt, @PathVariable organizationId: UUID) = platformAdministration.cancelStaffAdminInvitation(jwt, organizationId)
}

@RestController
@RequestMapping("/v1")
@SecurityRequirement(name = "bearerAuth")
class InstitutionController(private val attendance: AttendanceService, private val pickupAuthorizations: PickupAuthorizationService, private val emergencyContacts: EmergencyContactService, private val consents: ConsentService, private val administration: AdministrationService, private val development: DevelopmentService, private val academic: AcademicService, private val childManagement: ChildManagementService, private val parentChildProfiles: ParentChildProfileService, private val learning: LearningStructureService, private val branchManagement: BranchManagementService, private val goalService: GoalService, private val staffReminders: StaffReminderService, private val childReports: ChildReportExportService, private val childAbsences: ChildAbsenceService, private val staffLeaveRequests: StaffLeaveRequestService, private val tenantReadiness: TenantReadinessService, private val childHealth: ChildHealthService, private val childIncidents: ChildIncidentService) {
    @GetMapping("/tenant-readiness")
    fun tenantReadiness(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = tenantReadiness.organizationReadiness(jwt, organizationId)

    @GetMapping("/children")
    fun children(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestHeader("X-Organization-Id") organizationId: UUID,
        @RequestParam(required = false) branchId: UUID?,
        @RequestParam(required = false) learningLevelId: UUID?,
        @RequestParam(required = false) classroomId: UUID?,
        @RequestParam(required = false) guardianStatus: ChildGuardianStatus?,
    ) = attendance.listChildren(jwt, organizationId, ChildListFilter(branchId, learningLevelId, classroomId, guardianStatus))

    @GetMapping("/reports/children/export")
    fun exportChildren(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @RequestParam format: ReportExportFormat, @RequestParam(required = false) branchId: UUID?, @RequestParam(required = false) learningLevelId: UUID?, @RequestParam(required = false) classroomId: UUID?, @RequestParam(required = false) guardianStatus: ChildGuardianStatus?): ResponseEntity<ByteArray> {
        val report = childReports.children(jwt, organizationId, format, ChildListFilter(branchId, learningLevelId, classroomId, guardianStatus))
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(report.contentType))
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(report.fileName).build().toString())
            .body(report.bytes)
    }

    @GetMapping("/reports/children/attendance/export")
    fun exportChildAttendance(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @RequestParam format: ReportExportFormat, @RequestParam branchId: UUID, @RequestParam startsOn: LocalDate, @RequestParam endsOn: LocalDate): ResponseEntity<ByteArray> {
        val report = childReports.childAttendance(jwt, organizationId, format, branchId, startsOn, endsOn)
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(report.contentType))
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(report.fileName).build().toString())
            .body(report.bytes)
    }

    @PostMapping("/children") @ResponseStatus(HttpStatus.CREATED)
    fun createChild(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: CreateChildRequest) = administration.createChild(jwt, organizationId, request)

    @GetMapping("/child-absence-requests")
    fun childAbsenceRequests(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @RequestParam(required = false) childId: UUID?, @RequestParam(required = false) branchId: UUID?) = childAbsences.list(jwt, organizationId, childId, BranchListFilter(branchId))

    @PostMapping("/child-absence-requests") @ResponseStatus(HttpStatus.CREATED)
    fun createChildAbsenceRequest(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: CreateChildAbsenceRequest) = childAbsences.create(jwt, organizationId, request)

    @PostMapping("/child-absence-requests/{requestId}/decision")
    fun decideChildAbsenceRequest(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable requestId: UUID, @Valid @RequestBody request: DecideChildAbsenceRequest) = childAbsences.decide(jwt, organizationId, requestId, request)

    @PostMapping("/child-absence-requests/{requestId}/cancel")
    fun cancelChildAbsenceRequest(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable requestId: UUID) = childAbsences.cancel(jwt, organizationId, requestId)

    @GetMapping("/staff-leave-requests/pending-approval")
    fun pendingStaffLeaveRequests(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = staffLeaveRequests.pending(jwt, organizationId)

    @GetMapping("/staff-leave-requests")
    fun staffLeaveRequests(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = staffLeaveRequests.mine(jwt, organizationId)

    @PostMapping("/staff-leave-requests") @ResponseStatus(HttpStatus.CREATED)
    fun createStaffLeaveRequest(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: CreateStaffLeaveRequest) = staffLeaveRequests.create(jwt, organizationId, request)

    @PostMapping("/staff-leave-requests/{requestId}/cancel")
    fun cancelStaffLeaveRequest(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable requestId: UUID) = staffLeaveRequests.cancel(jwt, organizationId, requestId)

    @PostMapping("/staff-leave-requests/{requestId}/approval")
    fun decideStaffLeaveRequest(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable requestId: UUID, @Valid @RequestBody request: DecideStaffLeaveRequest) = staffLeaveRequests.decide(jwt, organizationId, requestId, request)

    @GetMapping("/staff-leave-requests/{requestId}/evidence")
    fun staffLeaveRequestEvidence(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable requestId: UUID) = staffLeaveRequests.evidence(jwt, organizationId, requestId)

    @GetMapping("/children/programs-summary")
    fun childProgramsSummary(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = childManagement.programsSummary(jwt, organizationId)

    @GetMapping("/children/{childId}")
    fun childProfile(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID) = childManagement.profile(jwt, organizationId, childId)

    @GetMapping("/parent/children/programs-summary")
    fun parentChildProgramsSummary(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = childManagement.parentProgramsSummary(jwt, organizationId)

    @GetMapping("/parent/children/{childId}/profile")
    fun parentChildProfile(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID) = parentChildProfiles.profile(jwt, organizationId, childId)

    @PostMapping("/parent/children/{childId}/programs/{programId}/feedback") @ResponseStatus(HttpStatus.CREATED)
    fun addParentChildProgramFeedback(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @PathVariable programId: UUID, @Valid @RequestBody request: CreateChildProgramParentFeedbackRequest) = childManagement.addParentFeedback(jwt, organizationId, childId, programId, request)

    @PatchMapping("/children/{childId}")
    fun updateChild(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @Valid @RequestBody request: UpdateChildRequest) = childManagement.update(jwt, organizationId, childId, request)

    @PostMapping("/children/{childId}/deactivate")
    fun deactivateChild(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID) = childManagement.deactivate(jwt, organizationId, childId)

    @PostMapping("/children/{childId}/programs") @ResponseStatus(HttpStatus.CREATED)
    fun addChildProgram(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @Valid @RequestBody request: CreateChildProgramRequest) = childManagement.addProgram(jwt, organizationId, childId, request)

    @PatchMapping("/children/{childId}/programs/{programId}")
    fun updateChildProgram(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @PathVariable programId: UUID, @Valid @RequestBody request: UpdateChildProgramRequest) = childManagement.updateProgram(jwt, organizationId, childId, programId, request)

    @DeleteMapping("/children/{childId}/programs/{programId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun removeChildProgram(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @PathVariable programId: UUID) = childManagement.removeProgram(jwt, organizationId, childId, programId)

    @PostMapping("/children/{childId}/programs/{programId}/steps") @ResponseStatus(HttpStatus.CREATED)
    fun addChildProgramStep(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @PathVariable programId: UUID, @Valid @RequestBody request: CreateChildProgramStepRequest) = childManagement.addProgramStep(jwt, organizationId, childId, programId, request)

    @PatchMapping("/children/{childId}/programs/{programId}/steps/{stepId}")
    fun updateChildProgramStep(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @PathVariable programId: UUID, @PathVariable stepId: UUID, @Valid @RequestBody request: UpdateChildProgramStepRequest) = childManagement.updateProgramStep(jwt, organizationId, childId, programId, stepId, request)

    @DeleteMapping("/children/{childId}/programs/{programId}/steps/{stepId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun removeChildProgramStep(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @PathVariable programId: UUID, @PathVariable stepId: UUID) = childManagement.removeProgramStep(jwt, organizationId, childId, programId, stepId)

    @PostMapping("/children/{childId}/programs/{programId}/staff-notes") @ResponseStatus(HttpStatus.CREATED)
    fun addChildProgramStaffNote(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @PathVariable programId: UUID, @Valid @RequestBody request: CreateChildProgramStaffNoteRequest) = childManagement.addProgramStaffNote(jwt, organizationId, childId, programId, request)

    @PostMapping("/children/{childId}/staff-assignments") @ResponseStatus(HttpStatus.CREATED)
    fun assignChildStaff(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @Valid @RequestBody request: AssignChildStaffRequest) = childManagement.assignStaff(jwt, organizationId, childId, request)

    @GetMapping("/child-program-templates")
    fun childProgramTemplates(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = childManagement.listTemplates(jwt, organizationId)

    @PostMapping("/child-program-templates") @ResponseStatus(HttpStatus.CREATED)
    fun createChildProgramTemplate(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: UpsertChildProgramTemplateRequest) = childManagement.createTemplate(jwt, organizationId, request)

    @PatchMapping("/child-program-templates/{templateId}")
    fun updateChildProgramTemplate(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable templateId: UUID, @Valid @RequestBody request: UpsertChildProgramTemplateRequest) = childManagement.updateTemplate(jwt, organizationId, templateId, request)

    @DeleteMapping("/child-program-templates/{templateId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun removeChildProgramTemplate(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable templateId: UUID) = childManagement.removeTemplate(jwt, organizationId, templateId)

    @PostMapping("/children/{childId}/programs/from-template/{templateId}") @ResponseStatus(HttpStatus.CREATED)
    fun createChildProgramFromTemplate(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @PathVariable templateId: UUID) = childManagement.createProgramFromTemplate(jwt, organizationId, childId, templateId)

    @DeleteMapping("/children/{childId}/staff-assignments/{assignmentId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun unassignChildStaff(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @PathVariable assignmentId: UUID) = childManagement.unassignStaff(jwt, organizationId, childId, assignmentId)

    @PostMapping("/children/{childId}/guardians") @ResponseStatus(HttpStatus.CREATED)
    fun bindChildGuardian(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @Valid @RequestBody request: BindChildGuardianRequest) = childManagement.bindGuardian(jwt, organizationId, childId, request)

    @DeleteMapping("/children/{childId}/guardians/{userId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun unbindChildGuardian(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @PathVariable userId: UUID) = childManagement.unbindGuardian(jwt, organizationId, childId, userId)

    @PostMapping("/children/{childId}/attendance")
    fun recordAttendance(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @Valid @RequestBody command: AttendanceCommand) = attendance.record(jwt, organizationId, childId, command)

    @GetMapping("/children/{childId}/pickup-authorizations")
    fun pickupAuthorizations(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID) = pickupAuthorizations.list(jwt, organizationId, childId)

    @PostMapping("/children/{childId}/pickup-authorizations") @ResponseStatus(HttpStatus.CREATED)
    fun createPickupAuthorization(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @Valid @RequestBody request: CreatePickupAuthorizationRequest) = pickupAuthorizations.create(jwt, organizationId, childId, request)

    @PostMapping("/children/{childId}/pickup-authorizations/{authorizationId}/activate")
    fun activatePickupAuthorization(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @PathVariable authorizationId: UUID) = pickupAuthorizations.activate(jwt, organizationId, childId, authorizationId)

    @PostMapping("/children/{childId}/pickup-authorizations/{authorizationId}/revoke")
    fun revokePickupAuthorization(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @PathVariable authorizationId: UUID, @Valid @RequestBody request: RevokePickupAuthorizationRequest) = pickupAuthorizations.revoke(jwt, organizationId, childId, authorizationId, request)

    @GetMapping("/children/{childId}/emergency-contacts")
    fun emergencyContacts(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID) = emergencyContacts.list(jwt, organizationId, childId)

    @PostMapping("/children/{childId}/emergency-contacts") @ResponseStatus(HttpStatus.CREATED)
    fun createEmergencyContact(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @Valid @RequestBody request: CreateEmergencyContactRequest) = emergencyContacts.create(jwt, organizationId, childId, request)

    @DeleteMapping("/children/{childId}/emergency-contacts/{contactId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun removeEmergencyContact(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @PathVariable contactId: UUID) = emergencyContacts.remove(jwt, organizationId, childId, contactId)

    @PostMapping("/children/{childId}/emergency-contacts/{contactId}/revoke")
    fun revokeEmergencyContact(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @PathVariable contactId: UUID, @Valid @RequestBody request: RevokeEmergencyContactRequest) = emergencyContacts.revoke(jwt, organizationId, childId, contactId, request)

    @GetMapping("/consent-definitions")
    fun consentDefinitions(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = consents.definitions(jwt, organizationId)

    @GetMapping("/consent-definitions/manage")
    fun managedConsentDefinitions(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = consents.managedDefinitions(jwt, organizationId)

    @PostMapping("/consent-definitions") @ResponseStatus(HttpStatus.CREATED)
    fun createConsentDefinition(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: CreateConsentDefinitionRequest) = consents.createDefinition(jwt, organizationId, request)

    @PutMapping("/consent-definitions/{definitionId}")
    fun reviseConsentDefinition(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable definitionId: UUID, @Valid @RequestBody request: ReviseConsentDefinitionRequest) = consents.reviseDefinition(jwt, organizationId, definitionId, request)

    @PostMapping("/consent-definitions/{definitionId}/active")
    fun setConsentDefinitionActive(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable definitionId: UUID, @Valid @RequestBody request: SetConsentDefinitionActiveRequest) = consents.setDefinitionActive(jwt, organizationId, definitionId, request)

    @GetMapping("/children/{childId}/consents")
    fun parentConsents(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID) = consents.parentConsents(jwt, organizationId, childId)

    @PostMapping("/children/{childId}/consents")
    fun decideConsent(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @Valid @RequestBody request: ConsentDecisionRequest) = consents.decide(jwt, organizationId, childId, request)

    @PostMapping("/children/{childId}/consents/{definitionId}/withdraw")
    fun withdrawConsent(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @PathVariable definitionId: UUID) = consents.withdraw(jwt, organizationId, childId, definitionId)

    @GetMapping("/children/{childId}/attendance-qr")
    fun issueQr(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID) = attendance.issueQr(jwt, organizationId, childId)

    @GetMapping("/children/{childId}/development-entries")
    fun developmentEntries(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID) = development.list(jwt, organizationId, childId)

    @PostMapping("/children/{childId}/development-entries") @ResponseStatus(HttpStatus.CREATED)
    fun createDevelopmentEntry(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @Valid @RequestBody request: CreateDevelopmentEntryRequest) = development.create(jwt, organizationId, childId, request)

    @GetMapping("/children/{childId}/development-entries/{entryId}/photo")
    fun developmentEntryPhoto(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @PathVariable entryId: UUID) = development.photo(jwt, organizationId, childId, entryId)

    @GetMapping("/children/{childId}/development-entries/{entryId}/media/{mediaId}")
    fun developmentEntryMedia(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @PathVariable entryId: UUID, @PathVariable mediaId: UUID) = development.mediaContent(jwt, organizationId, childId, entryId, mediaId)

    @GetMapping("/children/{childId}/health-record")
    fun childHealthRecord(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID) = childHealth.get(jwt, organizationId, childId)

    @PutMapping("/children/{childId}/health-record")
    fun upsertChildHealthRecord(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @Valid @RequestBody request: UpsertChildHealthRecordRequest) = childHealth.upsert(jwt, organizationId, childId, request)

    @GetMapping("/children/{childId}/incident-reports")
    fun childIncidentReports(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID) = childIncidents.list(jwt, organizationId, childId)

    @PostMapping("/children/{childId}/incident-reports") @ResponseStatus(HttpStatus.CREATED)
    fun createChildIncidentReport(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @Valid @RequestBody request: CreateChildIncidentRequest) = childIncidents.create(jwt, organizationId, childId, request)

    @PostMapping("/children/{childId}/incident-reports/{incidentId}/acknowledge")
    fun acknowledgeChildIncidentReport(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @PathVariable incidentId: UUID) = childIncidents.acknowledge(jwt, organizationId, childId, incidentId)

    @GetMapping("/children/{childId}/incident-reports/{incidentId}/photo")
    fun childIncidentReportPhoto(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @PathVariable incidentId: UUID) = childIncidents.photo(jwt, organizationId, childId, incidentId)

    @GetMapping("/development-categories")
    fun developmentCategories(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = development.categories(jwt, organizationId)

    @PostMapping("/development-categories") @ResponseStatus(HttpStatus.CREATED)
    fun createDevelopmentCategory(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: CreateDevelopmentCategoryRequest) = development.createCategory(jwt, organizationId, request)

    @PatchMapping("/development-categories/{categoryId}")
    fun updateDevelopmentCategory(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable categoryId: UUID, @Valid @RequestBody request: UpdateDevelopmentCategoryRequest) = development.updateCategory(jwt, organizationId, categoryId, request)

    @DeleteMapping("/development-categories/{categoryId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteDevelopmentCategory(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable categoryId: UUID) = development.deleteCategory(jwt, organizationId, categoryId)

    @GetMapping("/children/{childId}/goals")
    fun childGoals(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID) = goalService.childGoals(jwt, organizationId, childId)

    @PostMapping("/children/{childId}/goals") @ResponseStatus(HttpStatus.CREATED)
    fun assignChildGoal(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @Valid @RequestBody request: AssignChildGoalRequest) = goalService.assign(jwt, organizationId, childId, request)

    @PutMapping("/child-goals/{goalId}/check-ins/{date}")
    fun recordGoalCheckIn(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable goalId: UUID, @PathVariable date: java.time.LocalDate, @Valid @RequestBody request: GoalCheckInRequest) = goalService.recordCheckIn(jwt, organizationId, goalId, date, request)

    @PutMapping("/child-goals/{goalId}/check-ins/{date}/batch")
    fun recordGoalCheckInBatch(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable goalId: UUID, @PathVariable date: java.time.LocalDate, @Valid @RequestBody request: GoalCheckInBatchRequest) = goalService.recordCheckInBatch(jwt, organizationId, goalId, date, request)

    @GetMapping("/child-goals/{goalId}/check-ins/{date}/{indicatorId}/photo")
    fun goalCheckInPhoto(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable goalId: UUID, @PathVariable date: java.time.LocalDate, @PathVariable indicatorId: UUID) = goalService.checkInPhoto(jwt, organizationId, goalId, date, indicatorId)

    @GetMapping("/child-goals/{goalId}/check-ins/{date}/{indicatorId}/audio")
    fun goalCheckInAudio(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable goalId: UUID, @PathVariable date: java.time.LocalDate, @PathVariable indicatorId: UUID) = goalService.checkInAudio(jwt, organizationId, goalId, date, indicatorId)

    @PostMapping("/child-goals/{goalId}/finalize")
    fun finalizeGoal(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable goalId: UUID, @Valid @RequestBody request: FinalizeChildGoalRequest) = goalService.finalize(jwt, organizationId, goalId, request)

    @PostMapping("/child-goals/{goalId}/conclusion-corrections") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun correctGoalConclusion(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable goalId: UUID, @Valid @RequestBody request: CorrectChildGoalConclusionRequest) = goalService.correctConclusion(jwt, organizationId, goalId, request)

    @PostMapping("/invitations") @ResponseStatus(HttpStatus.CREATED)
    fun invite(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: CreateInvitationRequest) = mapOf("id" to administration.invite(jwt, organizationId, request))

    @PostMapping("/tenant-users") @ResponseStatus(HttpStatus.CREATED)
    fun createTenantUser(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: CreateTenantUserRequest) = administration.createTenantUser(jwt, organizationId, request)

    @GetMapping("/tenant-users")
    fun tenantUsers(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @RequestParam(required = false) branchId: UUID?) = administration.tenantUsers(jwt, organizationId, BranchListFilter(branchId))

    @PostMapping("/tenant-users/{userId}/deactivate") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deactivateTenantUser(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable userId: UUID) = administration.deactivateTenantUser(jwt, organizationId, userId)

    @PatchMapping("/tenant-users/{userId}")
    fun updateTenantUser(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable userId: UUID, @Valid @RequestBody request: UpdateTenantUserRequest) = administration.updateTenantUser(jwt, organizationId, userId, request)

    @PatchMapping("/tenant-users/{userId}/child-program-permission")
    fun updateTenantUserChildProgramPermission(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable userId: UUID, @RequestBody request: UpdateTenantUserChildProgramPermissionRequest) = administration.updateTenantUserChildProgramPermission(jwt, organizationId, userId, request)

    @PatchMapping("/tenant-users/{userId}/development-category-permission")
    fun updateTenantUserDevelopmentCategoryPermission(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable userId: UUID, @RequestBody request: UpdateTenantUserDevelopmentCategoryPermissionRequest) = administration.updateTenantUserDevelopmentCategoryPermission(jwt, organizationId, userId, request)

    @GetMapping("/branches")
    fun branches(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @RequestParam(required = false) search: String?) = branchManagement.branches(jwt, organizationId, search)

    @PostMapping("/branches") @ResponseStatus(HttpStatus.CREATED)
    fun createBranch(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: CreateTenantBranchRequest) = branchManagement.create(jwt, organizationId, request)

    @PatchMapping("/branches/{branchId}")
    fun updateBranch(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable branchId: UUID, @Valid @RequestBody request: UpdateTenantBranchRequest) = branchManagement.update(jwt, organizationId, branchId, request)

    @PostMapping("/branches/{branchId}/primary")
    fun setPrimaryBranch(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable branchId: UUID) = branchManagement.setPrimary(jwt, organizationId, branchId)

    @PostMapping("/branches/{branchId}/archive")
    fun archiveBranch(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable branchId: UUID) = branchManagement.archive(jwt, organizationId, branchId)

    @GetMapping("/academic-years")
    fun academicYears(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = academic.academicYears(jwt, organizationId)

    @PostMapping("/academic-years") @ResponseStatus(HttpStatus.CREATED)
    fun createAcademicYear(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: CreateAcademicYearRequest) = academic.createAcademicYear(jwt, organizationId, request)

    @GetMapping("/curriculum-programs")
    fun curriculumPrograms(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @RequestParam(required = false) search: String?, @RequestParam(defaultValue = "false") includeArchived: Boolean) = academic.curriculumPrograms(jwt, organizationId, search, includeArchived)

    @PostMapping("/curriculum-programs") @ResponseStatus(HttpStatus.CREATED)
    fun createCurriculumProgram(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: CreateCurriculumProgramRequest) = academic.createCurriculumProgram(jwt, organizationId, request)

    @PatchMapping("/curriculum-programs/{programId}")
    fun updateCurriculumProgram(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable programId: UUID, @Valid @RequestBody request: CreateCurriculumProgramRequest) = academic.updateCurriculumProgram(jwt, organizationId, programId, request)

    @PatchMapping("/curriculum-programs/{programId}/active")
    fun setCurriculumProgramActive(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable programId: UUID, @RequestBody request: SetCurriculumProgramActiveRequest) = academic.setCurriculumProgramActive(jwt, organizationId, programId, request.active)

    @GetMapping("/curriculum-activities")
    fun activities(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = academic.activities(jwt, organizationId)

    @GetMapping("/development-programs")
    fun developmentPrograms(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @RequestParam(required = false) search: String?, @RequestParam(required = false) curriculumProgramId: UUID?) = goalService.programs(jwt, organizationId, search, curriculumProgramId)

    @PostMapping("/development-programs") @ResponseStatus(HttpStatus.CREATED)
    fun createDevelopmentProgram(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: UpsertDevelopmentProgramRequest) = goalService.createProgram(jwt, organizationId, request)

    @PatchMapping("/development-programs/{programId}")
    fun updateDevelopmentProgram(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable programId: UUID, @Valid @RequestBody request: UpsertDevelopmentProgramRequest) = goalService.updateProgram(jwt, organizationId, programId, request)

    @DeleteMapping("/development-programs/{programId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteDevelopmentProgram(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable programId: UUID) = goalService.deleteProgram(jwt, organizationId, programId)

    @PostMapping("/development-programs/{programId}/indicators") @ResponseStatus(HttpStatus.CREATED)
    fun createGoalIndicator(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable programId: UUID, @Valid @RequestBody request: UpsertGoalIndicatorRequest) = goalService.createIndicator(jwt, organizationId, programId, request)

    @PatchMapping("/development-programs/{programId}/indicators/{indicatorId}")
    fun updateGoalIndicator(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable programId: UUID, @PathVariable indicatorId: UUID, @Valid @RequestBody request: UpsertGoalIndicatorRequest) = goalService.updateIndicator(jwt, organizationId, programId, indicatorId, request)

    @PostMapping("/development-programs/{programId}/indicators/{indicatorId}/archive")
    fun archiveGoalIndicator(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable programId: UUID, @PathVariable indicatorId: UUID) = goalService.archiveIndicator(jwt, organizationId, programId, indicatorId)

    @PostMapping("/curriculum-activities") @ResponseStatus(HttpStatus.CREATED)
    fun createActivity(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: UpsertCurriculumActivityRequest) = academic.createActivity(jwt, organizationId, request)

    @PatchMapping("/curriculum-activities/{activityId}")
    fun updateActivity(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable activityId: UUID, @Valid @RequestBody request: UpsertCurriculumActivityRequest) = academic.updateActivity(jwt, organizationId, activityId, request)

    @PostMapping("/curriculum-activities/{activityId}/archive")
    fun archiveActivity(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable activityId: UUID) = academic.archiveActivity(jwt, organizationId, activityId)

    @GetMapping("/curriculum-activities/{activityId}/assessments")
    fun activityAssessments(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable activityId: UUID) = academic.activityAssessments(jwt, organizationId, activityId)

    @PostMapping("/curriculum-activities/{activityId}/assessments") @ResponseStatus(HttpStatus.CREATED)
    fun createActivityAssessment(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable activityId: UUID, @Valid @RequestBody request: CreateCurriculumActivityAssessmentRequest) = academic.createActivityAssessment(jwt, organizationId, activityId, request)

    @DeleteMapping("/curriculum-activities/{activityId}/assessments/{assessmentId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun removeActivityAssessment(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable activityId: UUID, @PathVariable assessmentId: UUID) = academic.removeActivityAssessment(jwt, organizationId, activityId, assessmentId)

    @GetMapping("/learning-level-templates")
    fun learningLevelTemplates(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = learning.templates(jwt, organizationId)

    @GetMapping("/learning-branches")
    fun learningBranches(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = learning.branches(jwt, organizationId)

    @GetMapping("/learning-levels")
    fun learningLevels(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = learning.levels(jwt, organizationId)

    @PostMapping("/learning-levels") @ResponseStatus(HttpStatus.CREATED)
    fun createLearningLevel(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: UpsertLearningLevelRequest) = learning.createLevel(jwt, organizationId, request)

    @PatchMapping("/learning-levels/{levelId}")
    fun updateLearningLevel(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable levelId: UUID, @Valid @RequestBody request: UpsertLearningLevelRequest) = learning.updateLevel(jwt, organizationId, levelId, request)

    @PostMapping("/learning-levels/{levelId}/archive")
    fun archiveLearningLevel(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable levelId: UUID) = learning.archiveLevel(jwt, organizationId, levelId)

    @GetMapping("/classrooms")
    fun classrooms(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @RequestParam(required = false) branchId: UUID?) = learning.classrooms(jwt, organizationId, BranchListFilter(branchId))

    @PostMapping("/classrooms") @ResponseStatus(HttpStatus.CREATED)
    fun createClassroom(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: UpsertClassroomRequest) = learning.createClassroom(jwt, organizationId, request)

    @PatchMapping("/classrooms/{classroomId}")
    fun updateClassroom(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable classroomId: UUID, @Valid @RequestBody request: UpsertClassroomRequest) = learning.updateClassroom(jwt, organizationId, classroomId, request)

    @PostMapping("/classrooms/{classroomId}/archive")
    fun archiveClassroom(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable classroomId: UUID) = learning.archiveClassroom(jwt, organizationId, classroomId)

    @GetMapping("/classrooms/{classroomId}/staff-assignments")
    fun classroomStaff(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable classroomId: UUID) = learning.classroomStaff(jwt, organizationId, classroomId)

    @PostMapping("/classrooms/{classroomId}/staff-assignments") @ResponseStatus(HttpStatus.CREATED)
    fun assignClassroomStaff(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable classroomId: UUID, @Valid @RequestBody request: AssignClassroomStaffRequest) = learning.assignClassroomStaff(jwt, organizationId, classroomId, request)

    @DeleteMapping("/classrooms/{classroomId}/staff-assignments/{assignmentId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun unassignClassroomStaff(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable classroomId: UUID, @PathVariable assignmentId: UUID) = learning.unassignClassroomStaff(jwt, organizationId, classroomId, assignmentId)

    @GetMapping("/classrooms/{classroomId}/programs")
    fun classroomPrograms(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable classroomId: UUID) = learning.classroomPrograms(jwt, organizationId, classroomId)

    @PostMapping("/classrooms/{classroomId}/programs") @ResponseStatus(HttpStatus.CREATED)
    fun createClassroomProgram(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable classroomId: UUID, @Valid @RequestBody request: CreateClassroomProgramRequest) = learning.createClassroomProgram(jwt, organizationId, classroomId, request)

    @DeleteMapping("/classrooms/{classroomId}/programs/{programId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun removeClassroomProgram(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable classroomId: UUID, @PathVariable programId: UUID) = learning.removeClassroomProgram(jwt, organizationId, classroomId, programId)

    @GetMapping("/children/{childId}/placements")
    fun childPlacements(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID) = learning.placements(jwt, organizationId, childId)

    @GetMapping("/children/{childId}/placement-options")
    fun childPlacementOptions(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID) = learning.placementOptions(jwt, organizationId, childId)

    @PostMapping("/children/{childId}/placements") @ResponseStatus(HttpStatus.CREATED)
    fun placeChild(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @Valid @RequestBody request: CreateChildPlacementRequest) = learning.placeChild(jwt, organizationId, childId, request)

    @PostMapping("/tenant-users/{userId}/password") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun changeTenantUserPassword(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable userId: UUID, @Valid @RequestBody request: ChangeTenantUserPasswordRequest) = administration.changeTenantUserPassword(jwt, organizationId, userId, request)

    @PostMapping("/device-tokens") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun registerDevice(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: RegisterDeviceRequest) = administration.registerDevice(jwt, organizationId, request)

    @GetMapping("/device-notification-preference")
    fun deviceNotificationPreference(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @RequestParam installationId: String) = administration.deviceNotificationPreference(jwt, organizationId, installationId)

    @PatchMapping("/device-notification-preference")
    fun updateDeviceNotificationPreference(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: UpdateDeviceNotificationPreferenceRequest) = administration.updateDeviceNotificationPreference(jwt, organizationId, request)

    @GetMapping("/notifications")
    fun notifications(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @RequestParam(required = false) search: String?) = administration.notifications(jwt, organizationId, search)

    @PatchMapping("/notifications/{notificationId}/read")
    fun markNotificationRead(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable notificationId: UUID) = administration.markNotificationRead(jwt, organizationId, notificationId)

    @GetMapping("/staff-reminders")
    fun staffReminders(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = staffReminders.list(jwt, organizationId)

    @PostMapping("/staff-reminders") @ResponseStatus(HttpStatus.CREATED)
    fun createStaffReminder(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: UpsertStaffReminderRequest) = staffReminders.create(jwt, organizationId, request)

    @PatchMapping("/staff-reminders/{reminderId}")
    fun updateStaffReminder(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable reminderId: UUID, @Valid @RequestBody request: UpsertStaffReminderRequest) = staffReminders.update(jwt, organizationId, reminderId, request)

    @PatchMapping("/staff-reminders/{reminderId}/active")
    fun setStaffReminderActive(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable reminderId: UUID, @RequestBody request: UpdateStaffReminderActiveRequest) = staffReminders.setActive(jwt, organizationId, reminderId, request)

    @DeleteMapping("/staff-reminders/{reminderId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteStaffReminder(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable reminderId: UUID) = staffReminders.delete(jwt, organizationId, reminderId)

    @PutMapping("/staff-reminders/local-schedules") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun syncStaffReminderSchedules(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: SyncStaffReminderSchedulesRequest) = staffReminders.syncLocalSchedules(jwt, organizationId, request)
}

@RestController
@RequestMapping("/v1")
@SecurityRequirement(name = "bearerAuth")
class BillingController(private val billing: BillingService, private val overtime: OvertimeService) {
    @GetMapping("/service-plans")
    fun servicePlans(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = billing.plans(jwt, organizationId)

    @PostMapping("/service-plans") @ResponseStatus(HttpStatus.CREATED)
    fun createServicePlan(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: CreateServicePlanRequest) = billing.createPlan(jwt, organizationId, request)

    @GetMapping("/branch-capacities")
    fun branchCapacities(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = billing.branchCapacities(jwt, organizationId)

    @PutMapping("/branches/{branchId}/capacity")
    fun setBranchCapacity(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable branchId: UUID, @Valid @RequestBody request: SetBranchCapacityRequest) = billing.setBranchCapacity(jwt, organizationId, branchId, request)

    @GetMapping("/branches/{branchId}/operating-hours")
    fun branchOperatingHours(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable branchId: UUID) = overtime.branchHours(jwt, organizationId, branchId)

    @PutMapping("/branches/{branchId}/operating-hours")
    fun updateBranchOperatingHours(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable branchId: UUID, @Valid @RequestBody request: UpdateBranchOperatingHoursRequest) = overtime.updateBranchHours(jwt, organizationId, branchId, request)

    @GetMapping("/parent/operating-hours")
    fun parentOperatingHours(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = overtime.parentHours(jwt, organizationId)

    @GetMapping("/parent/operating-hours/all-tenants")
    fun parentOperatingHoursAllTenants(@AuthenticationPrincipal jwt: Jwt) = overtime.parentHoursAllTenants(jwt)

    @GetMapping("/overtime-charges")
    fun overtimeCharges(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = overtime.charges(jwt, organizationId)

    @PostMapping("/overtime-charges") @ResponseStatus(HttpStatus.CREATED)
    fun createOvertimeCharge(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: CreateOvertimeChargeRequest) = overtime.createCharge(jwt, organizationId, request)

    @PatchMapping("/overtime-charges/{chargeId}")
    fun updateOvertimeCharge(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable chargeId: UUID, @Valid @RequestBody request: CreateOvertimeChargeRequest) = overtime.updateCharge(jwt, organizationId, chargeId, request)

    @PostMapping("/overtime-charges/{chargeId}/void") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun voidOvertimeCharge(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable chargeId: UUID) = overtime.voidCharge(jwt, organizationId, chargeId)

    @GetMapping("/service-plans/{planId}/discounts")
    fun planDiscounts(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable planId: UUID) = billing.planDiscounts(jwt, organizationId, planId)

    @PostMapping("/service-plans/{planId}/discounts") @ResponseStatus(HttpStatus.CREATED)
    fun createPlanDiscount(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable planId: UUID, @Valid @RequestBody request: CreateServicePlanDiscountRequest) = billing.createPlanDiscount(jwt, organizationId, planId, request)

    @PostMapping("/service-plans/{planId}/discounts/{discountId}/deactivate")
    fun deactivatePlanDiscount(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable planId: UUID, @PathVariable discountId: UUID) = billing.deactivatePlanDiscount(jwt, organizationId, planId, discountId)

    @GetMapping("/service-plan-templates")
    fun planTemplates(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = billing.planTemplates(jwt, organizationId)

    @PostMapping("/service-plan-templates") @ResponseStatus(HttpStatus.CREATED)
    fun createPlanTemplate(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: UpsertServicePlanTemplateRequest) = billing.createPlanTemplate(jwt, organizationId, request)

    @PatchMapping("/service-plan-templates/{templateId}")
    fun updatePlanTemplate(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable templateId: UUID, @Valid @RequestBody request: UpsertServicePlanTemplateRequest) = billing.updatePlanTemplate(jwt, organizationId, templateId, request)

    @DeleteMapping("/service-plan-templates/{templateId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deletePlanTemplate(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable templateId: UUID) = billing.deletePlanTemplate(jwt, organizationId, templateId)

    @PostMapping("/service-purchases") @ResponseStatus(HttpStatus.CREATED)
    fun purchaseService(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: com.daycare.api.service.PurchaseServiceRequest) = billing.purchase(jwt, organizationId, request)

    @GetMapping("/service-entitlements")
    fun entitlements(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @RequestParam(required = false) branchId: UUID?) = billing.entitlements(jwt, organizationId, BranchListFilter(branchId))

    @PostMapping("/service-entitlements/{entitlementId}/bookings") @ResponseStatus(HttpStatus.CREATED)
    fun createEntitlementBookings(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable entitlementId: UUID, @Valid @RequestBody request: CreateEntitlementBookingsRequest) = billing.createBookingsFromEntitlement(jwt, organizationId, entitlementId, request)

    @GetMapping("/bookings")
    fun bookings(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @RequestParam(required = false) branchId: UUID?) = billing.bookings(jwt, organizationId, false, BranchListFilter(branchId))

    @GetMapping("/bookings/pending-approval")
    fun pendingBookings(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @RequestParam(required = false) branchId: UUID?, @RequestParam(required = false) search: String?) = billing.bookings(jwt, organizationId, true, BranchListFilter(branchId), search)

    @PostMapping("/bookings/{bookingId}/approval")
    fun approveBooking(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable bookingId: UUID, @Valid @RequestBody request: BookingApprovalRequest) = billing.approveBooking(jwt, organizationId, bookingId, request)

    @GetMapping("/invoices")
    fun invoices(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @RequestParam(required = false) branchId: UUID?, @RequestParam(required = false) search: String?) = billing.invoices(jwt, organizationId, BranchListFilter(branchId), search)

    @GetMapping("/invoices/{invoiceId}")
    fun invoice(@AuthenticationPrincipal jwt: Jwt, @PathVariable invoiceId: UUID) = billing.invoice(jwt, invoiceId)

    @PostMapping("/invoices/{invoiceId}/payment-proof")
    fun submitPaymentProof(@AuthenticationPrincipal jwt: Jwt, @PathVariable invoiceId: UUID, @Valid @RequestBody request: com.daycare.api.service.SubmitPaymentProofRequest) = billing.submitPaymentProof(jwt, invoiceId, request)

    @GetMapping("/invoices/{invoiceId}/payment-proof")
    fun paymentProof(@AuthenticationPrincipal jwt: Jwt, @PathVariable invoiceId: UUID) = billing.paymentProof(jwt, invoiceId)

    @PostMapping("/invoices/{invoiceId}/payment-proof/review")
    fun reviewPaymentProof(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable invoiceId: UUID, @Valid @RequestBody request: com.daycare.api.service.ReviewPaymentProofRequest) = billing.reviewPaymentProof(jwt, organizationId, invoiceId, request)

    @PostMapping("/invoices/{invoiceId}/mark-paid")
    fun markInvoicePaid(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable invoiceId: UUID) = billing.markInvoicePaid(jwt, organizationId, invoiceId)
}

@RestController
@RequestMapping("/v1/analytics")
class AnalyticsController(private val analytics: AnalyticsService) {
    @GetMapping("/occupancy")
    fun occupancy(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = analytics.occupancy(jwt, organizationId)

    @GetMapping("/parent-retention")
    fun parentRetention(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @RequestParam(required = false) monthsBack: Int?) = analytics.parentRetention(jwt, organizationId, monthsBack ?: 6)

    @GetMapping("/development-trend")
    fun developmentTrend(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @RequestParam(required = false) monthsBack: Int?) = analytics.developmentTrend(jwt, organizationId, monthsBack ?: 6)
}
