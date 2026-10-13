package com.daycare.api.service

import com.daycare.api.domain.RegistrationRole
import com.daycare.api.domain.ScreeningCatalogResourceType
import com.daycare.api.domain.ScreeningReviewStatus
import com.daycare.api.domain.ScreeningResultMainStatus
import com.daycare.api.domain.ScreeningSessionStatus
import com.daycare.api.domain.ScreeningRuleSetStatus
import com.daycare.api.domain.ScreeningTemplateStatus
import com.daycare.api.persistence.ScreeningAnswer
import com.daycare.api.persistence.ScreeningAnswerRepository
import com.daycare.api.persistence.ScreeningCatalogText
import com.daycare.api.persistence.ScreeningCatalogTextRepository
import com.daycare.api.persistence.ScreeningChoice
import com.daycare.api.persistence.ScreeningChoiceRepository
import com.daycare.api.persistence.ScreeningQuestion
import com.daycare.api.persistence.ScreeningQuestionRepository
import com.daycare.api.persistence.ScreeningResult
import com.daycare.api.persistence.ScreeningResultDomain
import com.daycare.api.persistence.ScreeningResultDomainRepository
import com.daycare.api.persistence.ScreeningResultItem
import com.daycare.api.persistence.ScreeningResultItemRepository
import com.daycare.api.persistence.ScreeningResultReason
import com.daycare.api.persistence.ScreeningResultReasonRepository
import com.daycare.api.persistence.ScreeningResultRepository
import com.daycare.api.persistence.ScreeningRuleSet
import com.daycare.api.persistence.ScreeningRuleTrigger
import com.daycare.api.persistence.ScreeningRuleSetRepository
import com.daycare.api.persistence.ScreeningRuleTriggerRepository
import com.daycare.api.persistence.ScreeningSession
import com.daycare.api.persistence.ScreeningSessionRepository
import com.daycare.api.persistence.ScreeningTemplate
import com.daycare.api.persistence.ScreeningTemplateRepository
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertInstanceOf
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import java.time.Instant
import java.time.LocalDate
import java.util.Optional
import java.util.UUID

class ScreeningCompletionServiceTest {
    private val identity = mock(IdentityService::class.java)
    private val sessions = mock(ScreeningSessionRepository::class.java)
    private val templates = mock(ScreeningTemplateRepository::class.java)
    private val answers = mock(ScreeningAnswerRepository::class.java)
    private val questions = mock(ScreeningQuestionRepository::class.java)
    private val choices = mock(ScreeningChoiceRepository::class.java)
    private val rules = mock(ScreeningRuleSetRepository::class.java)
    private val triggers = mock(ScreeningRuleTriggerRepository::class.java)
    private val catalogTexts = mock(ScreeningCatalogTextRepository::class.java)
    private val results = mock(ScreeningResultRepository::class.java)
    private val resultDomains = mock(ScreeningResultDomainRepository::class.java)
    private val resultReasons = mock(ScreeningResultReasonRepository::class.java)
    private val resultItems = mock(ScreeningResultItemRepository::class.java)
    private val evaluator = ScreeningEvaluationService()
    private val service = ScreeningCompletionService(
        identity,
        sessions,
        templates,
        answers,
        questions,
        choices,
        rules,
        triggers,
        catalogTexts,
        results,
        resultDomains,
        resultReasons,
        resultItems,
        evaluator,
    )
    private val parent = UserProfile(id = UUID.randomUUID(), registrationRole = RegistrationRole.PARENT)
    private val jwt = mock(org.springframework.security.oauth2.jwt.Jwt::class.java)

    private fun invokePrivate(name: String, vararg args: Any?): Any? = invokePrivate(service, name, *args)

