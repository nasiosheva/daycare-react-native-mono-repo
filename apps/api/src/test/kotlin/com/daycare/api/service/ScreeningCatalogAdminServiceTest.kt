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
import com.daycare.api.persistence.ScreeningResultRepository
import com.daycare.api.persistence.ScreeningRuleSet
import com.daycare.api.persistence.ScreeningRuleSetRepository
import com.daycare.api.persistence.ScreeningRuleTriggerRepository
import com.daycare.api.persistence.ScreeningSessionRepository
import com.daycare.api.persistence.ScreeningTemplate
import com.daycare.api.persistence.ScreeningTemplateRepository
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional
import java.util.UUID

class ScreeningCatalogAdminServiceTest {
    private val platform = mock(PlatformAccessService::class.java)
    private val templates = mock(ScreeningTemplateRepository::class.java)
    private val questions = mock(ScreeningQuestionRepository::class.java)
    private val choices = mock(ScreeningChoiceRepository::class.java)
    private val texts = mock(ScreeningCatalogTextRepository::class.java)
    private val rules = mock(ScreeningRuleSetRepository::class.java)
    private val triggers = mock(ScreeningRuleTriggerRepository::class.java)
    private val sessions = mock(ScreeningSessionRepository::class.java)
    private val results = mock(ScreeningResultRepository::class.java)
    private val service = ScreeningCatalogAdminService(platform, templates, questions, choices, texts, rules, triggers, sessions, results)
    private val jwt = mock(Jwt::class.java)
    private val admin = UserProfile(id = UUID.randomUUID(), email = "catalog@example.test")

    @Test
    fun `create writes a complete manual draft and maps its response`() {
        val templateId = UUID.randomUUID()
        val questionId = UUID.randomUUID()
        val choiceId = UUID.randomUUID()
        val ruleId = UUID.randomUUID()
        val request = request(templateId, questionId, choiceId)
        val rule = ScreeningRuleSet(id = ruleId, status = ScreeningRuleSetStatus.DRAFT)
        val template = ScreeningTemplate(id = templateId, code = "MANUAL", version = 1, minAgeMonths = 61, maxAgeMonths = 72, ruleSetId = ruleId)
        `when`(platform.requirePlatformAdmin(jwt)).thenReturn(admin)
        `when`(templates.findByCodeAndVersion("MANUAL", 1)).thenReturn(null)
        `when`(rules.save(any(ScreeningRuleSet::class.java))).thenReturn(rule)
        `when`(templates.save(any(ScreeningTemplate::class.java))).thenReturn(template)
        `when`(questions.save(any(ScreeningQuestion::class.java))).thenAnswer { it.arguments[0] }
        `when`(choices.save(any(ScreeningChoice::class.java))).thenAnswer { it.arguments[0] }
        stubChildren(template, rule, questionId, choiceId)

        val response = service.create(jwt, request)

        assertEquals("MANUAL", response.code)
        assertEquals(ScreeningTemplateStatus.DRAFT, response.status)
        assertEquals(1, response.questions.size)
        assertEquals(0, response.ruleTriggers.size)
        verify(questions).save(any(ScreeningQuestion::class.java))
        verify(choices).save(any(ScreeningChoice::class.java))
        verify(texts).save(any(ScreeningCatalogText::class.java))
    }

