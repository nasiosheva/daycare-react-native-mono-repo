package com.daycare.api.web

import com.daycare.api.service.AccessService
import com.daycare.api.service.AdministrationService
import com.daycare.api.service.AttendanceCommand
import com.daycare.api.service.AttendanceService
import com.daycare.api.service.BillingService
import com.daycare.api.service.BookingApprovalRequest
import com.daycare.api.service.CreateEntitlementBookingsRequest
import com.daycare.api.service.CreateServicePlanRequest
import com.daycare.api.service.CreateServicePlanDiscountRequest
import com.daycare.api.service.CreateChildRequest
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
import com.daycare.api.service.AcademicService
import com.daycare.api.service.LearningStructureService
import com.daycare.api.service.UpsertLearningLevelRequest
import com.daycare.api.service.UpsertClassroomRequest
import com.daycare.api.service.AssignClassroomStaffRequest
import com.daycare.api.service.CreateClassroomProgramRequest
import com.daycare.api.service.CreateChildPlacementRequest
import com.daycare.api.service.ChildListFilter
import com.daycare.api.service.BranchListFilter
import com.daycare.api.service.GoalService
import com.daycare.api.service.UpsertGoalTemplateRequest
import com.daycare.api.service.UpsertGoalIndicatorRequest
import com.daycare.api.service.AssignChildGoalRequest
import com.daycare.api.service.GoalCheckInRequest
import com.daycare.api.service.FinalizeChildGoalRequest
import com.daycare.api.service.CreateAcademicYearRequest
import com.daycare.api.service.CreateCurriculumProgramRequest
import com.daycare.api.service.UpsertCurriculumActivityRequest
import com.daycare.api.service.CreateCurriculumActivityAssessmentRequest
import com.daycare.api.service.ChangePlatformAdminPinRequest
import com.daycare.api.service.PlatformAdminPinService
import com.daycare.api.service.PlatformAdministrationService
import com.daycare.api.service.PlatformCurriculumService
import com.daycare.api.service.InstitutionTypeCatalogService
import com.daycare.api.service.CreateInstitutionTypeDefinitionRequest
import com.daycare.api.service.CreateGlobalCurriculumProgramRequest
import com.daycare.api.service.UpdateTenantRequest
import com.daycare.api.service.RenewTenantSubscriptionRequest
import com.daycare.api.service.ChildManagementService
import com.daycare.api.service.UpdateChildRequest
import com.daycare.api.service.CreateChildProgramRequest
import com.daycare.api.service.AssignChildStaffRequest
import com.daycare.api.service.SetBranchCapacityRequest
import com.daycare.api.service.UpsertServicePlanTemplateRequest
import com.daycare.api.service.LocalAuthenticationService
import com.daycare.api.service.ParentEnrollmentService
import com.daycare.api.service.ParentEnrollmentCheckoutRequest
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
import com.daycare.api.service.ReportExportFormat
import com.daycare.api.service.OvertimeService
import com.daycare.api.service.UpdateBranchOperatingHoursRequest
import com.daycare.api.service.CreateOvertimeChargeRequest
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
data class LocalRegistrationRequest(@field:NotBlank @field:Size(max = 128) val displayName: String, @field:NotBlank @field:Size(max = 254) val email: String, @field:NotBlank @field:Size(min = 6, max = 128) val password: String)

@RestController
@RequestMapping("/v1/auth/local")
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(prefix = "daycare", name = ["local-auth-enabled"], havingValue = "true")
class LocalAuthenticationController(private val localAuthentication: LocalAuthenticationService) {
    @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED)
    fun register(@Valid @RequestBody request: LocalRegistrationRequest) = localAuthentication.register(request.displayName, request.email, request.password)

    @PostMapping("/login")
    fun login(@Valid @RequestBody request: LocalLoginRequest) = localAuthentication.login(request.identifier, request.password)

    @PostMapping("/password") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun changePassword(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: LocalPasswordRequest) = localAuthentication.changePassword(jwt.subject, request.password)

    @PatchMapping("/profile")
    fun updateProfile(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: LocalProfileRequest) = localAuthentication.updateDisplayName(jwt.subject, request.displayName)
}

@RestController
@RequestMapping("/v1")
@SecurityRequirement(name = "bearerAuth")
class IdentityController(private val access: AccessService) {
    @GetMapping("/me") fun me(@AuthenticationPrincipal jwt: Jwt) = access.currentUser(jwt)

    @PatchMapping("/me")
    fun updateMe(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: UpdatePersonalDetailsRequest) = access.updatePersonalDetails(jwt, request.gender, request.dateOfBirth)
}

@RestController
@RequestMapping("/v1/parent-enrollment")
@SecurityRequirement(name = "bearerAuth")
class ParentEnrollmentController(private val enrollments: ParentEnrollmentService) {
    @GetMapping("/catalog")
    fun catalog(@AuthenticationPrincipal jwt: Jwt) = enrollments.catalog(jwt)

