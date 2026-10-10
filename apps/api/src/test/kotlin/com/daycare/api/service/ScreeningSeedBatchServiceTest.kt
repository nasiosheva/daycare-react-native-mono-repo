package com.daycare.api.service

import com.daycare.api.domain.ScreeningCatalogResourceType
import com.daycare.api.persistence.ScreeningCatalogTextRepository
import com.daycare.api.persistence.ScreeningChoiceRepository
import com.daycare.api.persistence.ScreeningQuestionRepository
import com.daycare.api.persistence.ScreeningSeedManifest
import com.daycare.api.persistence.ScreeningSeedManifestRepository
import com.daycare.api.persistence.ScreeningTemplate
import com.daycare.api.persistence.ScreeningTemplateRepository
import com.daycare.api.persistence.ScreeningRuleSetRepository
import com.daycare.api.persistence.ScreeningRuleTriggerRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.Mockito.inOrder
import java.util.UUID

// Mories Deo Hutapea,S.E.,S.Kom
class ScreeningSeedBatchServiceTest {
    private val manifests = mock(ScreeningSeedManifestRepository::class.java)
    private val templates = mock(ScreeningTemplateRepository::class.java)
    private val questions = mock(ScreeningQuestionRepository::class.java)
    private val choices = mock(ScreeningChoiceRepository::class.java)
    private val texts = mock(ScreeningCatalogTextRepository::class.java)
    private val ruleSets = mock(ScreeningRuleSetRepository::class.java)
    private val ruleTriggers = mock(ScreeningRuleTriggerRepository::class.java)
    private val service = ScreeningSeedBatchService(manifests, templates, questions, choices, texts, ruleSets, ruleTriggers)

    @Test
    fun `preview validates without mutating repositories`() {
        val definition = definition()
        `when`(manifests.findByBatchId(definition.batchId)).thenReturn(null)
        `when`(templates.findByCodeAndVersion("DEV_24_35", 1)).thenReturn(null)

        val result = service.preview(definition)

        assertEquals(ScreeningSeedBatchApplyStatus.PREVIEW, result.status)
        assertEquals(1, result.templateCount)
        verify(manifests).findByBatchId(definition.batchId)
    }

    @Test
    fun `apply writes one manifest and content`() {
        val definition = definition()
        `when`(manifests.findByBatchIdForUpdate(definition.batchId)).thenReturn(null)
        `when`(templates.findByCodeAndVersion("DEV_24_35", 1)).thenReturn(null)
        `when`(manifests.saveAndFlush(any(ScreeningSeedManifest::class.java))).thenAnswer { it.arguments[0] }

        val result = service.apply(definition)

        assertEquals(ScreeningSeedBatchApplyStatus.APPLIED, result.status)
        verify(manifests).saveAndFlush(any(ScreeningSeedManifest::class.java))
        verify(templates).save(any())
        verify(questions).save(any())
        verify(choices).save(any())
        verify(texts).save(any())
    }

    @Test
    fun `apply persists rule sets before templates that reference them`() {
        val base = definition()
        val ruleSetId = UUID.randomUUID()
        val definition = base.copy(
            templates = listOf(base.templates.single().copy(ruleSetId = ruleSetId)),
            ruleSets = listOf(ScreeningRuleSetSeedDefinition(ruleSetId, "DEV-rules", 1, "sha256:rules")),
        )
        `when`(manifests.findByBatchIdForUpdate(definition.batchId)).thenReturn(null)
        `when`(templates.findByCodeAndVersion("DEV_24_35", 1)).thenReturn(null)
        `when`(manifests.saveAndFlush(any(ScreeningSeedManifest::class.java))).thenAnswer { it.arguments[0] }

        service.apply(definition)

        inOrder(ruleSets, templates).apply {
            verify(ruleSets).saveAndFlush(any())
            verify(templates).save(any())
        }
    }

    @Test
    fun `apply returns already applied for same batch and checksum`() {
        val definition = definition()
        val manifest = ScreeningSeedManifest(
                batchId = definition.batchId,
                seedVersion = definition.seedVersion,
                checksum = definition.checksum,
                appliedBy = definition.appliedBy,
                templateCount = 1,
                questionCount = 1,
                choiceCount = 1,
                translationCount = 1,
        )
        `when`(manifests.findByBatchIdForUpdate(definition.batchId)).thenReturn(manifest)
        `when`(templates.findAllBySeedManifestId(manifest.id)).thenReturn(listOf(ScreeningTemplate()))
        `when`(questions.findAllBySeedManifestId(manifest.id)).thenReturn(listOf(com.daycare.api.persistence.ScreeningQuestion()))
        `when`(choices.findAllBySeedManifestId(manifest.id)).thenReturn(listOf(com.daycare.api.persistence.ScreeningChoice()))
        `when`(texts.findAllBySeedManifestId(manifest.id)).thenReturn(listOf(com.daycare.api.persistence.ScreeningCatalogText()))

        val result = service.apply(definition)

        assertEquals(ScreeningSeedBatchApplyStatus.ALREADY_APPLIED, result.status)
        verify(manifests).findByBatchIdForUpdate(definition.batchId)
    }