    @Test
    fun `completion text and writable helpers cover duplicate missing blank and terminal branches`() {
        val first = UUID.randomUUID()
        val second = UUID.randomUUID()
        val validRows = listOf(
            text(ScreeningCatalogResourceType.QUESTION, first, "question.label", " Pertanyaan "),
            text(ScreeningCatalogResourceType.QUESTION, second, "question.label", "Jawaban"),
        )
        `when`(catalogTexts.findAllByResourceTypeAndResourceIdInAndLocale(ScreeningCatalogResourceType.QUESTION, listOf(first, second), "id")).thenReturn(validRows)
        assertEquals(mapOf(first to "Pertanyaan", second to "Jawaban"), invokePrivate("requireTexts", ScreeningCatalogResourceType.QUESTION, listOf(first, second), "id", "question.label"))
        `when`(catalogTexts.findAllByResourceTypeAndResourceIdInAndLocale(ScreeningCatalogResourceType.QUESTION, listOf(first, second), "id")).thenReturn(validRows + validRows.first())
        assertThrows(IllegalArgumentException::class.java) { invokePrivate("requireTexts", ScreeningCatalogResourceType.QUESTION, listOf(first, second), "id", "question.label") }
        validRows.first().textValue = " "
        `when`(catalogTexts.findAllByResourceTypeAndResourceIdInAndLocale(ScreeningCatalogResourceType.QUESTION, listOf(first, second), "id")).thenReturn(listOf(validRows.first()))
        assertThrows(IllegalStateException::class.java) { invokePrivate("requireTexts", ScreeningCatalogResourceType.QUESTION, listOf(first, second), "id", "question.label") }

        val session = session()
        val narrative = listOf(
            text(ScreeningCatalogResourceType.TEMPLATE, session.templateId, "result.status.KEMAMPUAN_DILAPORKAN_TERLIHAT.title", "Terlihat"),
            text(ScreeningCatalogResourceType.TEMPLATE, session.templateId, "result.status.KEMAMPUAN_DILAPORKAN_TERLIHAT.summary", "Ringkas"),
            text(ScreeningCatalogResourceType.TEMPLATE, session.templateId, "result.status.KEMAMPUAN_DILAPORKAN_TERLIHAT.next_step", "Pantau"),
            text(ScreeningCatalogResourceType.TEMPLATE, session.templateId, "disclaimer.v1", "Bukan diagnosis"),
        )
        `when`(catalogTexts.findAllByResourceTypeAndResourceIdInAndLocale(ScreeningCatalogResourceType.TEMPLATE, listOf(session.templateId), "id")).thenReturn(narrative)
        val prepared = invokePrivate("prepareResultTexts", session, ScreeningResultMainStatus.KEMAMPUAN_DILAPORKAN_TERLIHAT, emptyList<ScreeningEvaluationReason>())
        assertTrue(prepared.toString().contains("Terlihat"))
        `when`(catalogTexts.findAllByResourceTypeAndResourceIdInAndLocale(ScreeningCatalogResourceType.TEMPLATE, listOf(session.templateId), "id")).thenReturn(narrative.dropLast(1))
        assertThrows(IllegalStateException::class.java) { invokePrivate("prepareResultTexts", session, ScreeningResultMainStatus.KEMAMPUAN_DILAPORKAN_TERLIHAT, emptyList<ScreeningEvaluationReason>()) }

        val writable = session()
        invokePrivate("ensureWritable", writable)
        writable.status = ScreeningSessionStatus.COMPLETED
        assertThrows(IllegalStateException::class.java) { invokePrivate("ensureWritable", writable) }
        val expired = session().apply { expiresAt = Instant.now().minusSeconds(1) }
        `when`(sessions.save(expired)).thenReturn(expired)
        assertThrows(IllegalStateException::class.java) { invokePrivate("ensureWritable", expired) }
    }

    @Test
    fun `completion response maps reason items by answer then question and handles expired status`() {
        val session = session().apply { status = ScreeningSessionStatus.EXPIRED }
        `when`(sessions.save(session)).thenReturn(session)
        assertThrows(IllegalStateException::class.java) { invokePrivate("ensureWritable", session) }

        val result = ScreeningResult(sessionId = session.id)
        val questionId = UUID.randomUUID()
        val answerId = UUID.randomUUID()
        val reasonByAnswer = ScreeningResultReason(resultId = result.id, questionId = questionId, answerId = answerId, textSnapshot = "answer")
        val reasonByQuestion = ScreeningResultReason(resultId = result.id, questionId = questionId, answerId = UUID.randomUUID(), textSnapshot = "question")
        val item = ScreeningResultItem(resultId = result.id, questionId = questionId, answerId = answerId, questionTextSnapshot = "Pertanyaan", answerLabelSnapshot = "Ya")
        val fallbackItem = ScreeningResultItem(resultId = result.id, questionId = questionId, answerId = null, questionTextSnapshot = "Pertanyaan 2", answerLabelSnapshot = "Tidak")
        val response = invokePrivate("toResponse", result, emptyList<ScreeningResultDomain>(), listOf(reasonByAnswer, reasonByQuestion), listOf(item, fallbackItem)) as ScreeningResultResponse
        assertEquals("Pertanyaan", response.reasons.first().questionTextSnapshot)
        assertEquals("Pertanyaan", response.reasons.last().questionTextSnapshot)
    }

    @Test
    fun `completion response keeps reason metadata when no result item matches`() {
        val result = ScreeningResult(sessionId = UUID.randomUUID())
        val reason = ScreeningResultReason(
            resultId = result.id,
            questionId = UUID.randomUUID(),
            answerId = UUID.randomUUID(),
            textSnapshot = "Catatan",
        )

        val response = invokePrivate(
            "toResponse",
            result,
            emptyList<ScreeningResultDomain>(),
            listOf(reason),
            emptyList<ScreeningResultItem>(),
        ) as ScreeningResultResponse

        assertEquals(null, response.reasons.single().questionTextSnapshot)
        assertEquals(null, response.reasons.single().answerLabelSnapshot)
    }