    @Test
    fun `update replaces draft children and rejects stale or published drafts`() {
        val templateId = UUID.randomUUID()
        val ruleId = UUID.randomUUID()
        val template = ScreeningTemplate(id = templateId, code = "OLD", version = 1, ruleSetId = ruleId, revision = 4)
        val rule = ScreeningRuleSet(id = ruleId, status = ScreeningRuleSetStatus.DRAFT)
        val request = request(templateId, UUID.randomUUID(), UUID.randomUUID())
        `when`(platform.requirePlatformAdmin(jwt)).thenReturn(admin)
        `when`(templates.findById(templateId)).thenReturn(Optional.of(template))
        `when`(rules.findById(ruleId)).thenReturn(Optional.of(rule))
        `when`(templates.save(any(ScreeningTemplate::class.java))).thenAnswer { it.arguments[0] }
        `when`(rules.save(any(ScreeningRuleSet::class.java))).thenAnswer { it.arguments[0] }
        `when`(questions.save(any(ScreeningQuestion::class.java))).thenAnswer { it.arguments[0] }
        `when`(choices.save(any(ScreeningChoice::class.java))).thenAnswer { it.arguments[0] }
        stubChildren(template, rule, request.questions.single().id!!, request.questions.single().choices.single().id!!)

        val response = service.update(jwt, templateId, 4, request)

        assertEquals("MANUAL", response.code)
        assertEquals("MANUAL", template.code)
        assertThrows(IllegalStateException::class.java) { service.update(jwt, templateId, 3, request) }
        template.status = ScreeningTemplateStatus.PUBLISHED
        assertThrows(IllegalStateException::class.java) { service.update(jwt, templateId, 5, request) }
    }

    @Test
    fun `validate reports every missing catalog requirement and accepts a complete catalog`() {
        val templateId = UUID.randomUUID()
        val questionId = UUID.randomUUID()
        val choiceId = UUID.randomUUID()
        val ruleId = UUID.randomUUID()
        val template = ScreeningTemplate(id = templateId, ruleSetId = ruleId)
        val question = ScreeningQuestion(id = questionId, templateId = templateId, reviewStatus = ScreeningReviewStatus.NOT_REVIEWED)
        val choice = ScreeningChoice(id = choiceId, questionId = questionId, enabled = false)
        val draftRule = ScreeningRuleSet(id = ruleId, status = ScreeningRuleSetStatus.DRAFT, reviewStatus = ScreeningReviewStatus.NOT_REVIEWED)
        `when`(platform.requirePlatformAdmin(jwt)).thenReturn(admin)
        `when`(templates.findById(templateId)).thenReturn(Optional.of(template))
        `when`(questions.findAllByTemplateIdOrderByDisplayOrderAsc(templateId)).thenReturn(listOf(question))
        `when`(choices.findAllByQuestionIdIn(listOf(questionId))).thenReturn(listOf(choice))
        `when`(rules.findById(ruleId)).thenReturn(Optional.of(draftRule))
        `when`(texts.findAllByResourceTypeAndResourceIdIn(ScreeningCatalogResourceType.TEMPLATE, listOf(templateId))).thenReturn(emptyList())
        `when`(texts.findAllByResourceTypeAndResourceIdIn(ScreeningCatalogResourceType.QUESTION, listOf(questionId))).thenReturn(emptyList())
        `when`(texts.findAllByResourceTypeAndResourceIdIn(ScreeningCatalogResourceType.CHOICE, listOf(choiceId))).thenReturn(emptyList())

        val invalid = service.validate(jwt, templateId)
        assertFalse(invalid.valid)
        assertTrue(invalid.errors.size >= 5)

        question.reviewStatus = ScreeningReviewStatus.APPROVED
        choice.enabled = true
        draftRule.status = ScreeningRuleSetStatus.PUBLISHED
        draftRule.reviewStatus = ScreeningReviewStatus.APPROVED
        `when`(texts.findAllByResourceTypeAndResourceIdIn(ScreeningCatalogResourceType.TEMPLATE, listOf(templateId))).thenReturn(templateTexts(templateId))
        `when`(texts.findAllByResourceTypeAndResourceIdIn(ScreeningCatalogResourceType.QUESTION, listOf(questionId))).thenReturn(questionTexts(questionId))
        `when`(texts.findAllByResourceTypeAndResourceIdIn(ScreeningCatalogResourceType.CHOICE, listOf(choiceId))).thenReturn(choiceTexts(choiceId))

        val valid = service.validate(jwt, templateId)
        assertTrue(valid.valid, valid.errors.joinToString())
    }

