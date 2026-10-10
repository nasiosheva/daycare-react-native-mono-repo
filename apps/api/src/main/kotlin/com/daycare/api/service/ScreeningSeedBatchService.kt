package com.daycare.api.service

import com.daycare.api.domain.ScreeningCatalogProvenance
import com.daycare.api.domain.ScreeningCatalogResourceType
import com.daycare.api.domain.ScreeningQuestionAnswerType
import com.daycare.api.domain.ScreeningReviewStatus
import com.daycare.api.domain.ScreeningSeedManifestStatus
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
import com.daycare.api.persistence.ScreeningSeedManifest
import com.daycare.api.persistence.ScreeningSeedManifestRepository
import com.daycare.api.persistence.ScreeningTemplate
import com.daycare.api.persistence.ScreeningTemplateRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

data class ScreeningSeedBatchDefinition(
    val batchId: String,
    val seedVersion: String,
    val checksum: String,
    val appliedBy: String,
    val templates: List<ScreeningTemplateSeedDefinition>,
    val questions: List<ScreeningQuestionSeedDefinition>,
    val choices: List<ScreeningChoiceSeedDefinition>,
    val texts: List<ScreeningCatalogTextSeedDefinition>,
    val ruleSets: List<ScreeningRuleSetSeedDefinition> = emptyList(),
    val ruleTriggers: List<ScreeningRuleTriggerSeedDefinition> = emptyList(),
)

data class ScreeningRuleSetSeedDefinition(
    val id: UUID,
    val code: String,
    val version: Int,
    val checksum: String,
    val reviewStatus: ScreeningReviewStatus = ScreeningReviewStatus.NOT_REVIEWED,
)

data class ScreeningRuleTriggerSeedDefinition(
    val id: UUID,
    val ruleSetId: UUID,
    val triggerKind: com.daycare.api.domain.ScreeningRuleTriggerKind,
    val priority: Int = 0,
    val stableQuestionId: String? = null,
    val answerCode: String? = null,
    val contextCode: String? = null,
    val outputStatus: com.daycare.api.domain.ScreeningResultMainStatus? = null,
    val reasonCode: com.daycare.api.domain.ScreeningResultReasonCode? = null,
    val domainCode: String? = null,
    val enabled: Boolean = true,
    val displayOrder: Int,
)

data class ScreeningTemplateSeedDefinition(
    val id: UUID,
    val code: String,
    val version: Int,
    val minAgeMonths: Int,
    val maxAgeMonths: Int,
    val ruleVersion: Int,
    val checksum: String,
    val ruleSetId: UUID? = null,
    val copiedFromId: UUID? = null,
)

data class ScreeningQuestionSeedDefinition(
    val id: UUID,
    val templateId: UUID,
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
)

data class ScreeningChoiceSeedDefinition(
    val id: UUID,
    val questionId: UUID,
    val code: String,
    val displayOrder: Int,
    val enabled: Boolean = true,
)

data class ScreeningCatalogTextSeedDefinition(
    val id: UUID,
    val resourceType: ScreeningCatalogResourceType,
    val resourceId: UUID,
    val locale: String,
    val textKey: String,
    val textValue: String,
)

enum class ScreeningSeedBatchApplyStatus { PREVIEW, APPLIED, ALREADY_APPLIED }

data class ScreeningSeedBatchResult(
    val status: ScreeningSeedBatchApplyStatus,
    val batchId: String,
    val templateCount: Int,
    val questionCount: Int,
    val choiceCount: Int,
    val translationCount: Int,
)