    @Test
    fun `complete snapshots reviewed catalog and closes session atomically`() {
        val session = session()
        val template = template(session)
        val ruleSet = ruleSet(template)
        val question = question(template)
        val choice = ScreeningChoice(id = UUID.randomUUID(), questionId = question.id, code = "YA_SUDAH", enabled = true)
        val answer = ScreeningAnswer(sessionId = session.id, questionId = question.id, stableQuestionId = question.stableQuestionId, answerCode = choice.code)
        stubCommon(session, template, ruleSet, question, choice, answer)

        val outcome = service.complete(jwt, session.id)
        val completed = assertInstanceOf(ScreeningCompletionOutcome.Completed::class.java, outcome)

        assertEquals(ScreeningResultMainStatus.KEMAMPUAN_DILAPORKAN_TERLIHAT, completed.result.mainStatus)
        assertEquals("Status terlihat", completed.result.statusTitleSnapshot)
        assertEquals("Disclaimer", completed.result.disclaimerTextSnapshot)
        assertEquals(1, completed.result.items.size)
        assertEquals("Jawaban terlihat", completed.result.items.single().answerLabelSnapshot)
        assertEquals(ScreeningSessionStatus.COMPLETED, session.status)
        assertTrue(session.completedAt != null)
    }

    @Test
    fun `complete returns missing required questions without writing a result`() {
        val session = session()
        val template = template(session)
        val ruleSet = ruleSet(template)
        val question = question(template)
        val choice = ScreeningChoice(id = UUID.randomUUID(), questionId = question.id, code = "YA_SUDAH", enabled = true)
        stubCommon(session, template, ruleSet, question, choice, answer = null)

        val outcome = service.complete(jwt, session.id)
        val incomplete = assertInstanceOf(ScreeningCompletionOutcome.Incomplete::class.java, outcome)

        assertEquals(listOf(question.id), incomplete.missingRequiredQuestionIds)
        assertEquals(ScreeningSessionStatus.IN_PROGRESS, session.status)
        org.mockito.Mockito.verify(results, org.mockito.Mockito.never()).save(any(ScreeningResult::class.java))
    }

    @Test
    fun `complete fails closed when narrative text is missing`() {
        val session = session()
        val template = template(session)
        val ruleSet = ruleSet(template)
        val question = question(template)
        val choice = ScreeningChoice(id = UUID.randomUUID(), questionId = question.id, code = "YA_SUDAH", enabled = true)
        val answer = ScreeningAnswer(sessionId = session.id, questionId = question.id, stableQuestionId = question.stableQuestionId, answerCode = choice.code)
        stubCommon(session, template, ruleSet, question, choice, answer)
        `when`(catalogTexts.findAllByResourceTypeAndResourceIdInAndLocale(ScreeningCatalogResourceType.TEMPLATE, listOf(template.id), "id")).thenReturn(emptyList())

        assertThrows(IllegalStateException::class.java) { service.complete(jwt, session.id) }
        assertEquals(ScreeningSessionStatus.IN_PROGRESS, session.status)
        org.mockito.Mockito.verify(results, org.mockito.Mockito.never()).save(any(ScreeningResult::class.java))
    }

    @Test
    fun `repeating complete returns the owner scoped existing snapshot`() {
        val session = session().apply { status = ScreeningSessionStatus.COMPLETED }
        val existing = ScreeningResult(sessionId = session.id, mainStatus = ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN, statusTitleSnapshot = "Tersimpan")
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(sessions.findByIdAndOwnerUserId(session.id, parent.id)).thenReturn(session)
        `when`(results.findBySessionId(session.id)).thenReturn(existing)
        `when`(resultDomains.findAllByResultIdOrderByDisplayOrderAsc(existing.id)).thenReturn(emptyList())
        `when`(resultReasons.findAllByResultIdOrderByDisplayOrderAsc(existing.id)).thenReturn(emptyList())
        `when`(resultItems.findAllByResultIdOrderByDisplayOrderAsc(existing.id)).thenReturn(emptyList())

        val outcome = service.complete(jwt, session.id)
        val completed = assertInstanceOf(ScreeningCompletionOutcome.Completed::class.java, outcome)

        assertEquals("Tersimpan", completed.result.statusTitleSnapshot)
        org.mockito.Mockito.verify(results, org.mockito.Mockito.never()).save(any(ScreeningResult::class.java))
    }