    @Test
    fun `review supports approval and rejection and retire closes a published version`() {
        val templateId = UUID.randomUUID()
        val ruleId = UUID.randomUUID()
        val template = ScreeningTemplate(id = templateId, ruleSetId = ruleId)
        val question = ScreeningQuestion(id = UUID.randomUUID(), templateId = templateId)
        val rule = ScreeningRuleSet(id = ruleId, status = ScreeningRuleSetStatus.PUBLISHED)
        `when`(platform.requirePlatformAdmin(jwt)).thenReturn(admin)
        `when`(templates.findById(templateId)).thenReturn(Optional.of(template))
        `when`(questions.findAllByTemplateIdOrderByDisplayOrderAsc(templateId)).thenReturn(listOf(question))
        `when`(questions.save(any(ScreeningQuestion::class.java))).thenAnswer { it.arguments[0] }
        `when`(rules.findById(ruleId)).thenReturn(Optional.of(rule))
        `when`(rules.save(any(ScreeningRuleSet::class.java))).thenAnswer { it.arguments[0] }
        `when`(templates.save(any(ScreeningTemplate::class.java))).thenAnswer { it.arguments[0] }
        stubChildren(template, rule, question.id, UUID.randomUUID())
        `when`(questions.findAllByTemplateIdOrderByDisplayOrderAsc(templateId)).thenReturn(listOf(question))

        service.review(jwt, templateId, approved = true)
        assertEquals(ScreeningReviewStatus.APPROVED, question.reviewStatus)
        service.review(jwt, templateId, approved = false)
        assertEquals(ScreeningReviewStatus.REJECTED, question.reviewStatus)

        template.status = ScreeningTemplateStatus.PUBLISHED
        val retired = service.retire(jwt, templateId)
        assertEquals(ScreeningTemplateStatus.RETIRED, retired.status)
        assertEquals(ScreeningRuleSetStatus.RETIRED, rule.status)
    }

    @Test
    fun `delete removes only unreferenced manual drafts and guards other lifecycle states`() {
        val templateId = UUID.randomUUID()
        val ruleId = UUID.randomUUID()
        val questionId = UUID.randomUUID()
        val choiceId = UUID.randomUUID()
        val template = ScreeningTemplate(id = templateId, provenance = ScreeningCatalogProvenance.MANUAL, ruleSetId = ruleId)
        val question = ScreeningQuestion(id = questionId, templateId = templateId)
        val choice = ScreeningChoice(id = choiceId, questionId = questionId)
        `when`(platform.requirePlatformAdmin(jwt)).thenReturn(admin)
        `when`(templates.findById(templateId)).thenReturn(Optional.of(template))
        `when`(sessions.findAll()).thenReturn(emptyList())
        `when`(results.findAll()).thenReturn(emptyList())
        `when`(questions.findAllByTemplateIdOrderByDisplayOrderAsc(templateId)).thenReturn(listOf(question))
        `when`(choices.findAllByQuestionIdIn(listOf(questionId))).thenReturn(listOf(choice))
        `when`(triggers.findAllByRuleSetIdOrderByDisplayOrderAsc(ruleId)).thenReturn(emptyList())

        service.deleteDraft(jwt, templateId)

        verify(templates).delete(template)
        verify(questions).deleteAll(listOf(question))
        verify(choices).deleteAll(listOf(choice))
        verify(rules).deleteById(ruleId)

        template.status = ScreeningTemplateStatus.PUBLISHED
        assertThrows(IllegalStateException::class.java) { service.deleteDraft(jwt, templateId) }
        template.status = ScreeningTemplateStatus.DRAFT
        template.provenance = ScreeningCatalogProvenance.SEEDED
        assertThrows(IllegalStateException::class.java) { service.deleteDraft(jwt, templateId) }
    }

