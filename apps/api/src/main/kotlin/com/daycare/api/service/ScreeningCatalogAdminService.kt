package com.daycare.api.service

import com.daycare.api.domain.ScreeningCatalogProvenance
import com.daycare.api.domain.ScreeningCatalogResourceType
import com.daycare.api.domain.ScreeningQuestionAnswerType
import com.daycare.api.domain.ScreeningLocaleCodes
import com.daycare.api.domain.ScreeningReviewStatus
import com.daycare.api.domain.ScreeningResultMainStatus
import com.daycare.api.domain.ScreeningResultReasonCode
import com.daycare.api.domain.ScreeningRuleSetStatus
import com.daycare.api.domain.ScreeningRuleTriggerKind
import com.daycare.api.domain.ScreeningTemplateStatus
import com.daycare.api.persistence.ScreeningCatalogText
import com.daycare.api.persistence.ScreeningCatalogTextRepository
import com.daycare.api.persistence.ScreeningChoice
import com.daycare.api.persistence.ScreeningChoiceRepository
import com.daycare.api.persistence.ScreeningQuestion
import com.daycare.api.persistence.ScreeningQuestionRepository
import com.daycare.api.persistence.ScreeningRuleSet
import com.daycare.api.persistence.ScreeningRuleSetRepository
import com.daycare.api.persistence.ScreeningRuleTrigger
import com.daycare.api.persistence.ScreeningRuleTriggerRepository
import com.daycare.api.persistence.ScreeningResultRepository
import com.daycare.api.persistence.ScreeningSessionRepository
import com.daycare.api.persistence.ScreeningTemplate
import com.daycare.api.persistence.ScreeningTemplateRepository
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

data class ScreeningTemplateDefinitionRequest(
    val code: String,
    val version: Int,
    val minAgeMonths: Int,
    val maxAgeMonths: Int,
    val ruleVersion: Int = 1,
    val checksum: String,
    val questions: List<ScreeningQuestionDefinitionRequest> = emptyList(),
    val texts: List<ScreeningCatalogTextDefinitionRequest> = emptyList(),
    val ruleTriggers: List<ScreeningRuleTriggerDefinitionRequest> = emptyList(),
)

data class ScreeningQuestionDefinitionRequest(
    val id: UUID? = null,
    val stableQuestionId: String,
    val domain: String,
    val subdomain: String? = null,
    val answerType: ScreeningQuestionAnswerType = ScreeningQuestionAnswerType.SINGLE_CHOICE,
    val required: Boolean = true,
    val needsOpportunity: Boolean = false,
    val informationalOnly: Boolean = false,
    val displayOrder: Int,
    val minAgeMonths: Int? = null,
    val maxAgeMonths: Int? = null,
    val conditionCode: String? = null,
    val observationInstruction: String? = null,
    val sourceVersion: String? = null,
    val reviewStatus: ScreeningReviewStatus = ScreeningReviewStatus.NOT_REVIEWED,
    val choices: List<ScreeningChoiceDefinitionRequest> = emptyList(),
)

data class ScreeningChoiceDefinitionRequest(
    val id: UUID? = null,
    val code: String,
    val displayOrder: Int,
    val enabled: Boolean = true,
)

data class ScreeningCatalogTextDefinitionRequest(
    val id: UUID? = null,
    val resourceType: ScreeningCatalogResourceType,
    val resourceId: UUID,
    val locale: String,
    val textKey: String,
    val textValue: String,
)

data class ScreeningRuleTriggerDefinitionRequest(
    val id: UUID? = null,
    val triggerKind: ScreeningRuleTriggerKind = ScreeningRuleTriggerKind.ANSWER,
    val priority: Int = 0,
    val stableQuestionId: String? = null,
    val answerCode: String? = null,
    val contextCode: String? = null,
    val outputStatus: ScreeningResultMainStatus? = null,
    val reasonCode: ScreeningResultReasonCode? = null,
    val domainCode: String? = null,
    val enabled: Boolean = true,
    val displayOrder: Int,
)