    @Test
    fun `complete fails closed for invalid catalog snapshots`() {
        val session = session()
        val template = template(session)
        val ruleSet = ruleSet(template)
        val question = question(template)
        val choice = ScreeningChoice(id = UUID.randomUUID(), questionId = question.id, code = "YA_SUDAH", enabled = true)
        val answer = ScreeningAnswer(sessionId = session.id, questionId = question.id, stableQuestionId = question.stableQuestionId, answerCode = choice.code)

        stubCommon(session, template, ruleSet, question, choice, answer)
        `when`(templates.findById(template.id)).thenReturn(Optional.empty())
        assertThrows(IllegalStateException::class.java) { service.complete(jwt, session.id) }

        val statusTemplate = template(session)
        val statusRules = ruleSet(statusTemplate)
        stubCommon(session, statusTemplate, statusRules, question(statusTemplate), choice, answer)
        statusTemplate.status = ScreeningTemplateStatus.DRAFT
        assertThrows(IllegalStateException::class.java) { service.complete(jwt, session.id) }
    }

    @Test
    fun `complete validates template rule and question snapshots`() {
        val session = session()
        val template = template(session)
        val ruleSet = ruleSet(template)
        val question = question(template)
        val choice = ScreeningChoice(id = UUID.randomUUID(), questionId = question.id, code = "YA_SUDAH", enabled = true)
        val answer = ScreeningAnswer(sessionId = session.id, questionId = question.id, stableQuestionId = question.stableQuestionId, answerCode = choice.code)

        stubCommon(session, template, ruleSet, question, choice, answer)
        template.code = "OTHER"
        assertThrows(IllegalStateException::class.java) { service.complete(jwt, session.id) }

        template.code = session.templateCode
        template.ruleSetId = null
        assertThrows(IllegalStateException::class.java) { service.complete(jwt, session.id) }

        template.ruleSetId = ruleSet.id
        template.ruleVersion = 0
        assertThrows(IllegalStateException::class.java) { service.complete(jwt, session.id) }

        template.ruleVersion = 1
        `when`(rules.findById(ruleSet.id)).thenReturn(Optional.empty())
        assertThrows(IllegalStateException::class.java) { service.complete(jwt, session.id) }

        `when`(rules.findById(ruleSet.id)).thenReturn(Optional.of(ruleSet.apply { status = ScreeningRuleSetStatus.DRAFT }))
        assertThrows(IllegalStateException::class.java) { service.complete(jwt, session.id) }
        ruleSet.status = ScreeningRuleSetStatus.PUBLISHED
        ruleSet.version = 2
        assertThrows(IllegalStateException::class.java) { service.complete(jwt, session.id) }
    }

    @Test
    fun `existing sessions can be prepared from retired template and rule snapshots`() {
        val session = session()
        val template = template(session).apply { status = ScreeningTemplateStatus.RETIRED }
        val ruleSet = ruleSet(template).apply { status = ScreeningRuleSetStatus.RETIRED }
        val question = question(template)
        val choice = ScreeningChoice(id = UUID.randomUUID(), questionId = question.id, code = "YA_SUDAH", enabled = true)
        val answer = ScreeningAnswer(sessionId = session.id, questionId = question.id, stableQuestionId = question.stableQuestionId, answerCode = choice.code)
        stubCommon(session, template, ruleSet, question, choice, answer)

        val prepared = invokePrivate("prepare", session)

        assertTrue(prepared != null)
    }

    @Test
    fun `complete validates question answers and enabled choices`() {
        val session = session()
        val template = template(session)
        val ruleSet = ruleSet(template)
        val question = question(template)
        val choice = ScreeningChoice(id = UUID.randomUUID(), questionId = question.id, code = "YA_SUDAH", enabled = true)
        val answer = ScreeningAnswer(sessionId = session.id, questionId = question.id, stableQuestionId = question.stableQuestionId, answerCode = choice.code)
        stubCommon(session, template, ruleSet, question, choice, answer)

        `when`(questions.findAllByTemplateIdOrderByDisplayOrderAsc(template.id)).thenReturn(emptyList())
        assertThrows(IllegalArgumentException::class.java) { service.complete(jwt, session.id) }

        `when`(questions.findAllByTemplateIdOrderByDisplayOrderAsc(template.id)).thenReturn(listOf(question.apply { required = false }))
        assertThrows(IllegalArgumentException::class.java) { service.complete(jwt, session.id) }

        question.required = true
        question.reviewStatus = ScreeningReviewStatus.NOT_REVIEWED
        assertThrows(IllegalArgumentException::class.java) { service.complete(jwt, session.id) }

        question.reviewStatus = ScreeningReviewStatus.APPROVED
        choice.enabled = false
        assertThrows(IllegalArgumentException::class.java) { service.complete(jwt, session.id) }

        choice.enabled = true
        val duplicateAnswer = ScreeningAnswer(sessionId = session.id, questionId = question.id, stableQuestionId = question.stableQuestionId, answerCode = choice.code)
        `when`(answers.findAllBySessionIdOrderByAnsweredAtAscIdAsc(session.id)).thenReturn(listOf(answer, duplicateAnswer))
        assertThrows(IllegalArgumentException::class.java) { service.complete(jwt, session.id) }

        `when`(answers.findAllBySessionIdOrderByAnsweredAtAscIdAsc(session.id)).thenReturn(listOf(ScreeningAnswer(sessionId = session.id, questionId = UUID.randomUUID(), stableQuestionId = "FOREIGN", answerCode = choice.code)))
        assertThrows(IllegalArgumentException::class.java) { service.complete(jwt, session.id) }

        answer.answerCode = "UNAVAILABLE"
        `when`(answers.findAllBySessionIdOrderByAnsweredAtAscIdAsc(session.id)).thenReturn(listOf(answer))
        assertThrows(IllegalArgumentException::class.java) { service.complete(jwt, session.id) }
    }