    @Test
    fun `create rejects malformed requests before touching catalog`() {
        val base = request(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID())
        `when`(platform.requirePlatformAdmin(jwt)).thenReturn(admin)
        val invalid = listOf(
            base.copy(code = " "),
            base.copy(code = "x".repeat(121)),
            base.copy(version = 0),
            base.copy(ruleVersion = 0),
            base.copy(minAgeMonths = -1),
            base.copy(maxAgeMonths = 216),
            base.copy(maxAgeMonths = base.minAgeMonths - 1),
            base.copy(checksum = " "),
            base.copy(questions = listOf(base.questions.single(), base.questions.single())),
            base.copy(questions = listOf(base.questions.single().copy(stableQuestionId = " "))),
            base.copy(questions = listOf(base.questions.single().copy(domain = " "))),
            base.copy(questions = listOf(base.questions.single().copy(choices = emptyList()))),
            base.copy(questions = listOf(base.questions.single().copy(choices = listOf(ScreeningChoiceDefinitionRequest(code = "A", displayOrder = 1), ScreeningChoiceDefinitionRequest(code = "A", displayOrder = 2))))),
            base.copy(texts = listOf(base.texts.single(), base.texts.single())),
            base.copy(ruleTriggers = listOf(base.ruleTriggers.single().copy(priority = -1))),
            base.copy(ruleTriggers = listOf(base.ruleTriggers.single().copy(outputStatus = null, reasonCode = null))),
        )
        invalid.forEach { malformed ->
            assertThrows(IllegalArgumentException::class.java) { service.create(jwt, malformed) }
        }
        `when`(templates.findByCodeAndVersion("MANUAL", 1)).thenReturn(ScreeningTemplate(code = "MANUAL", version = 1))
        assertThrows(IllegalArgumentException::class.java) { service.create(jwt, base) }
    }

    @Test
    fun `publish requires a fully valid draft and promotes both snapshots`() {
        val templateId = UUID.randomUUID()
        val questionId = UUID.randomUUID()
        val choiceId = UUID.randomUUID()
        val ruleId = UUID.randomUUID()
        val template = ScreeningTemplate(id = templateId, ruleSetId = ruleId, status = ScreeningTemplateStatus.DRAFT)
        val rule = ScreeningRuleSet(id = ruleId, status = ScreeningRuleSetStatus.DRAFT, reviewStatus = ScreeningReviewStatus.APPROVED)
        val question = ScreeningQuestion(id = questionId, templateId = templateId, required = true, reviewStatus = ScreeningReviewStatus.APPROVED)
        val choice = ScreeningChoice(id = choiceId, questionId = questionId, enabled = true)
        `when`(platform.requirePlatformAdmin(jwt)).thenReturn(admin)
        `when`(templates.findById(templateId)).thenReturn(Optional.of(template))
        `when`(questions.findAllByTemplateIdOrderByDisplayOrderAsc(templateId)).thenReturn(listOf(question))
        `when`(choices.findAllByQuestionIdIn(listOf(questionId))).thenReturn(listOf(choice))
        `when`(rules.findById(ruleId)).thenReturn(Optional.of(rule))
        stubCompleteTexts(templateId, questionId, choiceId)
        `when`(choices.findAllByQuestionIdOrderByDisplayOrderAsc(questionId)).thenReturn(listOf(choice))
        `when`(triggers.findAllByRuleSetIdOrderByDisplayOrderAsc(ruleId)).thenReturn(emptyList())
        `when`(rules.save(any(ScreeningRuleSet::class.java))).thenAnswer { it.arguments[0] }
        `when`(templates.save(any(ScreeningTemplate::class.java))).thenAnswer { it.arguments[0] }

        val response = service.publish(jwt, templateId)
        assertEquals(ScreeningTemplateStatus.PUBLISHED, response.status)
        assertEquals(ScreeningRuleSetStatus.PUBLISHED, rule.status)

        template.status = ScreeningTemplateStatus.PUBLISHED
        assertThrows(IllegalStateException::class.java) { service.publish(jwt, templateId) }
    }

