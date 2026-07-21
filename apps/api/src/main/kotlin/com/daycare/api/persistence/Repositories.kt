package com.daycare.api.persistence

import com.daycare.api.domain.InvitationStatus
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDate
import java.util.UUID

interface UserProfileRepository : JpaRepository<UserProfile, UUID> { fun findByFirebaseUid(firebaseUid: String): UserProfile? }
interface MembershipRepository : JpaRepository<Membership, UUID> { fun findAllByUserIdAndOrganizationId(userId: UUID, organizationId: UUID): List<Membership>; fun findAllByUserId(userId: UUID): List<Membership> }
interface OrganizationRepository : JpaRepository<Organization, UUID>
interface BranchRepository : JpaRepository<Branch, UUID>
interface ChildRepository : JpaRepository<Child, UUID> { fun findAllByOrganizationId(organizationId: UUID): List<Child>; fun findAllByOrganizationIdAndBranchId(organizationId: UUID, branchId: UUID): List<Child> }
interface GuardianLinkRepository : JpaRepository<GuardianLink, UUID> { fun findAllByUserId(userId: UUID): List<GuardianLink>; fun existsByChildIdAndUserId(childId: UUID, userId: UUID): Boolean; fun findAllByChildId(childId: UUID): List<GuardianLink> }
interface AttendanceRepository : JpaRepository<AttendanceRecord, UUID> { fun findByChildIdAndOperationalDate(childId: UUID, operationalDate: LocalDate): AttendanceRecord? }
interface InvitationRepository : JpaRepository<Invitation, UUID> { fun findAllByStatus(status: InvitationStatus): List<Invitation> }
interface NotificationRepository : JpaRepository<Notification, UUID> { fun findAllByRecipientUserIdAndOrganizationIdOrderByCreatedAtDesc(recipientUserId: UUID, organizationId: UUID): List<Notification> }
interface DeviceTokenRepository : JpaRepository<DeviceToken, UUID> { fun findAllByUserIdAndOrganizationId(userId: UUID, organizationId: UUID): List<DeviceToken>; fun findByToken(token: String): DeviceToken? }
interface DevelopmentEntryRepository : JpaRepository<DevelopmentEntry, UUID> { fun findAllByOrganizationIdAndChildIdOrderByRecordedAtDesc(organizationId: UUID, childId: UUID): List<DevelopmentEntry> }