    @Test
    fun `apply rejects the same batch with a different checksum`() {
        val definition = definition()
        `when`(manifests.findByBatchIdForUpdate(definition.batchId)).thenReturn(
            ScreeningSeedManifest(
                batchId = definition.batchId,
                checksum = "sha256:previous",
                templateCount = 1,
                questionCount = 1,
                choiceCount = 1,
                translationCount = 1,
            ),
        )

        assertThrows(IllegalStateException::class.java) { service.apply(definition) }
    }

    @Test
    fun `apply rejects an existing template code and version`() {
        val definition = definition()
        `when`(manifests.findByBatchIdForUpdate(definition.batchId)).thenReturn(null)
        `when`(templates.findByCodeAndVersion("DEV_24_35", 1)).thenReturn(
            ScreeningTemplate(code = "DEV_24_35", version = 1),
        )

        assertThrows(IllegalArgumentException::class.java) { service.apply(definition) }
    }

    @Test
    fun `preview rejects incomplete manifest metadata`() {
        val base = definition()
        listOf(
            base.copy(batchId = ""),
            base.copy(seedVersion = ""),
            base.copy(checksum = ""),
            base.copy(appliedBy = ""),
            base.copy(templates = emptyList()),
        ).forEach { invalid ->
            assertThrows(IllegalArgumentException::class.java) { service.preview(invalid) }
        }
    }

    @Test
    fun `preview rejects duplicate identifiers and references`() {
        val base = definition()
        val template = base.templates.single()
        val question = base.questions.single()
        val choice = base.choices.single()
        val text = base.texts.single()
        val duplicateTemplateId = template.copy(code = "DEV_24_36")
        val duplicateQuestionId = question.copy(stableQuestionId = "B24-BK2")
        val duplicateChoiceId = choice.copy(code = "TIDAK")
        val duplicateText = text.copy(textValue = "Duplikat")

        listOf(
            base.copy(templates = listOf(template, template)),
            base.copy(templates = listOf(template, duplicateTemplateId)),
            base.copy(questions = listOf(question, question)),
            base.copy(questions = listOf(question, duplicateQuestionId.copy(templateId = template.id))),
            base.copy(choices = listOf(choice, choice)),
            base.copy(choices = listOf(choice, duplicateChoiceId.copy(questionId = question.id))),
            base.copy(texts = listOf(text, duplicateText)),
        ).forEach { invalid ->
            assertThrows(IllegalArgumentException::class.java) { service.preview(invalid) }
        }
    }

    @Test
    fun `preview rejects invalid rule and catalog relationships`() {
        val base = definition()
        val template = base.templates.single()
        val question = base.questions.single()
        val choice = base.choices.single()
        val ruleSetId = UUID.randomUUID()

        val unknownRuleSetTemplate = template.copy(ruleSetId = UUID.randomUUID())
        val duplicateRuleSet = ScreeningRuleSetSeedDefinition(ruleSetId, "RULES", 1, "sha256:rules")
        val invalidTriggers = listOf(
            ScreeningRuleTriggerSeedDefinition(UUID.randomUUID(), UUID.randomUUID(), com.daycare.api.domain.ScreeningRuleTriggerKind.ANSWER, outputStatus = com.daycare.api.domain.ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN, displayOrder = 1),
            ScreeningRuleTriggerSeedDefinition(UUID.randomUUID(), ruleSetId, com.daycare.api.domain.ScreeningRuleTriggerKind.ANSWER, priority = -1, answerCode = "YA_SUDAH", outputStatus = com.daycare.api.domain.ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN, displayOrder = 2),
            ScreeningRuleTriggerSeedDefinition(UUID.randomUUID(), ruleSetId, com.daycare.api.domain.ScreeningRuleTriggerKind.ANSWER, stableQuestionId = "Q1", answerCode = "YA_SUDAH", displayOrder = 3),
        )
        listOf(
            base.copy(templates = listOf(unknownRuleSetTemplate)),
            base.copy(ruleSets = listOf(duplicateRuleSet, duplicateRuleSet)),
            base.copy(ruleSets = listOf(duplicateRuleSet), ruleTriggers = listOf(invalidTriggers[0])),
            base.copy(ruleSets = listOf(duplicateRuleSet), ruleTriggers = listOf(invalidTriggers[1])),
            base.copy(ruleSets = listOf(duplicateRuleSet), ruleTriggers = listOf(invalidTriggers[2])),
            base.copy(questions = listOf(question.copy(templateId = UUID.randomUUID()))),
            base.copy(choices = listOf(choice.copy(questionId = UUID.randomUUID()))),
        ).forEach { invalid ->
            assertThrows(IllegalArgumentException::class.java) { service.preview(invalid) }
        }
    }

