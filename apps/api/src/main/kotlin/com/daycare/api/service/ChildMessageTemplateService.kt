package com.daycare.api.service

import com.daycare.api.domain.Role
import com.daycare.api.persistence.ChildMessageTemplate
import com.daycare.api.persistence.ChildMessageTemplateRepository
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

const val MAX_CHILD_MESSAGE_TEMPLATES = 50

data class ChildMessageTemplateRequest(@field:NotBlank @field:Size(max = 500) val body: String)
data class ChildMessageTemplateResponse(val id: UUID, val body: String, val createdAt: Instant)
object ChildMessageTemplateError {
    const val NOT_FOUND = "child_message_template.not_found"
    const val LIMIT_REACHED = "child_message_template.limit_reached"
}

/**
 * Quick replies for child chats: every active Staff/Staff Admin of the tenant
 * can read them to fill a draft; only a Staff Admin manages them. Templates
 * never send a message on their own.
 */
@Service
class ChildMessageTemplateService(
    private val access: AccessService,
    private val templates: ChildMessageTemplateRepository,
) {
    @Transactional(readOnly = true)
    fun list(jwt: Jwt, organizationId: UUID): List<ChildMessageTemplateResponse> {
        access.require(jwt, organizationId, setOf(Role.STAFF, Role.STAFF_ADMIN))
        return templates.findAllByOrganizationIdOrderByCreatedAtAsc(organizationId).map(::response)
    }

    @Transactional
    fun create(jwt: Jwt, organizationId: UUID, request: ChildMessageTemplateRequest): ChildMessageTemplateResponse {
        requireManager(jwt, organizationId)
        require(templates.countByOrganizationId(organizationId) < MAX_CHILD_MESSAGE_TEMPLATES) { ChildMessageTemplateError.LIMIT_REACHED }
        return response(templates.save(ChildMessageTemplate(organizationId = organizationId, body = request.body.trim(), createdAt = Instant.now())))
    }

    @Transactional
    fun update(jwt: Jwt, organizationId: UUID, templateId: UUID, request: ChildMessageTemplateRequest): ChildMessageTemplateResponse {
        requireManager(jwt, organizationId)
        val template = requireTemplate(organizationId, templateId)
        template.body = request.body.trim()
        return response(templates.save(template))
    }

    @Transactional
    fun delete(jwt: Jwt, organizationId: UUID, templateId: UUID) {
        requireManager(jwt, organizationId)
        templates.delete(requireTemplate(organizationId, templateId))
    }

    private fun requireManager(jwt: Jwt, organizationId: UUID) {
        access.requireWritable(access.require(jwt, organizationId, setOf(Role.STAFF_ADMIN)))
    }

    private fun requireTemplate(organizationId: UUID, templateId: UUID): ChildMessageTemplate =
        templates.findByIdAndOrganizationId(templateId, organizationId) ?: throw IllegalArgumentException(ChildMessageTemplateError.NOT_FOUND)

    private fun response(template: ChildMessageTemplate) = ChildMessageTemplateResponse(template.id, template.body, template.createdAt)
}