@Service
class ScreeningSeedBatchService(
    private val manifests: ScreeningSeedManifestRepository,
    private val templates: ScreeningTemplateRepository,
    private val questions: ScreeningQuestionRepository,
    private val choices: ScreeningChoiceRepository,
    private val texts: ScreeningCatalogTextRepository,
    private val ruleSets: ScreeningRuleSetRepository,
    private val ruleTriggers: ScreeningRuleTriggerRepository,
) {
    @Transactional(readOnly = true)
    fun preview(definition: ScreeningSeedBatchDefinition): ScreeningSeedBatchResult {
        validate(definition)
        val existing = manifests.findByBatchId(definition.batchId)
        if (existing != null) {
            if (existing.checksum != definition.checksum) {
                throw IllegalStateException("Screening seed batch checksum differs for ${definition.batchId}")
            }
            return existingResult(existing)
        }
        validateNoConflicts(definition)
        return result(ScreeningSeedBatchApplyStatus.PREVIEW, definition)
    }

    /**
     * Applies only an explicitly supplied batch. This service is intentionally
     * not an ApplicationRunner: deploy, startup, restart, and rollback never
     * invoke screening seed data implicitly.
     */
    @Transactional
    fun apply(definition: ScreeningSeedBatchDefinition): ScreeningSeedBatchResult {
        validate(definition)
        val existing = manifests.findByBatchIdForUpdate(definition.batchId)
        if (existing != null) {
            if (existing.checksum != definition.checksum) {
                throw IllegalStateException("Screening seed batch checksum differs for ${definition.batchId}")
            }
            return existingResult(existing)
        }
        validateNoConflicts(definition)
        val now = Instant.now()
        val manifest = manifests.saveAndFlush(
            ScreeningSeedManifest(
                batchId = definition.batchId,
                seedVersion = definition.seedVersion,
                checksum = definition.checksum,
                status = ScreeningSeedManifestStatus.APPLIED,
                appliedBy = definition.appliedBy,
                templateCount = definition.templates.size,
                questionCount = definition.questions.size,
                choiceCount = definition.choices.size,
                translationCount = definition.texts.size,
                appliedAt = now,
                createdAt = now,
            ),
        )
        // Mories Deo Hutapea,S.E.,S.Kom
        definition.ruleSets.forEach { seed ->
            ruleSets.saveAndFlush(
                ScreeningRuleSet(id = seed.id, code = seed.code, version = seed.version, status = com.daycare.api.domain.ScreeningRuleSetStatus.DRAFT, provenance = ScreeningCatalogProvenance.SEEDED, checksum = seed.checksum, reviewStatus = seed.reviewStatus, seedManifestId = manifest.id, createdAt = now, updatedAt = now),
            )
        }
        definition.templates.forEach { seed ->
            templates.save(
                ScreeningTemplate(
                    id = seed.id,
                    code = seed.code,
                    version = seed.version,
                    minAgeMonths = seed.minAgeMonths,
                    maxAgeMonths = seed.maxAgeMonths,
                    status = ScreeningTemplateStatus.DRAFT,
                    provenance = ScreeningCatalogProvenance.SEEDED,
                    seedManifestId = manifest.id,
                    ruleSetId = seed.ruleSetId,
                    ruleVersion = seed.ruleVersion,
                    checksum = seed.checksum,
                    copiedFromId = seed.copiedFromId,
                    createdAt = now,
                    updatedAt = now,
                ),
            )
        }
        definition.ruleTriggers.forEach { seed ->
            ruleTriggers.save(ScreeningRuleTrigger(id = seed.id, ruleSetId = seed.ruleSetId, triggerKind = seed.triggerKind, priority = seed.priority, stableQuestionId = seed.stableQuestionId, answerCode = seed.answerCode, contextCode = seed.contextCode, outputStatus = seed.outputStatus, reasonCode = seed.reasonCode, domainCode = seed.domainCode, enabled = seed.enabled, displayOrder = seed.displayOrder, createdAt = now, updatedAt = now))
        }
        definition.questions.forEach { seed ->
            questions.save(
                ScreeningQuestion(
                    id = seed.id,
                    templateId = seed.templateId,
                    stableQuestionId = seed.stableQuestionId,
                    domain = seed.domain,
                    subdomain = seed.subdomain,
                    answerType = seed.answerType,
                    required = seed.required,
                    needsOpportunity = seed.needsOpportunity,
                    informationalOnly = seed.informationalOnly,
                    displayOrder = seed.displayOrder,
                    minAgeMonths = seed.minAgeMonths,
                    maxAgeMonths = seed.maxAgeMonths,
                    conditionCode = seed.conditionCode,
                    observationInstruction = seed.observationInstruction,
                    sourceVersion = seed.sourceVersion,
                    reviewStatus = seed.reviewStatus,
                    seedManifestId = manifest.id,
                    createdAt = now,
                    updatedAt = now,
                ),
            )
        }
        definition.choices.forEach { seed ->
            choices.save(
                ScreeningChoice(
                    id = seed.id,
                    questionId = seed.questionId,
                    code = seed.code,
                    displayOrder = seed.displayOrder,
                    enabled = seed.enabled,
                    seedManifestId = manifest.id,
                    createdAt = now,
                    updatedAt = now,
                ),
            )
        }
        definition.texts.forEach { seed ->
            texts.save(
                ScreeningCatalogText(
                    id = seed.id,
                    resourceType = seed.resourceType,
                    resourceId = seed.resourceId,
                    locale = seed.locale,
                    textKey = seed.textKey,
                    textValue = seed.textValue,
                    seedManifestId = manifest.id,
                    createdAt = now,
                    updatedAt = now,
                ),
            )
        }
        return result(ScreeningSeedBatchApplyStatus.APPLIED, definition)
    }

    private fun validate(definition: ScreeningSeedBatchDefinition) {
        require(definition.batchId.isNotBlank()) { "Screening seed batchId is required" }
        require(definition.seedVersion.isNotBlank()) { "Screening seed seedVersion is required" }
        require(definition.checksum.isNotBlank()) { "Screening seed checksum is required" }
        require(definition.appliedBy.isNotBlank()) { "Screening seed appliedBy is required" }
        require(definition.templates.isNotEmpty()) { "Screening seed must contain at least one template" }
        require(definition.templates.map { it.id }.distinct().size == definition.templates.size) { "Screening seed contains duplicate template IDs" }
        require(definition.templates.map { it.code to it.version }.distinct().size == definition.templates.size) { "Screening seed contains duplicate template code/version" }
        require(definition.questions.map { it.id }.distinct().size == definition.questions.size) { "Screening seed contains duplicate question IDs" }
        require(definition.questions.map { it.templateId to it.stableQuestionId }.distinct().size == definition.questions.size) { "Screening seed contains duplicate stable question IDs" }
        require(definition.choices.map { it.id }.distinct().size == definition.choices.size) { "Screening seed contains duplicate choice IDs" }
        require(definition.texts.map { listOf(it.resourceType, it.resourceId, it.locale, it.textKey) }.distinct().size == definition.texts.size) { "Screening seed contains duplicate translations" }
        val templateIds = definition.templates.map { it.id }.toSet()
        val ruleSetIds = definition.ruleSets.map { it.id }.toSet()
        require(definition.templates.all { it.ruleSetId == null || it.ruleSetId in ruleSetIds }) { "Screening seed template references unknown rule set" }
        require(definition.ruleSets.map { it.id }.distinct().size == definition.ruleSets.size) { "Screening seed contains duplicate rule set IDs" }
        require(definition.ruleTriggers.all { it.ruleSetId in ruleSetIds && it.priority >= 0 && (it.outputStatus != null || it.reasonCode != null) }) { "Screening seed contains invalid rule trigger" }
        require(definition.questions.all { it.templateId in templateIds }) { "Screening seed question references unknown template" }
        val questionIds = definition.questions.map { it.id }.toSet()
        require(definition.choices.all { it.questionId in questionIds }) { "Screening seed choice references unknown question" }
        require(definition.templates.all { it.code.isNotBlank() && it.version > 0 && it.minAgeMonths >= 0 && it.maxAgeMonths >= it.minAgeMonths }) { "Screening seed contains invalid template metadata or age range" }
        require(definition.questions.all { it.stableQuestionId.isNotBlank() && it.domain.isNotBlank() && it.displayOrder >= 0 && (it.minAgeMonths == null || it.maxAgeMonths == null || it.maxAgeMonths >= it.minAgeMonths) }) { "Screening seed contains invalid question metadata or age range" }
        require(definition.choices.all { it.code.isNotBlank() && it.displayOrder >= 0 }) { "Screening seed contains invalid choice metadata" }
        val resourceIds = mapOf(
            ScreeningCatalogResourceType.TEMPLATE to templateIds,
            ScreeningCatalogResourceType.QUESTION to questionIds,
            ScreeningCatalogResourceType.CHOICE to definition.choices.map { it.id }.toSet(),
        )
        require(definition.texts.all { it.locale.isNotBlank() && it.textKey.isNotBlank() && it.textValue.isNotBlank() && it.resourceId in (resourceIds[it.resourceType] ?: emptySet()) }) { "Screening seed translation references an unknown catalog record" }
    }

    private fun validateNoConflicts(definition: ScreeningSeedBatchDefinition) {
        definition.templates.forEach { seed ->
            val existing = templates.findByCodeAndVersion(seed.code, seed.version)
            require(existing == null) { "Screening template ${seed.code} v${seed.version} already exists" }
        }
    }

    private fun existingResult(manifest: ScreeningSeedManifest): ScreeningSeedBatchResult {
        val actualTemplateCount = templates.findAllBySeedManifestId(manifest.id).size
        val actualQuestionCount = questions.findAllBySeedManifestId(manifest.id).size
        val actualChoiceCount = choices.findAllBySeedManifestId(manifest.id).size
        val actualTranslationCount = texts.findAllBySeedManifestId(manifest.id).size
        check(actualTemplateCount == manifest.templateCount && actualQuestionCount == manifest.questionCount && actualChoiceCount == manifest.choiceCount && actualTranslationCount == manifest.translationCount) {
            "Screening seed manifest ${manifest.batchId} does not match its catalog contents"
        }
        return ScreeningSeedBatchResult(
            status = ScreeningSeedBatchApplyStatus.ALREADY_APPLIED,
            batchId = manifest.batchId,
            templateCount = manifest.templateCount,
            questionCount = manifest.questionCount,
            choiceCount = manifest.choiceCount,
            translationCount = manifest.translationCount,
        )
    }

    private fun result(status: ScreeningSeedBatchApplyStatus, definition: ScreeningSeedBatchDefinition) = ScreeningSeedBatchResult(
        status = status,
        batchId = definition.batchId,
        templateCount = definition.templates.size,
        questionCount = definition.questions.size,
        choiceCount = definition.choices.size,
        translationCount = definition.texts.size,
    )
}
