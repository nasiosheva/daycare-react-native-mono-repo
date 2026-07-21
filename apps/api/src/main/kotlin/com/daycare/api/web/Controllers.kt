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
import com.daycare.api.service.CreateDevelopmentEntryRequest
import com.daycare.api.service.DevelopmentService
import com.daycare.api.service.RegisterDeviceRequest
import com.daycare.api.service.CreateTenantRequest
import com.daycare.api.service.CreatePlatformAdminRequest
import com.daycare.api.service.ChangeTenantUserPasswordRequest
import com.daycare.api.service.AcademicService
import com.daycare.api.service.CreateAcademicYearRequest
import com.daycare.api.service.CreateCurriculumProgramRequest
import com.daycare.api.service.ChangePlatformAdminPinRequest
import com.daycare.api.service.PlatformAdminPinService
import com.daycare.api.service.PlatformAdministrationService
import com.daycare.api.service.UpdateTenantRequest
import com.daycare.api.service.RenewTenantSubscriptionRequest
import com.daycare.api.service.ChildManagementService
import com.daycare.api.service.UpdateChildRequest
import com.daycare.api.service.CreateChildProgramRequest
import com.daycare.api.service.AssignChildStaffRequest
import com.daycare.api.service.SetBranchCapacityRequest
import com.daycare.api.service.UpsertServicePlanTemplateRequest
import com.daycare.api.service.LocalAuthenticationService
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.http.HttpStatus
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
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

data class LocalLoginRequest(@field:NotBlank @field:Size(max = 128) val identifier: String, @field:Size(min = 6, max = 128) val password: String)
data class LocalPasswordRequest(@field:Size(min = 6, max = 128) val password: String)
data class LocalProfileRequest(@field:NotBlank @field:Size(max = 128) val displayName: String)

@RestController
@RequestMapping("/v1/auth/local")
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(prefix = "daycare", name = ["local-auth-enabled"], havingValue = "true")
class LocalAuthenticationController(private val localAuthentication: LocalAuthenticationService) {
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
}

@RestController
@RequestMapping("/v1/platform")
@SecurityRequirement(name = "bearerAuth")
class PlatformController(private val platformAdministration: PlatformAdministrationService, private val platformAdminPin: PlatformAdminPinService) {
    @GetMapping("/tenants")
    fun tenants(@AuthenticationPrincipal jwt: Jwt) = platformAdministration.tenants(jwt)

    @PostMapping("/tenants") @ResponseStatus(HttpStatus.CREATED)
    fun createTenant(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: CreateTenantRequest) = platformAdministration.createTenant(jwt, request)

    @GetMapping("/tenants/{organizationId}")
    fun tenant(@AuthenticationPrincipal jwt: Jwt, @PathVariable organizationId: UUID) = platformAdministration.tenant(jwt, organizationId)

    @PatchMapping("/tenants/{organizationId}")
    fun updateTenant(@AuthenticationPrincipal jwt: Jwt, @PathVariable organizationId: UUID, @Valid @RequestBody request: UpdateTenantRequest) = platformAdministration.updateTenant(jwt, organizationId, request)

    @PostMapping("/tenants/{organizationId}/subscription/renew")
    fun renewSubscription(@AuthenticationPrincipal jwt: Jwt, @PathVariable organizationId: UUID, @Valid @RequestBody request: RenewTenantSubscriptionRequest) = platformAdministration.renewSubscription(jwt, organizationId, request)

    @PostMapping("/tenants/{organizationId}/subscription/{status}")
    fun setSubscriptionStatus(@AuthenticationPrincipal jwt: Jwt, @PathVariable organizationId: UUID, @PathVariable status: com.daycare.api.domain.TenantSubscriptionStatus) = platformAdministration.setSubscriptionStatus(jwt, organizationId, status)

    @PostMapping("/admins") @ResponseStatus(HttpStatus.CREATED)
    fun createPlatformAdmin(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: CreatePlatformAdminRequest) = mapOf("id" to platformAdministration.createPlatformAdmin(jwt, request))