    @Test
    fun `result requires completed owner scoped session and snapshot`() {
        val session = session()
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(sessions.findByIdAndOwnerUserId(session.id, parent.id)).thenReturn(session)
        assertThrows(IllegalStateException::class.java) { service.result(jwt, session.id) }

        session.status = ScreeningSessionStatus.COMPLETED
        `when`(results.findBySessionId(session.id)).thenReturn(null)
        assertThrows(IllegalStateException::class.java) { service.result(jwt, session.id) }
    }

    @Test
    fun `complete builds domain snapshots for explicit and fallback statuses`() {
        val session = session()
        val template = template(session)
        val ruleSet = ruleSet(template)
        val first = question(template).apply { domain = "BK"; stableQuestionId = "Q1" }
        val second = question(template).apply { id = UUID.randomUUID(); domain = "MK"; stableQuestionId = "Q2"; required = false }
        val firstChoice = ScreeningChoice(id = UUID.randomUUID(), questionId = first.id, code = "YA_SUDAH", displayOrder = 1, enabled = true)
        val secondChoice = ScreeningChoice(id = UUID.randomUUID(), questionId = second.id, code = "KADANG", displayOrder = 1, enabled = true)
        val firstAnswer = ScreeningAnswer(sessionId = session.id, questionId = first.id, stableQuestionId = first.stableQuestionId, answerCode = firstChoice.code)
        val secondAnswer = ScreeningAnswer(sessionId = session.id, questionId = second.id, stableQuestionId = second.stableQuestionId, answerCode = secondChoice.code)
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(sessions.findByIdAndOwnerUserId(session.id, parent.id)).thenReturn(session)
        `when`(templates.findById(template.id)).thenReturn(Optional.of(template))
        `when`(rules.findById(ruleSet.id)).thenReturn(Optional.of(ruleSet))
        `when`(questions.findAllByTemplateIdOrderByDisplayOrderAsc(template.id)).thenReturn(listOf(first, second))
        `when`(choices.findAllByQuestionIdIn(listOf(first.id, second.id))).thenReturn(listOf(firstChoice, secondChoice))
        `when`(answers.findAllBySessionIdOrderByAnsweredAtAscIdAsc(session.id)).thenReturn(listOf(firstAnswer, secondAnswer))
        val trigger = com.daycare.api.persistence.ScreeningRuleTrigger(ruleSetId = ruleSet.id, stableQuestionId = "Q1", answerCode = "YA_SUDAH", outputStatus = ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN, reasonCode = com.daycare.api.domain.ScreeningResultReasonCode.DISKUSIKAN_BUTIR_PERKEMBANGAN)
        `when`(triggers.findAllByRuleSetIdAndEnabledTrueOrderByDisplayOrderAsc(ruleSet.id)).thenReturn(listOf(trigger))
        `when`(catalogTexts.findAllByResourceTypeAndResourceIdInAndLocale(ScreeningCatalogResourceType.QUESTION, listOf(first.id, second.id), "id")).thenReturn(listOf(text(ScreeningCatalogResourceType.QUESTION, first.id, "question.label", "Pertama"), text(ScreeningCatalogResourceType.QUESTION, second.id, "question.label", "Kedua")))
        `when`(catalogTexts.findAllByResourceTypeAndResourceIdInAndLocale(ScreeningCatalogResourceType.CHOICE, listOf(firstChoice.id, secondChoice.id), "id")).thenReturn(listOf(text(ScreeningCatalogResourceType.CHOICE, firstChoice.id, "choice.label", "Ya"), text(ScreeningCatalogResourceType.CHOICE, secondChoice.id, "choice.label", "Kadang")))
        `when`(catalogTexts.findAllByResourceTypeAndResourceIdInAndLocale(ScreeningCatalogResourceType.TEMPLATE, listOf(template.id), "id")).thenReturn(templateTexts(template.id) + listOf(text(ScreeningCatalogResourceType.TEMPLATE, template.id, "result.status.DISKUSIKAN_PERKEMBANGAN.title", "Diskusikan"), text(ScreeningCatalogResourceType.TEMPLATE, template.id, "result.status.DISKUSIKAN_PERKEMBANGAN.summary", "Ringkasan"), text(ScreeningCatalogResourceType.TEMPLATE, template.id, "result.status.DISKUSIKAN_PERKEMBANGAN.next_step", "Langkah"), text(ScreeningCatalogResourceType.TEMPLATE, template.id, "result.reason.DISKUSIKAN_BUTIR_PERKEMBANGAN", "Perlu diskusi")))
        `when`(results.save(any(ScreeningResult::class.java))).thenAnswer { it.arguments[0] }
        val outcome = service.complete(jwt, session.id) as ScreeningCompletionOutcome.Completed
        assertEquals(ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN, outcome.result.mainStatus)
        assertEquals(2, outcome.result.domains.size)
        assertEquals("Ya", outcome.result.items.first().answerLabelSnapshot)
        assertTrue(outcome.result.reasons.any { it.textSnapshot == "Perlu diskusi" })
    }

