package com.daycare.api.persistence

import com.daycare.api.domain.InvitationStatus
import com.daycare.api.domain.DevelopmentCategory
import com.daycare.api.domain.Role
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

@Entity @Table(name = "users")
class UserProfile(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "firebase_uid", nullable = false, unique = true) var firebaseUid: String = "",
    @Column(nullable = false) var displayName: String = "",
    var email: String? = null,
    @Column(name = "phone_number") var phoneNumber: String? = null,
    @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(),
)

@Entity @Table(name = "organizations")
class Organization(@Id var id: UUID = UUID.randomUUID(), @Column(nullable = false) var name: String = "", @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now())

@Entity @Table(name = "branches")
class Branch(@Id var id: UUID = UUID.randomUUID(), @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(), @Column(nullable = false) var name: String = "", @Column(nullable = false) var timezone: String = "Asia/Jakarta")

@Entity @Table(name = "classrooms")
class Classroom(@Id var id: UUID = UUID.randomUUID(), @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(), @Column(name = "branch_id", nullable = false) var branchId: UUID = UUID.randomUUID(), @Column(nullable = false) var name: String = "")

@Entity @Table(name = "memberships")
class Membership(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "user_id", nullable = false) var userId: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Enumerated(EnumType.STRING) @Column(nullable = false) var role: Role = Role.PARENT,
    @Column(name = "branch_id") var branchId: UUID? = null,
    @Column(name = "classroom_id") var classroomId: UUID? = null,
)

@Entity @Table(name = "children")
class Child(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(name = "branch_id", nullable = false) var branchId: UUID = UUID.randomUUID(),
    @Column(name = "classroom_id") var classroomId: UUID? = null,
    @Column(name = "first_name", nullable = false) var firstName: String = "",
    @Column(name = "last_name") var lastName: String? = null,
    @Column(name = "date_of_birth", nullable = false) var dateOfBirth: LocalDate = LocalDate.now(),
)

@Entity @Table(name = "guardian_links")
class GuardianLink(@Id var id: UUID = UUID.randomUUID(), @Column(name = "child_id", nullable = false) var childId: UUID = UUID.randomUUID(), @Column(name = "user_id", nullable = false) var userId: UUID = UUID.randomUUID())

@Entity @Table(name = "attendance_records")
class AttendanceRecord(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(name = "branch_id", nullable = false) var branchId: UUID = UUID.randomUUID(),
    @Column(name = "child_id", nullable = false) var childId: UUID = UUID.randomUUID(),
    @Column(name = "operational_date", nullable = false) var operationalDate: LocalDate = LocalDate.now(),
    @Column(name = "checked_in_at") var checkedInAt: Instant? = null,
    @Column(name = "checked_out_at") var checkedOutAt: Instant? = null,
    @Column(name = "check_in_method") var checkInMethod: String? = null,
    @Column(name = "check_out_method") var checkOutMethod: String? = null,
)

@Entity @Table(name = "invitations")
class Invitation(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    var email: String? = null,
    @Column(name = "phone_number") var phoneNumber: String? = null,
    @Enumerated(EnumType.STRING) @Column(nullable = false) var role: Role = Role.PARENT,
    @Column(name = "branch_id") var branchId: UUID? = null,
    @Column(name = "classroom_id") var classroomId: UUID? = null,
    @Enumerated(EnumType.STRING) @Column(nullable = false) var status: InvitationStatus = InvitationStatus.PENDING,
    @Column(name = "expires_at", nullable = false) var expiresAt: Instant = Instant.now().plusSeconds(604800),
)

@Entity @Table(name = "notifications")
class Notification(@Id var id: UUID = UUID.randomUUID(), @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(), @Column(name = "recipient_user_id", nullable = false) var recipientUserId: UUID = UUID.randomUUID(), @Column(nullable = false) var title: String = "", @Column(nullable = false) var body: String = "", @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now(), @Column(name = "read_at") var readAt: Instant? = null)

@Entity @Table(name = "device_tokens")
class DeviceToken(@Id var id: UUID = UUID.randomUUID(), @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(), @Column(name = "user_id", nullable = false) var userId: UUID = UUID.randomUUID(), @Column(nullable = false, unique = true) var token: String = "", @Column(nullable = false) var platform: String = "")

@Entity @Table(name = "development_entries")
class DevelopmentEntry(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(),
    @Column(name = "branch_id", nullable = false) var branchId: UUID = UUID.randomUUID(),
    @Column(name = "child_id", nullable = false) var childId: UUID = UUID.randomUUID(),
    @Column(name = "author_user_id", nullable = false) var authorUserId: UUID = UUID.randomUUID(),
    @Enumerated(EnumType.STRING) @Column(nullable = false) var category: DevelopmentCategory = DevelopmentCategory.OBSERVATION,
    @Column(nullable = false) var title: String = "",
    @Column(nullable = false) var content: String = "",
    @Column(name = "recorded_at", nullable = false) var recordedAt: Instant = Instant.now(),
)