    @PostMapping("/pin") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun changePin(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: ChangePlatformAdminPinRequest) = platformAdminPin.changePin(jwt, request)

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
class InstitutionController(private val attendance: AttendanceService, private val administration: AdministrationService, private val development: DevelopmentService, private val academic: AcademicService, private val childManagement: ChildManagementService) {
    @GetMapping("/children")
    fun children(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = attendance.listChildren(jwt, organizationId)

    @PostMapping("/children") @ResponseStatus(HttpStatus.CREATED)
    fun createChild(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: CreateChildRequest) = administration.createChild(jwt, organizationId, request)

    @GetMapping("/children/{childId}")
    fun childProfile(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID) = childManagement.profile(jwt, organizationId, childId)

    @PatchMapping("/children/{childId}")
    fun updateChild(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable childId: UUID, @Valid @RequestBody request: UpdateChildRequest) = childManagement.update(jwt, organizationId, childId, request)

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

    @PostMapping("/invitations") @ResponseStatus(HttpStatus.CREATED)
    fun invite(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: CreateInvitationRequest) = mapOf("id" to administration.invite(jwt, organizationId, request))

    @PostMapping("/tenant-users") @ResponseStatus(HttpStatus.CREATED)
    fun createTenantUser(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: CreateTenantUserRequest) = administration.createTenantUser(jwt, organizationId, request)

    @GetMapping("/tenant-users")
    fun tenantUsers(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = administration.tenantUsers(jwt, organizationId)

    @GetMapping("/academic-years")
    fun academicYears(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = academic.academicYears(jwt, organizationId)

    @PostMapping("/academic-years") @ResponseStatus(HttpStatus.CREATED)
    fun createAcademicYear(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: CreateAcademicYearRequest) = academic.createAcademicYear(jwt, organizationId, request)

    @GetMapping("/curriculum-programs")
    fun curriculumPrograms(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = academic.curriculumPrograms(jwt, organizationId)

    @PostMapping("/curriculum-programs") @ResponseStatus(HttpStatus.CREATED)
    fun createCurriculumProgram(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: CreateCurriculumProgramRequest) = academic.createCurriculumProgram(jwt, organizationId, request)

    @PostMapping("/tenant-users/{userId}/password") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun changeTenantUserPassword(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable userId: UUID, @Valid @RequestBody request: ChangeTenantUserPasswordRequest) = administration.changeTenantUserPassword(jwt, organizationId, userId, request)

    @PostMapping("/device-tokens") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun registerDevice(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: RegisterDeviceRequest) = administration.registerDevice(jwt, organizationId, request)

    @GetMapping("/notifications")
    fun notifications(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = administration.notifications(jwt, organizationId)
}

@RestController
@RequestMapping("/v1")
@SecurityRequirement(name = "bearerAuth")
class BillingController(private val billing: BillingService) {
    @GetMapping("/service-plans")
    fun servicePlans(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = billing.plans(jwt, organizationId)

    @PostMapping("/service-plans") @ResponseStatus(HttpStatus.CREATED)
    fun createServicePlan(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: CreateServicePlanRequest) = billing.createPlan(jwt, organizationId, request)

    @GetMapping("/branch-capacities")
    fun branchCapacities(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = billing.branchCapacities(jwt, organizationId)

    @PutMapping("/branches/{branchId}/capacity")
    fun setBranchCapacity(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable branchId: UUID, @Valid @RequestBody request: SetBranchCapacityRequest) = billing.setBranchCapacity(jwt, organizationId, branchId, request)

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
    fun entitlements(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = billing.entitlements(jwt, organizationId)

    @PostMapping("/service-entitlements/{entitlementId}/bookings") @ResponseStatus(HttpStatus.CREATED)
    fun createEntitlementBookings(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable entitlementId: UUID, @Valid @RequestBody request: CreateEntitlementBookingsRequest) = billing.createBookingsFromEntitlement(jwt, organizationId, entitlementId, request)

    @GetMapping("/bookings")
    fun bookings(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = billing.bookings(jwt, organizationId, false)

    @GetMapping("/bookings/pending-approval")
    fun pendingBookings(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = billing.bookings(jwt, organizationId, true)

    @PostMapping("/bookings/{bookingId}/approval")
    fun approveBooking(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable bookingId: UUID, @Valid @RequestBody request: BookingApprovalRequest) = billing.approveBooking(jwt, organizationId, bookingId, request)

    @GetMapping("/invoices")
    fun invoices(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = billing.invoices(jwt, organizationId)

    @PostMapping("/invoices/{invoiceId}/mark-paid")
    fun markInvoicePaid(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @PathVariable invoiceId: UUID) = billing.markInvoicePaid(jwt, organizationId, invoiceId)
}