    @Test
    fun `complete expires sessions and rejects non writable states`() {
        val expired = session().apply { expiresAt = Instant.now().minusSeconds(1) }
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(sessions.findByIdAndOwnerUserId(expired.id, parent.id)).thenReturn(expired)
        `when`(sessions.save(expired)).thenReturn(expired)
        assertThrows(IllegalStateException::class.java) { service.complete(jwt, expired.id) }
        assertEquals(ScreeningSessionStatus.EXPIRED, expired.status)
        val withdrawn = session().apply { status = ScreeningSessionStatus.WITHDRAWN }
        `when`(sessions.findByIdAndOwnerUserId(withdrawn.id, parent.id)).thenReturn(withdrawn)
        assertThrows(IllegalStateException::class.java) { service.complete(jwt, withdrawn.id) }
    }

    @Test
    fun `domain snapshots cover explicit observation discussion and empty domains`() {
        val session = session()
        val template = template(session)
        val ruleSet = ruleSet(template)
        val first = question(template).apply { domain = "BK"; stableQuestionId = "Q1"; required = true }
        val second = question(template).apply { id = UUID.randomUUID(); domain = "MK"; stableQuestionId = "Q2"; required = false }
        val third = question(template).apply { id = UUID.randomUUID(); domain = "SE"; stableQuestionId = "Q3"; required = false }
        val empty = question(template).apply { id = UUID.randomUUID(); domain = "EMPTY"; stableQuestionId = "Q4"; required = false }
        val allSeen = question(template).apply { id = UUID.randomUUID(); domain = "ALL"; stableQuestionId = "Q5"; required = false }
        val unknown = question(template).apply { id = UUID.randomUUID(); domain = "UNKNOWN"; stableQuestionId = "Q6"; required = false }
        val uncertain = question(template).apply { id = UUID.randomUUID(); domain = "UNCERTAIN"; stableQuestionId = "Q7"; required = false }
        val questionsForTemplate = listOf(first, second, third, empty, allSeen, unknown, uncertain)
        val choicesForQuestions = questionsForTemplate.mapIndexed { index, q -> ScreeningChoice(id = UUID.randomUUID(), questionId = q.id, code = listOf("YA_SUDAH", "TIDAK_DIAMATI", "BELUM", "YA_SUDAH", "YA_SUDAH", "OTHER", "TIDAK_YAKIN")[index], enabled = true) }
        val answersForSession = listOf(
            ScreeningAnswer(sessionId = session.id, questionId = first.id, stableQuestionId = first.stableQuestionId, answerCode = "YA_SUDAH"),
            ScreeningAnswer(sessionId = session.id, questionId = second.id, stableQuestionId = second.stableQuestionId, answerCode = "TIDAK_DIAMATI"),
            ScreeningAnswer(sessionId = session.id, questionId = third.id, stableQuestionId = third.stableQuestionId, answerCode = "BELUM"),
            ScreeningAnswer(sessionId = session.id, questionId = allSeen.id, stableQuestionId = allSeen.stableQuestionId, answerCode = "YA_SUDAH"),
            ScreeningAnswer(sessionId = session.id, questionId = unknown.id, stableQuestionId = unknown.stableQuestionId, answerCode = "OTHER"),
            ScreeningAnswer(sessionId = session.id, questionId = uncertain.id, stableQuestionId = uncertain.stableQuestionId, answerCode = "TIDAK_YAKIN"),
        )
        stubCommon(session, template, ruleSet, first, choicesForQuestions.first(), answersForSession.first())
        `when`(questions.findAllByTemplateIdOrderByDisplayOrderAsc(template.id)).thenReturn(questionsForTemplate)
        `when`(choices.findAllByQuestionIdIn(questionsForTemplate.map { it.id })).thenReturn(choicesForQuestions)
        `when`(answers.findAllBySessionIdOrderByAnsweredAtAscIdAsc(session.id)).thenReturn(answersForSession)
        `when`(triggers.findAllByRuleSetIdAndEnabledTrueOrderByDisplayOrderAsc(ruleSet.id)).thenReturn(listOf(ScreeningRuleTrigger(ruleSetId = ruleSet.id, stableQuestionId = "Q1", answerCode = "YA_SUDAH", outputStatus = ScreeningResultMainStatus.SEGERA_DISKUSIKAN, domainCode = "BK")))
        `when`(catalogTexts.findAllByResourceTypeAndResourceIdInAndLocale(ScreeningCatalogResourceType.QUESTION, questionsForTemplate.map { it.id }, "id")).thenReturn(questionsForTemplate.map { text(ScreeningCatalogResourceType.QUESTION, it.id, "question.label", it.stableQuestionId) })
        `when`(catalogTexts.findAllByResourceTypeAndResourceIdInAndLocale(ScreeningCatalogResourceType.CHOICE, choicesForQuestions.map { it.id }, "id")).thenReturn(choicesForQuestions.map { text(ScreeningCatalogResourceType.CHOICE, it.id, "choice.label", it.code) })
        `when`(catalogTexts.findAllByResourceTypeAndResourceIdInAndLocale(ScreeningCatalogResourceType.TEMPLATE, listOf(template.id), "id")).thenReturn(templateTexts(template.id) + listOf(
            text(ScreeningCatalogResourceType.TEMPLATE, template.id, "result.status.SEGERA_DISKUSIKAN.title", "Segera"),
            text(ScreeningCatalogResourceType.TEMPLATE, template.id, "result.status.SEGERA_DISKUSIKAN.summary", "Ringkasan"),
            text(ScreeningCatalogResourceType.TEMPLATE, template.id, "result.status.SEGERA_DISKUSIKAN.next_step", "Langkah"),
            text(ScreeningCatalogResourceType.TEMPLATE, template.id, "result.reason.OBSERVASI_BELUM_CUKUP", "Observasi"),
            text(ScreeningCatalogResourceType.TEMPLATE, template.id, "result.reason.DISKUSIKAN_BUTIR_PERKEMBANGAN", "Diskusikan"),
        ))
        `when`(results.save(any(ScreeningResult::class.java))).thenAnswer { it.arguments[0] }

        val completed = service.complete(jwt, session.id) as ScreeningCompletionOutcome.Completed

        assertEquals(ScreeningResultMainStatus.SEGERA_DISKUSIKAN, completed.result.mainStatus)
        assertEquals(6, completed.result.domains.size)
        assertTrue(completed.result.domains.none { it.domainCode == "EMPTY" })
        assertEquals(ScreeningResultMainStatus.PENGAMATAN_BELUM_CUKUP, completed.result.domains.first { it.domainCode == "MK" }.statusCode)
        assertEquals(ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN, completed.result.domains.first { it.domainCode == "SE" }.statusCode)
        assertEquals(ScreeningResultMainStatus.KEMAMPUAN_DILAPORKAN_TERLIHAT, completed.result.domains.first { it.domainCode == "ALL" }.statusCode)
        assertEquals(ScreeningResultMainStatus.PENGAMATAN_BELUM_CUKUP, completed.result.domains.first { it.domainCode == "UNKNOWN" }.statusCode)
        assertEquals(ScreeningResultMainStatus.PENGAMATAN_BELUM_CUKUP, completed.result.domains.first { it.domainCode == "UNCERTAIN" }.statusCode)
        assertEquals(1, completed.result.domains.first { it.domainCode == "MK" }.incompleteCount)
    }