    @Test
    fun `preview rejects invalid metadata age and translations`() {
        val base = definition()
        val template = base.templates.single()
        val question = base.questions.single()
        val choice = base.choices.single()
        val invalidTemplates = listOf(
            template.copy(code = ""),
            template.copy(version = 0),
            template.copy(minAgeMonths = -1),
            template.copy(maxAgeMonths = template.minAgeMonths - 1),
        )
        invalidTemplates.forEach { invalid ->
            assertThrows(IllegalArgumentException::class.java) { service.preview(base.copy(templates = listOf(invalid), questions = base.questions.map { it.copy(templateId = invalid.id) })) }
        }
        listOf(
            question.copy(stableQuestionId = ""),
            question.copy(domain = ""),
            question.copy(displayOrder = -1),
            question.copy(minAgeMonths = 10, maxAgeMonths = 9),
        ).forEach { invalid ->
            assertThrows(IllegalArgumentException::class.java) { service.preview(base.copy(questions = listOf(invalid))) }
        }
        listOf(choice.copy(code = ""), choice.copy(displayOrder = -1)).forEach { invalid ->
            assertThrows(IllegalArgumentException::class.java) { service.preview(base.copy(choices = listOf(invalid))) }
        }
        val invalidTexts = listOf(
            base.texts.single().copy(locale = ""),
            base.texts.single().copy(textKey = ""),
            base.texts.single().copy(textValue = ""),
            base.texts.single().copy(resourceId = UUID.randomUUID()),
        )
        invalidTexts.forEach { invalid ->
            assertThrows(IllegalArgumentException::class.java) { service.preview(base.copy(texts = listOf(invalid))) }
        }
    }

    @Test
    fun `preview returns existing manifest only when catalog counts match`() {
        val definition = definition()
        val manifest = ScreeningSeedManifest(
            id = UUID.randomUUID(),
            batchId = definition.batchId,
            checksum = definition.checksum,
            templateCount = 1,
            questionCount = 1,
            choiceCount = 1,
            translationCount = 1,
        )
        `when`(manifests.findByBatchId(definition.batchId)).thenReturn(manifest)
        `when`(templates.findAllBySeedManifestId(manifest.id)).thenReturn(listOf(ScreeningTemplate()))
        `when`(questions.findAllBySeedManifestId(manifest.id)).thenReturn(listOf(com.daycare.api.persistence.ScreeningQuestion()))
        `when`(choices.findAllBySeedManifestId(manifest.id)).thenReturn(listOf(com.daycare.api.persistence.ScreeningChoice()))
        `when`(texts.findAllBySeedManifestId(manifest.id)).thenReturn(listOf(com.daycare.api.persistence.ScreeningCatalogText()))

        assertEquals(ScreeningSeedBatchApplyStatus.ALREADY_APPLIED, service.preview(definition).status)

        `when`(texts.findAllBySeedManifestId(manifest.id)).thenReturn(emptyList())
        assertThrows(IllegalStateException::class.java) { service.preview(definition) }
    }

    private fun definition(): ScreeningSeedBatchDefinition {
        val templateId = UUID.randomUUID()
        val questionId = UUID.randomUUID()
        return ScreeningSeedBatchDefinition(
            batchId = "screening-v1-2026-10-09",
            seedVersion = "v1",
            checksum = "sha256:test",
            appliedBy = "test",
            templates = listOf(
                ScreeningTemplateSeedDefinition(
                    id = templateId,
                    code = "DEV_24_35",
                    version = 1,
                    minAgeMonths = 24,
                    maxAgeMonths = 35,
                    ruleVersion = 1,
                    checksum = "sha256:template",
                ),
            ),
            questions = listOf(
                ScreeningQuestionSeedDefinition(
                    id = questionId,
                    templateId = templateId,
                    stableQuestionId = "B24-BK1",
                    domain = "BK",
                    displayOrder = 1,
                ),
            ),
            choices = listOf(
                ScreeningChoiceSeedDefinition(
                    id = UUID.randomUUID(),
                    questionId = questionId,
                    code = "YA_SUDAH",
                    displayOrder = 1,
                ),
            ),
            texts = listOf(
                ScreeningCatalogTextSeedDefinition(
                    id = UUID.randomUUID(),
                    resourceType = ScreeningCatalogResourceType.QUESTION,
                    resourceId = questionId,
                    locale = "id",
                    textKey = "label",
                    textValue = "Contoh",
                ),
            ),
        )
    }
}