data class ScreeningTemplateAdminResponse(
    val id: UUID,
    val code: String,
    val version: Int,
    val minAgeMonths: Int,
    val maxAgeMonths: Int,
    val status: ScreeningTemplateStatus,
    val provenance: ScreeningCatalogProvenance,
    val ruleVersion: Int,
    val ruleSetStatus: ScreeningRuleSetStatus?,
    val reviewStatus: ScreeningReviewStatus,
    val revision: Long,
    val questions: List<ScreeningQuestionAdminResponse>,
    val texts: List<ScreeningCatalogTextResponse>,
    val ruleTriggers: List<ScreeningRuleTriggerResponse>,
)

data class ScreeningQuestionAdminResponse(
    val id: UUID,
    val stableQuestionId: String,
    val domain: String,
    val subdomain: String?,
    val answerType: ScreeningQuestionAnswerType,
    val required: Boolean,
    val needsOpportunity: Boolean,
    val informationalOnly: Boolean,
    val displayOrder: Int,
    val minAgeMonths: Int?,
    val maxAgeMonths: Int?,
    val conditionCode: String?,
    val observationInstruction: String?,
    val sourceVersion: String?,
    val reviewStatus: ScreeningReviewStatus,
    val choices: List<ScreeningChoiceResponse>,
)

data class ScreeningChoiceResponse(val id: UUID, val code: String, val displayOrder: Int, val enabled: Boolean)
data class ScreeningCatalogTextResponse(val id: UUID, val resourceType: ScreeningCatalogResourceType, val resourceId: UUID, val locale: String, val textKey: String, val textValue: String)
data class ScreeningRuleTriggerResponse(val id: UUID, val triggerKind: ScreeningRuleTriggerKind, val priority: Int, val stableQuestionId: String?, val answerCode: String?, val contextCode: String?, val outputStatus: ScreeningResultMainStatus?, val reasonCode: ScreeningResultReasonCode?, val domainCode: String?, val enabled: Boolean, val displayOrder: Int)

data class ScreeningCatalogValidationResponse(val valid: Boolean, val errors: List<String>)
data class ScreeningCatalogReviewRequest(val approved: Boolean)