    @PostMapping("/checkout") @ResponseStatus(HttpStatus.CREATED)
    fun checkout(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: ParentEnrollmentCheckoutRequest) = enrollments.checkout(jwt, request)

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
@RequestMapping("/v1/platform")
@SecurityRequirement(name = "bearerAuth")
class PlatformController(
    private val platformAdministration: PlatformAdministrationService,
    private val platformAdminPin: PlatformAdminPinService,
    private val platformCurriculum: PlatformCurriculumService,
    private val institutionTypes: InstitutionTypeCatalogService,
    private val development: DevelopmentService,
) {

    @GetMapping("/development-categories")
    fun globalDevelopmentCategories(@AuthenticationPrincipal jwt: Jwt) = development.globalCategories(jwt)

    @PostMapping("/development-categories") @ResponseStatus(HttpStatus.CREATED)
    fun createGlobalDevelopmentCategory(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: CreateDevelopmentCategoryRequest) = development.createGlobalCategory(jwt, request)

    @PatchMapping("/development-categories/{categoryId}")
    fun updateGlobalDevelopmentCategory(@AuthenticationPrincipal jwt: Jwt, @PathVariable categoryId: UUID, @Valid @RequestBody request: UpdateDevelopmentCategoryRequest) = development.updateGlobalCategory(jwt, categoryId, request)

    @DeleteMapping("/development-categories/{categoryId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteGlobalDevelopmentCategory(@AuthenticationPrincipal jwt: Jwt, @PathVariable categoryId: UUID) = development.deleteGlobalCategory(jwt, categoryId)

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
    fun curriculumPrograms(@AuthenticationPrincipal jwt: Jwt) = platformCurriculum.programs(jwt)

    @PostMapping("/curriculum-programs") @ResponseStatus(HttpStatus.CREATED)
    fun createCurriculumProgram(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: CreateGlobalCurriculumProgramRequest) = platformCurriculum.createProgram(jwt, request)

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
class InstitutionController(private val attendance: AttendanceService, private val administration: AdministrationService, private val development: DevelopmentService, private val academic: AcademicService, private val childManagement: ChildManagementService, private val learning: LearningStructureService, private val branchManagement: BranchManagementService, private val goalService: GoalService, private val staffReminders: StaffReminderService, private val childReports: ChildReportExportService) {
    @GetMapping("/children")
    fun children(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestHeader("X-Organization-Id") organizationId: UUID,
        @RequestParam(required = false) branchId: UUID?,
        @RequestParam(required = false) learningLevelId: UUID?,
        @RequestParam(required = false) classroomId: UUID?,
    ) = attendance.listChildren(jwt, organizationId, ChildListFilter(branchId, learningLevelId, classroomId))

    @GetMapping("/reports/children/export")
    fun exportChildren(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @RequestParam format: ReportExportFormat, @RequestParam(required = false) branchId: UUID?, @RequestParam(required = false) learningLevelId: UUID?, @RequestParam(required = false) classroomId: UUID?): ResponseEntity<ByteArray> {
        val report = childReports.children(jwt, organizationId, format, ChildListFilter(branchId, learningLevelId, classroomId))
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(report.contentType))
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(report.fileName).build().toString())
            .body(report.bytes)
    }

    @PostMapping("/children") @ResponseStatus(HttpStatus.CREATED)
    fun createChild(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: CreateChildRequest) = administration.createChild(jwt, organizationId, request)

    @GetMapping("/children/{childId}")
    fun childProfile(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID) = childManagement.profile(jwt, organizationId, childId)

    @PatchMapping("/children/{childId}")
    fun updateChild(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @Valid @RequestBody request: UpdateChildRequest) = childManagement.update(jwt, organizationId, childId, request)

    @PostMapping("/children/{childId}/deactivate")
    fun deactivateChild(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID) = childManagement.deactivate(jwt, organizationId, childId)

    @PostMapping("/children/{childId}/programs") @ResponseStatus(HttpStatus.CREATED)
    fun addChildProgram(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @Valid @RequestBody request: CreateChildProgramRequest) = childManagement.addProgram(jwt, organizationId, childId, request)

    @DeleteMapping("/children/{childId}/programs/{programId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun removeChildProgram(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @PathVariable programId: UUID) = childManagement.removeProgram(jwt, organizationId, childId, programId)

    @PostMapping("/children/{childId}/staff-assignments") @ResponseStatus(HttpStatus.CREATED)
    fun assignChildStaff(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @Valid @RequestBody request: AssignChildStaffRequest) = childManagement.assignStaff(jwt, organizationId, childId, request)

    @DeleteMapping("/children/{childId}/staff-assignments/{assignmentId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun unassignChildStaff(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @PathVariable assignmentId: UUID) = childManagement.unassignStaff(jwt, organizationId, childId, assignmentId)

    @PostMapping("/children/{childId}/attendance")
    fun recordAttendance(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @Valid @RequestBody command: AttendanceCommand) = attendance.record(jwt, organizationId, childId, command)

    @GetMapping("/children/{childId}/attendance-qr")
    fun issueQr(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID) = attendance.issueQr(jwt, organizationId, childId)

    @GetMapping("/children/{childId}/development-entries")
    fun developmentEntries(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID) = development.list(jwt, organizationId, childId)

    @PostMapping("/children/{childId}/development-entries") @ResponseStatus(HttpStatus.CREATED)
    fun createDevelopmentEntry(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @Valid @RequestBody request: CreateDevelopmentEntryRequest) = development.create(jwt, organizationId, childId, request)

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

    @PostMapping("/child-goals/{goalId}/finalize")
    fun finalizeGoal(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable goalId: UUID, @Valid @RequestBody request: FinalizeChildGoalRequest) = goalService.finalize(jwt, organizationId, goalId, request)

    @PostMapping("/invitations") @ResponseStatus(HttpStatus.CREATED)
    fun invite(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: CreateInvitationRequest) = mapOf("id" to administration.invite(jwt, organizationId, request))

    @PostMapping("/tenant-users") @ResponseStatus(HttpStatus.CREATED)
    fun createTenantUser(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: CreateTenantUserRequest) = administration.createTenantUser(jwt, organizationId, request)

    @GetMapping("/tenant-users")
    fun tenantUsers(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @RequestParam(required = false) branchId: UUID?) = administration.tenantUsers(jwt, organizationId, BranchListFilter(branchId))

    @PostMapping("/tenant-users/{userId}/deactivate") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deactivateTenantUser(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable userId: UUID) = administration.deactivateTenantUser(jwt, organizationId, userId)

    @PatchMapping("/tenant-users/{userId}/child-program-permission")
    fun updateTenantUserChildProgramPermission(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable userId: UUID, @RequestBody request: UpdateTenantUserChildProgramPermissionRequest) = administration.updateTenantUserChildProgramPermission(jwt, organizationId, userId, request)

    @PatchMapping("/tenant-users/{userId}/development-category-permission")
    fun updateTenantUserDevelopmentCategoryPermission(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable userId: UUID, @RequestBody request: UpdateTenantUserDevelopmentCategoryPermissionRequest) = administration.updateTenantUserDevelopmentCategoryPermission(jwt, organizationId, userId, request)

    @GetMapping("/branches")
    fun branches(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = branchManagement.branches(jwt, organizationId)

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
    fun curriculumPrograms(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @RequestParam(required = false) search: String?) = academic.curriculumPrograms(jwt, organizationId, search)

    @PostMapping("/curriculum-programs") @ResponseStatus(HttpStatus.CREATED)
    fun createCurriculumProgram(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: CreateCurriculumProgramRequest) = academic.createCurriculumProgram(jwt, organizationId, request)

    @GetMapping("/curriculum-activities")
    fun activities(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = academic.activities(jwt, organizationId)

    @GetMapping("/goal-templates")
    fun goalTemplates(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @RequestParam(required = false) search: String?) = goalService.templates(jwt, organizationId, search)

    @PostMapping("/goal-templates") @ResponseStatus(HttpStatus.CREATED)
    fun createGoalTemplate(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: UpsertGoalTemplateRequest) = goalService.createTemplate(jwt, organizationId, request)

    @PatchMapping("/goal-templates/{templateId}")
    fun updateGoalTemplate(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable templateId: UUID, @Valid @RequestBody request: UpsertGoalTemplateRequest) = goalService.updateTemplate(jwt, organizationId, templateId, request)

    @PostMapping("/goal-templates/{templateId}/indicators") @ResponseStatus(HttpStatus.CREATED)
    fun createGoalIndicator(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable templateId: UUID, @Valid @RequestBody request: UpsertGoalIndicatorRequest) = goalService.createIndicator(jwt, organizationId, templateId, request)

    @PatchMapping("/goal-templates/{templateId}/indicators/{indicatorId}")
    fun updateGoalIndicator(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable templateId: UUID, @PathVariable indicatorId: UUID, @Valid @RequestBody request: UpsertGoalIndicatorRequest) = goalService.updateIndicator(jwt, organizationId, templateId, indicatorId, request)

    @PostMapping("/goal-templates/{templateId}/indicators/{indicatorId}/archive")
    fun archiveGoalIndicator(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable templateId: UUID, @PathVariable indicatorId: UUID) = goalService.archiveIndicator(jwt, organizationId, templateId, indicatorId)

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