    @Test
    fun `result loads owner scoped persisted snapshots`() {
        val session = session().apply { status = ScreeningSessionStatus.COMPLETED }
        val result = ScreeningResult(sessionId = session.id, templateCode = session.templateCode, statusTitleSnapshot = "Title")
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(sessions.findByIdAndOwnerUserId(session.id, parent.id)).thenReturn(session)
        `when`(results.findBySessionId(session.id)).thenReturn(result)
        `when`(resultDomains.findAllByResultIdOrderByDisplayOrderAsc(result.id)).thenReturn(listOf(ScreeningResultDomain(resultId = result.id, domainCode = "BK")))
        `when`(resultReasons.findAllByResultIdOrderByDisplayOrderAsc(result.id)).thenReturn(emptyList())
        `when`(resultItems.findAllByResultIdOrderByDisplayOrderAsc(result.id)).thenReturn(emptyList())

        assertEquals("Title", service.result(jwt, session.id).statusTitleSnapshot)
    }

    private fun stubCommon(session: ScreeningSession, template: ScreeningTemplate, ruleSet: ScreeningRuleSet, question: ScreeningQuestion, choice: ScreeningChoice, answer: ScreeningAnswer?) {
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(sessions.findByIdAndOwnerUserId(session.id, parent.id)).thenReturn(session)
        `when`(templates.findById(template.id)).thenReturn(Optional.of(template))
        `when`(rules.findById(ruleSet.id)).thenReturn(Optional.of(ruleSet))
        `when`(questions.findAllByTemplateIdOrderByDisplayOrderAsc(template.id)).thenReturn(listOf(question))
        `when`(choices.findAllByQuestionIdIn(listOf(question.id))).thenReturn(listOf(choice))
        `when`(answers.findAllBySessionIdOrderByAnsweredAtAscIdAsc(session.id)).thenReturn(listOfNotNull(answer))
        `when`(triggers.findAllByRuleSetIdAndEnabledTrueOrderByDisplayOrderAsc(ruleSet.id)).thenReturn(emptyList())
        `when`(catalogTexts.findAllByResourceTypeAndResourceIdInAndLocale(ScreeningCatalogResourceType.QUESTION, listOf(question.id), "id")).thenReturn(listOf(text(ScreeningCatalogResourceType.QUESTION, question.id, "question.label", "Kemampuan")))
        `when`(catalogTexts.findAllByResourceTypeAndResourceIdInAndLocale(ScreeningCatalogResourceType.CHOICE, listOf(choice.id), "id")).thenReturn(listOf(text(ScreeningCatalogResourceType.CHOICE, choice.id, "choice.label", "Jawaban terlihat")))
        `when`(catalogTexts.findAllByResourceTypeAndResourceIdInAndLocale(ScreeningCatalogResourceType.TEMPLATE, listOf(template.id), "id")).thenReturn(templateTexts(template.id))
        `when`(results.save(any(ScreeningResult::class.java))).thenAnswer { it.arguments[0] }
    }

