package com.daycare.api.web

import com.daycare.api.service.AccessService
import com.daycare.api.service.AdministrationService
import com.daycare.api.service.AttendanceCommand
import com.daycare.api.service.AttendanceService
import com.daycare.api.service.BillingService
import com.daycare.api.service.BookingApprovalRequest
import com.daycare.api.service.CreateEntitlementBookingsRequest
import com.daycare.api.service.CreateServicePlanRequest
import com.daycare.api.service.CreateChildRequest
import com.daycare.api.service.CreateInvitationRequest
import com.daycare.api.service.CreateDevelopmentEntryRequest
import com.daycare.api.service.DevelopmentService
import com.daycare.api.service.RegisterDeviceRequest
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/v1")
@SecurityRequirement(name = "bearerAuth")
class IdentityController(private val access: AccessService) {
    @GetMapping("/me") fun me(@AuthenticationPrincipal jwt: Jwt) = access.currentUser(jwt)
}

@RestController
@RequestMapping("/v1")
@SecurityRequirement(name = "bearerAuth")
class DaycareController(private val attendance: AttendanceService, private val administration: AdministrationService, private val development: DevelopmentService) {
    @GetMapping("/children")
    fun children(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID) = attendance.listChildren(jwt, organizationId)

    @PostMapping("/children") @ResponseStatus(HttpStatus.CREATED)
    fun createChild(@AuthenticationPrincipal jwt: Jwt, @RequestHeader("X-Organization-Id") organizationId: UUID, @Valid @RequestBody request: CreateChildRequest) = administration.createChild(jwt, organizationId, request)

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