@Service
class ScreeningCatalogAdminService(
    private val platform: PlatformAccessService,
    private val templates: ScreeningTemplateRepository,
    private val questions: ScreeningQuestionRepository,
    private val choices: ScreeningChoiceRepository,
    private val texts: ScreeningCatalogTextRepository,
    private val rules: ScreeningRuleSetRepository,
    private val triggers: ScreeningRuleTriggerRepository,
    private val sessions: ScreeningSessionRepository,
    private val results: ScreeningResultRepository,
) {
    @Transactional(readOnly = true)
    fun list(jwt: Jwt): List<ScreeningTemplateAdminResponse> {
        platform.requirePlatformAdmin(jwt)
        return templates.findAllByOrderByMinAgeMonthsAscMaxAgeMonthsAscCodeAsc().map(::response)
    }

    @Transactional(readOnly = true)
    fun get(jwt: Jwt, templateId: UUID): ScreeningTemplateAdminResponse {
        platform.requirePlatformAdmin(jwt)
        return response(templates.findById(templateId).orElseThrow { IllegalArgumentException("Screening template was not found") })
    }

    @Transactional
    fun create(jwt: Jwt, request: ScreeningTemplateDefinitionRequest): ScreeningTemplateAdminResponse {
        val admin = platform.requirePlatformAdmin(jwt)
        validateRequest(request).getOrThrow()
        require(templates.findByCodeAndVersion(request.code.trim(), request.version) == null) { "Screening template code/version already exists" }
        val now = Instant.now()
        val ruleSet = rules.save(
            ScreeningRuleSet(code = "${request.code.trim()}-rules", version = request.ruleVersion, status = ScreeningRuleSetStatus.DRAFT, provenance = ScreeningCatalogProvenance.MANUAL, checksum = request.checksum.trim(), createdByUserId = admin.id, createdAt = now, updatedAt = now),
        )
        val template = templates.save(
            ScreeningTemplate(code = request.code.trim(), version = request.version, minAgeMonths = request.minAgeMonths, maxAgeMonths = request.maxAgeMonths, status = ScreeningTemplateStatus.DRAFT, provenance = ScreeningCatalogProvenance.MANUAL, ruleSetId = ruleSet.id, ruleVersion = request.ruleVersion, checksum = request.checksum.trim(), createdByUserId = admin.id, createdAt = now, updatedAt = now),
        )
        replaceChildren(template, ruleSet, request, now)
        return response(template)
    }

    @Transactional
    fun update(jwt: Jwt, templateId: UUID, expectedRevision: Long, request: ScreeningTemplateDefinitionRequest): ScreeningTemplateAdminResponse {
        val admin = platform.requirePlatformAdmin(jwt)
        validateRequest(request).getOrThrow()
        val template = templates.findById(templateId).orElseThrow { IllegalArgumentException("Screening template was not found") }
        check(template.status == ScreeningTemplateStatus.DRAFT) { "Only draft screening templates can be edited" }
        check(template.revision == expectedRevision) { "Screening template revision is stale" }
        val ruleSetId = template.ruleSetId ?: throw IllegalStateException("Screening template has no rule set")
        val ruleSet = rules.findById(ruleSetId).orElseThrow { IllegalStateException("Screening rule set was not found") }
        check(ruleSet.status == ScreeningRuleSetStatus.DRAFT) { "Only draft screening rule sets can be edited" }
        val now = Instant.now()
        template.code = request.code.trim(); template.version = request.version; template.minAgeMonths = request.minAgeMonths; template.maxAgeMonths = request.maxAgeMonths; template.ruleVersion = request.ruleVersion; template.checksum = request.checksum.trim(); template.updatedAt = now; template.createdByUserId = admin.id
        ruleSet.code = "${request.code.trim()}-rules"; ruleSet.version = request.ruleVersion; ruleSet.checksum = request.checksum.trim(); ruleSet.updatedAt = now
        templates.save(template); rules.save(ruleSet)
        replaceChildren(template, ruleSet, request, now)
        return response(template)
    }

    @Transactional(readOnly = true)
    fun validate(jwt: Jwt, templateId: UUID): ScreeningCatalogValidationResponse {
        platform.requirePlatformAdmin(jwt)
        val template = templates.findById(templateId).orElseThrow { IllegalArgumentException("Screening template was not found") }
        val errors = mutableListOf<String>()
        if (template.ruleSetId == null) errors += "Rule set is required"
        val templateQuestions = questions.findAllByTemplateIdOrderByDisplayOrderAsc(template.id)
        if (templateQuestions.isEmpty()) errors += "At least one question is required"
        if (templateQuestions.none { it.required }) errors += "At least one required question is required"
        if (templateQuestions.any { it.reviewStatus != ScreeningReviewStatus.APPROVED }) errors += "All questions must be approved"
        val questionChoices = choices.findAllByQuestionIdIn(templateQuestions.map { it.id })
        if (templateQuestions.any { q -> questionChoices.none { it.questionId == q.id && it.enabled } }) errors += "Every question needs an enabled choice"
        val ruleSet = template.ruleSetId?.let { rules.findById(it).orElse(null) }
        // A draft template is intentionally paired with a draft rule set until
        // the publish transaction promotes both snapshots together. Validation
        // must therefore require presence here, not a published status.
        if (ruleSet == null) errors += "Rule set must be present"
        if (ruleSet?.reviewStatus != ScreeningReviewStatus.APPROVED) errors += "Rule set review must be approved"
        val questionIds = templateQuestions.map { it.id }
        val choiceIds = questionChoices.map { it.id }
        val templateTexts = texts.findAllByResourceTypeAndResourceIdIn(ScreeningCatalogResourceType.TEMPLATE, listOf(template.id))
        val questionTexts = if (questionIds.isEmpty()) emptyList() else texts.findAllByResourceTypeAndResourceIdIn(ScreeningCatalogResourceType.QUESTION, questionIds)
        val choiceTexts = if (choiceIds.isEmpty()) emptyList() else texts.findAllByResourceTypeAndResourceIdIn(ScreeningCatalogResourceType.CHOICE, choiceIds)
        val requiredTextKeys = buildList {
            ScreeningResultMainStatus.entries.forEach { status -> add("result.status.${status.name}.title"); add("result.status.${status.name}.summary"); add("result.status.${status.name}.next_step") }
            ScreeningResultReasonCode.entries.forEach { add("result.reason.${it.name}") }
            add("disclaimer.v1")
        }
        if (ScreeningLocaleCodes.supported.any { locale -> templateTexts.none { it.locale == locale && it.textKey == "disclaimer.v1" } }) errors += "Template disclaimer must be translated for every supported locale"
        if (questionIds.any { id -> ScreeningLocaleCodes.supported.any { locale -> questionTexts.none { it.resourceId == id && it.locale == locale && it.textKey == "question.label" } } }) errors += "Every question must have all supported locale labels"
        if (choiceIds.any { id -> ScreeningLocaleCodes.supported.any { locale -> choiceTexts.none { it.resourceId == id && it.locale == locale && it.textKey == "choice.label" } } }) errors += "Every choice must have all supported locale labels"
        if (ScreeningLocaleCodes.supported.any { locale -> requiredTextKeys.any { key -> templateTexts.none { it.locale == locale && it.textKey == key } } }) errors += "Result narratives must be translated for every supported locale"
        return ScreeningCatalogValidationResponse(errors.isEmpty(), errors)
    }

    @Transactional
    fun publish(jwt: Jwt, templateId: UUID): ScreeningTemplateAdminResponse {
        val admin = platform.requirePlatformAdmin(jwt)
        val validation = validate(jwt, templateId)
        check(validation.valid) { validation.errors.joinToString("; ") }
        val template = templates.findById(templateId).orElseThrow { IllegalArgumentException("Screening template was not found") }
        check(template.status == ScreeningTemplateStatus.DRAFT) { "Only draft screening templates can be published" }
        val ruleSet = template.ruleSetId?.let { rules.findById(it).orElseThrow() } ?: error("Rule set is required")
        val now = Instant.now()
        ruleSet.status = ScreeningRuleSetStatus.PUBLISHED; ruleSet.publishedByUserId = admin.id; ruleSet.publishedAt = now; ruleSet.updatedAt = now
        template.status = ScreeningTemplateStatus.PUBLISHED; template.publishedByUserId = admin.id; template.publishedAt = now; template.updatedAt = now
        rules.save(ruleSet); templates.save(template)
        return response(template)
    }

    @Transactional
    fun review(jwt: Jwt, templateId: UUID, approved: Boolean): ScreeningTemplateAdminResponse {
        val admin = platform.requirePlatformAdmin(jwt)
        val template = templates.findById(templateId).orElseThrow { IllegalArgumentException("Screening template was not found") }
        check(template.status == ScreeningTemplateStatus.DRAFT) { "Only draft screening templates can be reviewed" }
        val reviewStatus = if (approved) ScreeningReviewStatus.APPROVED else ScreeningReviewStatus.REJECTED
        questions.findAllByTemplateIdOrderByDisplayOrderAsc(template.id).forEach { question -> question.reviewStatus = reviewStatus; question.updatedAt = Instant.now(); questions.save(question) }
        template.ruleSetId?.let { ruleId -> rules.findById(ruleId).ifPresent { rule -> rule.reviewStatus = reviewStatus; rule.updatedAt = Instant.now(); rule.createdByUserId = admin.id; rules.save(rule) } }
        return response(template)
    }

    @Transactional
    fun retire(jwt: Jwt, templateId: UUID): ScreeningTemplateAdminResponse {
        platform.requirePlatformAdmin(jwt)
        val template = templates.findById(templateId).orElseThrow { IllegalArgumentException("Screening template was not found") }
        check(template.status == ScreeningTemplateStatus.PUBLISHED) { "Only published screening templates can be retired" }
        val now = Instant.now(); template.status = ScreeningTemplateStatus.RETIRED; template.retiredAt = now; template.updatedAt = now
        template.ruleSetId?.let { rules.findById(it).ifPresent { rule -> rule.status = ScreeningRuleSetStatus.RETIRED; rule.retiredAt = now; rule.updatedAt = now; rules.save(rule) } }
        return response(templates.save(template))
    }

    @Transactional
    fun deleteDraft(jwt: Jwt, templateId: UUID) {
        platform.requirePlatformAdmin(jwt)
        val template = templates.findById(templateId).orElseThrow { IllegalArgumentException("Screening template was not found") }
        check(template.status == ScreeningTemplateStatus.DRAFT) { "Only draft screening templates can be deleted" }
        check(template.provenance == ScreeningCatalogProvenance.MANUAL) { "Seeded screening templates cannot be deleted" }
        check(sessions.findAll().none { it.templateId == template.id } && results.findAll().none { it.templateId == template.id }) { "Screening template is already referenced" }
        val qs = questions.findAllByTemplateIdOrderByDisplayOrderAsc(template.id)
        val oldChoices = qs.map { it.id }.takeIf { it.isNotEmpty() }?.let(choices::findAllByQuestionIdIn).orEmpty()
        deleteTexts(template.id, qs.map { it.id }, oldChoices.map { it.id })
        choices.deleteAll(oldChoices)
        questions.deleteAll(qs)
        val ruleSetId = template.ruleSetId
        templates.delete(template)
        ruleSetId?.let { ruleId -> triggers.deleteAll(triggers.findAllByRuleSetIdOrderByDisplayOrderAsc(ruleId)); rules.deleteById(ruleId) }
    }

    private fun replaceChildren(template: ScreeningTemplate, ruleSet: ScreeningRuleSet, request: ScreeningTemplateDefinitionRequest, now: Instant) {
        val oldQuestions = questions.findAllByTemplateIdOrderByDisplayOrderAsc(template.id)
        val oldChoices = oldQuestions.map { it.id }.takeIf { it.isNotEmpty() }?.let(choices::findAllByQuestionIdIn).orEmpty()
        deleteTexts(template.id, oldQuestions.map { it.id }, oldChoices.map { it.id })
        choices.deleteAll(oldChoices)
        questions.deleteAll(oldQuestions)
        triggers.deleteAll(triggers.findAllByRuleSetIdOrderByDisplayOrderAsc(ruleSet.id))
        request.questions.forEach { q ->
            val question = questions.save(ScreeningQuestion(id = q.id ?: UUID.randomUUID(), templateId = template.id, stableQuestionId = q.stableQuestionId.trim(), domain = q.domain.trim(), subdomain = q.subdomain?.trim(), answerType = q.answerType, required = q.required, needsOpportunity = q.needsOpportunity, informationalOnly = q.informationalOnly, displayOrder = q.displayOrder, minAgeMonths = q.minAgeMonths, maxAgeMonths = q.maxAgeMonths, conditionCode = q.conditionCode?.trim(), observationInstruction = q.observationInstruction?.trim(), sourceVersion = q.sourceVersion?.trim(), reviewStatus = q.reviewStatus, createdAt = now, updatedAt = now))
            q.choices.forEach { c -> choices.save(ScreeningChoice(id = c.id ?: UUID.randomUUID(), questionId = question.id, code = c.code.trim(), displayOrder = c.displayOrder, enabled = c.enabled, createdAt = now, updatedAt = now)) }
        }
        request.texts.forEach { t -> texts.save(ScreeningCatalogText(id = t.id ?: UUID.randomUUID(), resourceType = t.resourceType, resourceId = t.resourceId, locale = t.locale.trim().lowercase(), textKey = t.textKey.trim(), textValue = t.textValue.trim(), createdAt = now, updatedAt = now)) }
        request.ruleTriggers.forEach { t -> triggers.save(ScreeningRuleTrigger(id = t.id ?: UUID.randomUUID(), ruleSetId = ruleSet.id, triggerKind = t.triggerKind, priority = t.priority, stableQuestionId = t.stableQuestionId?.trim(), answerCode = t.answerCode?.trim(), contextCode = t.contextCode?.trim(), outputStatus = t.outputStatus, reasonCode = t.reasonCode, domainCode = t.domainCode?.trim(), enabled = t.enabled, displayOrder = t.displayOrder, createdAt = now, updatedAt = now)) }
    }

    private fun validateRequest(request: ScreeningTemplateDefinitionRequest): Result<Unit> = runCatching {
        require(request.code.trim().isNotBlank() && request.code.length <= 120)
        require(request.version > 0 && request.ruleVersion > 0)
        require(request.minAgeMonths in 0..215 && request.maxAgeMonths in request.minAgeMonths..215)
        require(request.checksum.trim().isNotBlank())
        require(request.questions.map { it.stableQuestionId }.distinct().size == request.questions.size)
        request.questions.forEach { q -> require(q.stableQuestionId.isNotBlank() && q.domain.isNotBlank()); require(q.choices.map { it.code }.distinct().size == q.choices.size); require(q.choices.isNotEmpty()) }
        require(request.texts.map { listOf(it.resourceType, it.resourceId, it.locale, it.textKey) }.distinct().size == request.texts.size)
        require(request.ruleTriggers.all { it.priority >= 0 && (it.outputStatus != null || it.reasonCode != null) })
    }

    private fun deleteTexts(templateId: UUID, questionIds: Collection<UUID>, choiceIds: Collection<UUID>) {
        texts.deleteAll(texts.findAllByResourceTypeAndResourceIdIn(ScreeningCatalogResourceType.TEMPLATE, listOf(templateId)))
        if (questionIds.isNotEmpty()) texts.deleteAll(texts.findAllByResourceTypeAndResourceIdIn(ScreeningCatalogResourceType.QUESTION, questionIds))
        if (choiceIds.isNotEmpty()) texts.deleteAll(texts.findAllByResourceTypeAndResourceIdIn(ScreeningCatalogResourceType.CHOICE, choiceIds))
    }

    private fun response(template: ScreeningTemplate): ScreeningTemplateAdminResponse {
        val qs = questions.findAllByTemplateIdOrderByDisplayOrderAsc(template.id)
        val qIds = qs.map { it.id }
        val ruleSet = template.ruleSetId?.let { rules.findById(it).orElse(null) }
        // Mories Deo Hutapea,S.E.,S.Kom
        val reviewStatuses = qs.map { it.reviewStatus } + listOfNotNull(ruleSet?.reviewStatus)
        val review = reviewStatuses.maxByOrNull { it.ordinal } ?: ScreeningReviewStatus.NOT_REVIEWED
        val allChoiceIds = qIds.takeIf { it.isNotEmpty() }?.let { choices.findAllByQuestionIdIn(it).map { choice -> choice.id } }.orEmpty()
        val catalogTexts = texts.findAllByResourceTypeAndResourceIdIn(ScreeningCatalogResourceType.TEMPLATE, listOf(template.id)) + qIds.takeIf { it.isNotEmpty() }?.let { texts.findAllByResourceTypeAndResourceIdIn(ScreeningCatalogResourceType.QUESTION, it) }.orEmpty() + allChoiceIds.takeIf { it.isNotEmpty() }?.let { texts.findAllByResourceTypeAndResourceIdIn(ScreeningCatalogResourceType.CHOICE, it) }.orEmpty()
        val textResponses = catalogTexts.map { t -> ScreeningCatalogTextResponse(t.id, t.resourceType, t.resourceId, t.locale, t.textKey, t.textValue) }
        return ScreeningTemplateAdminResponse(template.id, template.code, template.version, template.minAgeMonths, template.maxAgeMonths, template.status, template.provenance, template.ruleVersion, ruleSet?.status, review, template.revision, qs.map { q -> ScreeningQuestionAdminResponse(q.id, q.stableQuestionId, q.domain, q.subdomain, q.answerType, q.required, q.needsOpportunity, q.informationalOnly, q.displayOrder, q.minAgeMonths, q.maxAgeMonths, q.conditionCode, q.observationInstruction, q.sourceVersion, q.reviewStatus, choices.findAllByQuestionIdOrderByDisplayOrderAsc(q.id).map { ScreeningChoiceResponse(it.id, it.code, it.displayOrder, it.enabled) }) }, textResponses, ruleSet?.let { triggers.findAllByRuleSetIdOrderByDisplayOrderAsc(it.id).map { t -> ScreeningRuleTriggerResponse(t.id, t.triggerKind, t.priority, t.stableQuestionId, t.answerCode, t.contextCode, t.outputStatus, t.reasonCode, t.domainCode, t.enabled, t.displayOrder) } } ?: emptyList())
    }
}