    private fun templateTexts(templateId: UUID) = listOf(
        text(ScreeningCatalogResourceType.TEMPLATE, templateId, "result.status.KEMAMPUAN_DILAPORKAN_TERLIHAT.title", "Status terlihat"),
        text(ScreeningCatalogResourceType.TEMPLATE, templateId, "result.status.KEMAMPUAN_DILAPORKAN_TERLIHAT.summary", "Ringkasan terlihat"),
        text(ScreeningCatalogResourceType.TEMPLATE, templateId, "result.status.KEMAMPUAN_DILAPORKAN_TERLIHAT.next_step", "Lanjut pantau"),
        text(ScreeningCatalogResourceType.TEMPLATE, templateId, "disclaimer.v1", "Disclaimer"),
    )

    private fun text(type: ScreeningCatalogResourceType, resourceId: UUID, key: String, value: String) = ScreeningCatalogText(resourceType = type, resourceId = resourceId, locale = "id", textKey = key, textValue = value)

    private fun session() = ScreeningSession(
        id = UUID.randomUUID(),
        ownerUserId = parent.id,
        templateId = UUID.randomUUID(),
        templateCode = "DEV_24_35",
        templateVersion = 1,
        status = ScreeningSessionStatus.IN_PROGRESS,
        locale = "id",
        expiresAt = Instant.now().plusSeconds(600),
        subjectNameSnapshot = "Anak",
        dateOfBirthSnapshot = LocalDate.now().minusMonths(30),
    )

    private fun template(session: ScreeningSession) = ScreeningTemplate(
        id = session.templateId,
        code = session.templateCode,
        version = session.templateVersion,
        minAgeMonths = 24,
        maxAgeMonths = 35,
        status = ScreeningTemplateStatus.PUBLISHED,
        ruleVersion = 1,
        ruleSetId = UUID.randomUUID(),
    )

    private fun ruleSet(template: ScreeningTemplate) = ScreeningRuleSet(
        id = template.ruleSetId!!,
        code = "DEV_RULES",
        version = template.ruleVersion,
        status = ScreeningRuleSetStatus.PUBLISHED,
        reviewStatus = ScreeningReviewStatus.APPROVED,
    )

    private fun question(template: ScreeningTemplate) = ScreeningQuestion(
        id = UUID.randomUUID(),
        templateId = template.id,
        stableQuestionId = "B24-BK1",
        domain = "BK",
        required = true,
        reviewStatus = ScreeningReviewStatus.APPROVED,
    )
}