    @Test
    fun `lifecycle operations guard missing resources and referenced drafts`() {
        val id = UUID.randomUUID()
        `when`(platform.requirePlatformAdmin(jwt)).thenReturn(admin)
        `when`(templates.findById(id)).thenReturn(Optional.empty())
        assertThrows(IllegalArgumentException::class.java) { service.get(jwt, id) }
        assertThrows(IllegalArgumentException::class.java) { service.validate(jwt, id) }
        assertThrows(IllegalArgumentException::class.java) { service.publish(jwt, id) }
        assertThrows(IllegalArgumentException::class.java) { service.review(jwt, id, true) }
        assertThrows(IllegalArgumentException::class.java) { service.retire(jwt, id) }
        assertThrows(IllegalArgumentException::class.java) { service.deleteDraft(jwt, id) }

        val template = ScreeningTemplate(id = id, provenance = ScreeningCatalogProvenance.MANUAL, status = ScreeningTemplateStatus.DRAFT)
        `when`(templates.findById(id)).thenReturn(Optional.of(template))
        `when`(sessions.findAll()).thenReturn(listOf(com.daycare.api.persistence.ScreeningSession(templateId = id)))
        `when`(results.findAll()).thenReturn(emptyList())
        assertThrows(IllegalStateException::class.java) { service.deleteDraft(jwt, id) }
        `when`(sessions.findAll()).thenReturn(emptyList())
        `when`(results.findAll()).thenReturn(listOf(com.daycare.api.persistence.ScreeningResult(templateId = id)))
        assertThrows(IllegalStateException::class.java) { service.deleteDraft(jwt, id) }
    }

    @Test
    fun `admin response supports empty question and rule snapshots`() {
        val id = UUID.randomUUID()
        val empty = ScreeningTemplate(id = id, ruleSetId = null)
        `when`(platform.requirePlatformAdmin(jwt)).thenReturn(admin)
        `when`(templates.findAllByOrderByMinAgeMonthsAscMaxAgeMonthsAscCodeAsc()).thenReturn(listOf(empty))
        `when`(templates.findById(id)).thenReturn(Optional.of(empty))
        `when`(questions.findAllByTemplateIdOrderByDisplayOrderAsc(id)).thenReturn(emptyList())
        `when`(texts.findAllByResourceTypeAndResourceIdIn(ScreeningCatalogResourceType.TEMPLATE, listOf(id))).thenReturn(emptyList())

        assertEquals(1, service.list(jwt).size)
        assertEquals(0, service.get(jwt, id).questions.size)
        assertEquals(null, service.get(jwt, id).ruleSetStatus)
    }

    @Test
    fun `validation reports absent rule set and translated catalog gaps`() {
        val id = UUID.randomUUID()
        val template = ScreeningTemplate(id = id, ruleSetId = null)
        val question = ScreeningQuestion(id = UUID.randomUUID(), templateId = id, required = false, reviewStatus = ScreeningReviewStatus.APPROVED)
        `when`(platform.requirePlatformAdmin(jwt)).thenReturn(admin)
        `when`(templates.findById(id)).thenReturn(Optional.of(template))
        `when`(questions.findAllByTemplateIdOrderByDisplayOrderAsc(id)).thenReturn(listOf(question))
        `when`(choices.findAllByQuestionIdIn(listOf(question.id))).thenReturn(emptyList())
        `when`(texts.findAllByResourceTypeAndResourceIdIn(ScreeningCatalogResourceType.TEMPLATE, listOf(id))).thenReturn(emptyList())
        `when`(texts.findAllByResourceTypeAndResourceIdIn(ScreeningCatalogResourceType.QUESTION, listOf(question.id))).thenReturn(emptyList())
        val result = service.validate(jwt, id)
        assertEquals(false, result.valid)
        assertTrue(result.errors.any { it.contains("Rule set") })
        assertTrue(result.errors.any { it.contains("enabled choice") })
    }

