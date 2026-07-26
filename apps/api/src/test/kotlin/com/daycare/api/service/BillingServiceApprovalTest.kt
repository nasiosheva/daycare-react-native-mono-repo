package com.daycare.api.service

import com.daycare.api.domain.BookingStatus
import com.daycare.api.domain.EntitlementStatus
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.domain.Role
import com.daycare.api.domain.ServicePlanType
import com.daycare.api.persistence.Booking
import com.daycare.api.persistence.BookingRepository
import com.daycare.api.persistence.BranchRepository
import com.daycare.api.persistence.Child
import com.daycare.api.persistence.ChildRepository
import com.daycare.api.persistence.Invoice
import com.daycare.api.persistence.InvoiceRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.MembershipRepository
import com.daycare.api.persistence.ParentEnrollmentRepository
import com.daycare.api.persistence.PaymentProofRepository
import com.daycare.api.persistence.ServiceEntitlement
import com.daycare.api.persistence.ServiceEntitlementRepository
import com.daycare.api.persistence.ServicePlanDiscountRedemptionRepository
import com.daycare.api.persistence.ServicePlanDiscountRepository
import com.daycare.api.persistence.ServicePlanRepository
import com.daycare.api.persistence.ServicePlanTemplateRepository
import com.daycare.api.persistence.UserProfile
import com.daycare.api.persistence.UserProfileRepository
import com.daycare.api.realtime.RealtimeFlag
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.context.ApplicationEventPublisher
import org.springframework.security.oauth2.jwt.Jwt
import java.math.BigDecimal
import java.time.LocalDate
import java.util.Optional
import java.util.UUID

class BillingServiceApprovalTest {
    @Test
    fun `approved booking is confirmed and Parent is notified`() {
        val fixture = fixture()
        val booking = fixture.booking()
        fixture.stub(booking)

        val response = fixture.service.approveBooking(fixture.jwt, fixture.organizationId, booking.id, BookingApprovalRequest(approved = true))

        assertEquals(BookingStatus.CONFIRMED, response.status)
        assertEquals(BookingStatus.CONFIRMED, booking.status)
        verify(fixture.notifications).notify(fixture.organizationId, fixture.parent.id, "Booking disetujui", "Booking ${fixture.child.firstName} pada ${booking.bookingDate} disetujui.", null, setOf(RealtimeFlag.BOOKINGS, RealtimeFlag.ENTITLEMENTS))
    }

    @Test
    fun `rejected booking releases its reserved credit and capacity then notifies Parent`() {
        val fixture = fixture()
        val booking = fixture.booking()
        fixture.stub(booking)

        val response = fixture.service.approveBooking(fixture.jwt, fixture.organizationId, booking.id, BookingApprovalRequest(approved = false))

        assertEquals(BookingStatus.REJECTED, response.status)
        assertEquals(BookingStatus.REJECTED, booking.status)
        assertEquals(0, fixture.entitlement.reservedCredits)
        verify(fixture.capacity).releaseForBooking(booking.id)
        verify(fixture.notifications).notify(fixture.organizationId, fixture.parent.id, "Booking ditolak", "Booking ${fixture.child.firstName} pada ${booking.bookingDate} ditolak.", null, setOf(RealtimeFlag.BOOKINGS, RealtimeFlag.ENTITLEMENTS))
    }

    private fun fixture(): ApprovalFixture {
        val access = mock(AccessService::class.java)
        val childScopes = mock(ChildScopeService::class.java)
        val children = mock(ChildRepository::class.java)
        val branches = mock(BranchRepository::class.java)
        val plans = mock(ServicePlanRepository::class.java)
        val invoices = mock(InvoiceRepository::class.java)
        val paymentProofs = mock(PaymentProofRepository::class.java)
        val entitlements = mock(ServiceEntitlementRepository::class.java)
        val bookings = mock(BookingRepository::class.java)
        val users = mock(UserProfileRepository::class.java)
        val discounts = mock(ServicePlanDiscountRepository::class.java)
        val discountRedemptions = mock(ServicePlanDiscountRedemptionRepository::class.java)
        val templates = mock(ServicePlanTemplateRepository::class.java)
        val capacity = mock(CapacityReservationService::class.java)
        val notifications = mock(NotificationService::class.java)
        val events = mock(ApplicationEventPublisher::class.java)
        val parentEnrollments = mock(ParentEnrollmentRepository::class.java)
        val memberships = mock(MembershipRepository::class.java)
        val identity = mock(IdentityService::class.java)
        val branchFilters = mock(BranchListFilterService::class.java)
        val organizationId = UUID.randomUUID()
        val parent = UserProfile(displayName = "Parent")
        val staffAdmin = UserProfile(displayName = "Staff Admin")
        val child = Child(organizationId = organizationId, firstName = "Alya")
        val invoice = Invoice(organizationId = organizationId, payerUserId = parent.id, invoiceNumber = "INV-BOOKING", totalAmount = BigDecimal("150000"))
        val entitlement = ServiceEntitlement(organizationId = organizationId, branchId = child.branchId, childId = child.id, ownerUserId = parent.id, invoiceId = invoice.id, planName = "Paket Harian", planType = ServicePlanType.DAILY, status = EntitlementStatus.ACTIVE, totalCredits = 5, reservedCredits = 1)
        val scope = AccessScope(staffAdmin, Membership(userId = staffAdmin.id, organizationId = organizationId, role = Role.STAFF_ADMIN), emptySet(), setOf(InstitutionCapability.DAYCARE_OPERATIONS))
        return ApprovalFixture(
            BillingService(access, childScopes, children, branches, plans, invoices, paymentProofs, entitlements, bookings, users, discounts, discountRedemptions, templates, capacity, notifications, events, parentEnrollments, memberships, identity, branchFilters),
            access, childScopes, children, invoices, entitlements, bookings, capacity, notifications, parentEnrollments, organizationId, parent, child, invoice, entitlement, scope, mock(Jwt::class.java),
        )
    }

    private data class ApprovalFixture(
        val service: BillingService,
        val access: AccessService,
        val childScopes: ChildScopeService,
        val children: ChildRepository,
        val invoices: InvoiceRepository,
        val entitlements: ServiceEntitlementRepository,
        val bookings: BookingRepository,
        val capacity: CapacityReservationService,
        val notifications: NotificationService,
        val parentEnrollments: ParentEnrollmentRepository,
        val organizationId: UUID,
        val parent: UserProfile,
        val child: Child,
        val invoice: Invoice,
        val entitlement: ServiceEntitlement,
        val scope: AccessScope,
        val jwt: Jwt,
    ) {
        fun booking() = Booking(organizationId = organizationId, branchId = child.branchId, childId = child.id, entitlementId = entitlement.id, invoiceId = invoice.id, bookingDate = LocalDate.now(), status = BookingStatus.PENDING_APPROVAL, planName = entitlement.planName)

        fun stub(booking: Booking) {
            `when`(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN, Role.STAFF), InstitutionCapability.DAYCARE_OPERATIONS)).thenReturn(scope)
            `when`(bookings.findById(booking.id)).thenReturn(Optional.of(booking))
            `when`(parentEnrollments.findByInvoiceId(invoice.id)).thenReturn(null)
            `when`(childScopes.requireStaffManagedChild(scope, child.id, organizationId)).thenReturn(child)
            `when`(entitlements.findById(entitlement.id)).thenReturn(Optional.of(entitlement))
            `when`(children.findById(child.id)).thenReturn(Optional.of(child))
            `when`(invoices.findById(invoice.id)).thenReturn(Optional.of(invoice))
        }
    }
}
