package com.daycare.api.persistence

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity @Table(name = "audit_log")
class AuditLog(@Id var id: UUID = UUID.randomUUID(), @Column(name = "organization_id", nullable = false) var organizationId: UUID = UUID.randomUUID(), @Column(name = "actor_user_id", nullable = false) var actorUserId: UUID = UUID.randomUUID(), @Column(name = "entity_type", nullable = false) var entityType: String = "", @Column(name = "entity_id", nullable = false) var entityId: UUID = UUID.randomUUID(), @Column(nullable = false) var action: String = "", @Column(nullable = false) var source: String = "", @Column(name = "created_at", nullable = false) var createdAt: Instant = Instant.now())

interface AuditLogRepository : org.springframework.data.jpa.repository.JpaRepository<AuditLog, UUID>