    @Test
    fun `publish and review guard missing rule resources while retire accepts template without rule`() {
        val id = UUID.randomUUID()
        val template = ScreeningTemplate(id = id, status = ScreeningTemplateStatus.DRAFT, ruleSetId = UUID.randomUUID())
        `when`(platform.requirePlatformAdmin(jwt)).thenReturn(admin)
        `when`(templates.findById(id)).thenReturn(Optional.of(template))
        `when`(questions.findAllByTemplateIdOrderByDisplayOrderAsc(id)).thenReturn(emptyList())
        `when`(rules.findById(template.ruleSetId!!)).thenReturn(Optional.empty())
        assertEquals(ScreeningTemplateStatus.DRAFT, service.review(jwt, id, true).status)
        assertThrows(IllegalStateException::class.java) { service.publish(jwt, id) }

        template.status = ScreeningTemplateStatus.PUBLISHED
        template.ruleSetId = null
        `when`(templates.save(any(ScreeningTemplate::class.java))).thenAnswer { it.arguments[0] }
        val retired = service.retire(jwt, id)
        assertEquals(ScreeningTemplateStatus.RETIRED, retired.status)
    }

    @Test
    fun `delete draft handles template without questions and rule set`() {
        val id = UUID.randomUUID()
        val template = ScreeningTemplate(id = id, provenance = ScreeningCatalogProvenance.MANUAL, ruleSetId = null)
        `when`(platform.requirePlatformAdmin(jwt)).thenReturn(admin)
        `when`(templates.findById(id)).thenReturn(Optional.of(template))
        `when`(sessions.findAll()).thenReturn(emptyList())
        `when`(results.findAll()).thenReturn(emptyList())
        `when`(questions.findAllByTemplateIdOrderByDisplayOrderAsc(id)).thenReturn(emptyList())
        `when`(texts.findAllByResourceTypeAndResourceIdIn(ScreeningCatalogResourceType.TEMPLATE, listOf(id))).thenReturn(emptyList())
        service.deleteDraft(jwt, id)
        verify(templates).delete(template)
    }

    private fun request(templateId: UUID, questionId: UUID, choiceId: UUID) = ScreeningTemplateDefinitionRequest(
        code = " MANUAL ", version = 1, minAgeMonths = 61, maxAgeMonths = 72, checksum = " checksum ",
        questions = listOf(
            ScreeningQuestionDefinitionRequest(
                id = questionId, stableQuestionId = " Q-1 ", domain = " BK ", subdomain = " sub ",
                answerType = ScreeningQuestionAnswerType.MULTI_CHOICE, required = true, needsOpportunity = true,
                informationalOnly = false, displayOrder = 1, minAgeMonths = 61, maxAgeMonths = 72,
                conditionCode = "CTX", observationInstruction = "Observe", sourceVersion = "source",
                reviewStatus = ScreeningReviewStatus.APPROVED,
                choices = listOf(ScreeningChoiceDefinitionRequest(choiceId, " A ", 1, true)),
            ),
        ),
        texts = listOf(ScreeningCatalogTextDefinitionRequest(resourceType = ScreeningCatalogResourceType.QUESTION, resourceId = questionId, locale = " ID ", textKey = " question.label ", textValue = " Question ")),
        ruleTriggers = listOf(ScreeningRuleTriggerDefinitionRequest(triggerKind = ScreeningRuleTriggerKind.CONTEXT, priority = 1, contextCode = "CTX", reasonCode = ScreeningResultReasonCode.OBSERVASI_BELUM_CUKUP, displayOrder = 1)),
    )

    private fun stubChildren(template: ScreeningTemplate, rule: ScreeningRuleSet, questionId: UUID, choiceId: UUID) {
        val question = ScreeningQuestion(id = questionId, templateId = template.id, stableQuestionId = "Q-1", domain = "BK", reviewStatus = ScreeningReviewStatus.APPROVED)
        val choice = ScreeningChoice(id = choiceId, questionId = questionId, code = "A", displayOrder = 1)
        `when`(questions.findAllByTemplateIdOrderByDisplayOrderAsc(template.id)).thenReturn(listOf(question))
        `when`(choices.findAllByQuestionIdIn(listOf(questionId))).thenReturn(listOf(choice))
        `when`(choices.findAllByQuestionIdOrderByDisplayOrderAsc(questionId)).thenReturn(listOf(choice))
        `when`(rules.findById(rule.id)).thenReturn(Optional.of(rule))
        `when`(triggers.findAllByRuleSetIdOrderByDisplayOrderAsc(rule.id)).thenReturn(emptyList())
        `when`(texts.findAllByResourceTypeAndResourceIdIn(ScreeningCatalogResourceType.TEMPLATE, listOf(template.id))).thenReturn(emptyList())
        `when`(texts.findAllByResourceTypeAndResourceIdIn(ScreeningCatalogResourceType.QUESTION, listOf(questionId))).thenReturn(emptyList())
        `when`(texts.findAllByResourceTypeAndResourceIdIn(ScreeningCatalogResourceType.CHOICE, listOf(choiceId))).thenReturn(emptyList())
    }

    private fun stubCompleteTexts(templateId: UUID, questionId: UUID, choiceId: UUID) {
        `when`(texts.findAllByResourceTypeAndResourceIdIn(ScreeningCatalogResourceType.TEMPLATE, listOf(templateId))).thenReturn(templateTexts(templateId))
        `when`(texts.findAllByResourceTypeAndResourceIdIn(ScreeningCatalogResourceType.QUESTION, listOf(questionId))).thenReturn(questionTexts(questionId))
        `when`(texts.findAllByResourceTypeAndResourceIdIn(ScreeningCatalogResourceType.CHOICE, listOf(choiceId))).thenReturn(choiceTexts(choiceId))
    }

    private fun templateTexts(id: UUID) = ScreeningLocaleCodes.supported.flatMap { locale ->
        buildList {
            add(ScreeningCatalogText(resourceType = ScreeningCatalogResourceType.TEMPLATE, resourceId = id, locale = locale, textKey = "disclaimer.v1", textValue = "Disclaimer"))
            ScreeningResultMainStatus.entries.forEach { status ->
                add(ScreeningCatalogText(resourceType = ScreeningCatalogResourceType.TEMPLATE, resourceId = id, locale = locale, textKey = "result.status.${status.name}.title", textValue = "title"))
                add(ScreeningCatalogText(resourceType = ScreeningCatalogResourceType.TEMPLATE, resourceId = id, locale = locale, textKey = "result.status.${status.name}.summary", textValue = "summary"))
                add(ScreeningCatalogText(resourceType = ScreeningCatalogResourceType.TEMPLATE, resourceId = id, locale = locale, textKey = "result.status.${status.name}.next_step", textValue = "next"))
            }
            ScreeningResultReasonCode.entries.forEach { reason -> add(ScreeningCatalogText(resourceType = ScreeningCatalogResourceType.TEMPLATE, resourceId = id, locale = locale, textKey = "result.reason.${reason.name}", textValue = "reason")) }
        }
    }

    private fun questionTexts(id: UUID) = ScreeningLocaleCodes.supported.map { locale -> ScreeningCatalogText(resourceType = ScreeningCatalogResourceType.QUESTION, resourceId = id, locale = locale, textKey = "question.label", textValue = "question") }
    private fun choiceTexts(id: UUID) = ScreeningLocaleCodes.supported.map { locale -> ScreeningCatalogText(resourceType = ScreeningCatalogResourceType.CHOICE, resourceId = id, locale = locale, textKey = "choice.label", textValue = "choice") }
}
