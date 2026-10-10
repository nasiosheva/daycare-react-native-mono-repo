package com.daycare.api.service

import com.daycare.api.domain.RegistrationRole
import com.daycare.api.domain.Role
import com.daycare.api.domain.ScreeningSessionStatus
import com.daycare.api.domain.ScreeningTemplateStatus
import com.daycare.api.domain.ScreeningQuestionAnswerType
import com.daycare.api.domain.ScreeningRuleSetStatus
import com.daycare.api.persistence.ScreeningAnswer
import com.daycare.api.persistence.ScreeningAnswerRepository
import com.daycare.api.persistence.ScreeningChildProfile
import com.daycare.api.persistence.ScreeningChildProfileRepository
import com.daycare.api.persistence.ScreeningChoice
import com.daycare.api.persistence.ScreeningChoiceRepository
import com.daycare.api.persistence.ScreeningQuestion
import com.daycare.api.persistence.ScreeningQuestionRepository
import com.daycare.api.persistence.ScreeningSession
import com.daycare.api.persistence.ScreeningSessionRepository
import com.daycare.api.persistence.ScreeningTemplate
import com.daycare.api.persistence.ScreeningTemplateRepository
import com.daycare.api.persistence.Membership
import com.daycare.api.persistence.Child
import com.daycare.api.domain.InstitutionCapability
import com.daycare.api.persistence.ScreeningCatalogTextRepository
import com.daycare.api.persistence.UserProfile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import java.time.Instant
import java.time.LocalDate
import java.util.Optional
import java.util.UUID

class ScreeningSessionServiceTest {
    private val identity = mock(IdentityService::class.java)
    private val profiles = mock(ScreeningChildProfileRepository::class.java)
    private val templates = mock(ScreeningTemplateRepository::class.java)
    private val sessions = mock(ScreeningSessionRepository::class.java)
    private val questions = mock(ScreeningQuestionRepository::class.java)
    private val choices = mock(ScreeningChoiceRepository::class.java)
    private val answers = mock(ScreeningAnswerRepository::class.java)
    private val catalogTexts = mock(ScreeningCatalogTextRepository::class.java)
    private val service = ScreeningSessionService(identity, profiles, templates, sessions, questions, choices, answers, catalogTexts)
    private val parent = UserProfile(id = UUID.randomUUID(), registrationRole = RegistrationRole.PARENT)
    private val jwt = mock(Jwt::class.java)

    @Test
    fun `start accepts only published template and stores 30 day expiry`() {
        val profile = profile()
        val template = template(ScreeningTemplateStatus.PUBLISHED)
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(profiles.findByIdAndOwnerUserId(profile.id, parent.id)).thenReturn(profile)
        `when`(templates.findById(template.id)).thenReturn(Optional.of(template))
        `when`(sessions.save(org.mockito.ArgumentMatchers.any(ScreeningSession::class.java))).thenAnswer { it.arguments[0] }

        val result = service.start(
            jwt,
            StartScreeningSessionRequest(profile.id, template.id, "EN", "consent-v1", "Bahasa Indonesia"),
        )

        assertEquals("en", result.locale)
        assertEquals(ScreeningSessionStatus.DRAFT, result.status)
        assertTrue(result.expiresAt.isAfter(Instant.now().plusSeconds(java.time.Duration.ofDays(29).toSeconds())))
    }

    @Test
    fun `start rejects a draft template`() {
        val profile = profile(premature = true)
        val template = template(ScreeningTemplateStatus.DRAFT)
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(profiles.findByIdAndOwnerUserId(profile.id, parent.id)).thenReturn(profile)
        `when`(templates.findById(template.id)).thenReturn(Optional.of(template))

        assertThrows(IllegalStateException::class.java) {
            service.start(jwt, StartScreeningSessionRequest(profile.id, template.id, "id", "consent-v1"))
        }
    }

    @Test
    fun `start blocks premature profile until corrected age policy is approved`() {
        val profile = profile(premature = true)
        val template = template(ScreeningTemplateStatus.PUBLISHED)
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(profiles.findByIdAndOwnerUserId(profile.id, parent.id)).thenReturn(profile)
        `when`(templates.findById(template.id)).thenReturn(Optional.of(template))

        assertThrows(IllegalStateException::class.java) {
            service.start(jwt, StartScreeningSessionRequest(profile.id, template.id, "id", "consent-v1", correctedAgeMonths = 10))
        }
    }

    @Test
    fun `save answer is limited to the session template and enabled choice`() {
        val session = session()
        val question = ScreeningQuestion(id = UUID.randomUUID(), templateId = session.templateId, stableQuestionId = "B24-BK1")
        val choice = ScreeningChoice(questionId = question.id, code = "YA_SUDAH", enabled = true)
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(sessions.findByIdAndOwnerUserId(session.id, parent.id)).thenReturn(session)
        `when`(questions.findById(question.id)).thenReturn(Optional.of(question))
        `when`(choices.findByQuestionIdAndCode(question.id, "YA_SUDAH")).thenReturn(choice)
        `when`(answers.findBySessionIdAndQuestionId(session.id, question.id)).thenReturn(null)
        `when`(sessions.save(session)).thenReturn(session)
        `when`(answers.saveAll(org.mockito.ArgumentMatchers.anyList())).thenAnswer { it.arguments[0] }

        val result = service.saveAnswer(jwt, session.id, SaveScreeningAnswerRequest(question.id, " YA_SUDAH ", note = " contoh "))

        assertEquals("YA_SUDAH", result.answerCode)
        assertEquals("contoh", result.note)
        assertEquals(ScreeningSessionStatus.IN_PROGRESS, session.status)
    }

    @Test
    fun `expired session is closed and cannot accept answers`() {
        val session = session().apply { expiresAt = Instant.now().minusSeconds(1) }
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(sessions.findByIdAndOwnerUserId(session.id, parent.id)).thenReturn(session)
        `when`(sessions.save(session)).thenReturn(session)

        assertThrows(IllegalStateException::class.java) {
            service.saveAnswer(jwt, session.id, SaveScreeningAnswerRequest(UUID.randomUUID(), "YA_SUDAH"))
        }
        assertEquals(ScreeningSessionStatus.EXPIRED, session.status)
    }

    @Test
    fun `answer batch validates every item before writing`() {
        val session = session()
        val firstQuestion = ScreeningQuestion(id = UUID.randomUUID(), templateId = session.templateId, stableQuestionId = "B24-BK1")
        val secondQuestion = ScreeningQuestion(id = UUID.randomUUID(), templateId = session.templateId, stableQuestionId = "B24-MK1")
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(sessions.findByIdAndOwnerUserId(session.id, parent.id)).thenReturn(session)
        `when`(questions.findById(firstQuestion.id)).thenReturn(Optional.of(firstQuestion))
        `when`(questions.findById(secondQuestion.id)).thenReturn(Optional.of(secondQuestion))
        `when`(choices.findByQuestionIdAndCode(firstQuestion.id, "YA_SUDAH")).thenReturn(ScreeningChoice(questionId = firstQuestion.id, code = "YA_SUDAH", enabled = true))
        `when`(choices.findByQuestionIdAndCode(secondQuestion.id, "BELUM")).thenReturn(null)

        assertThrows(IllegalArgumentException::class.java) {
            service.saveAnswers(
                jwt,
                session.id,
                SaveScreeningAnswersRequest(
                    listOf(
                        SaveScreeningAnswerRequest(firstQuestion.id, "YA_SUDAH"),
                        SaveScreeningAnswerRequest(secondQuestion.id, "BELUM"),
                    ),
                ),
            )
        }
        verify(answers, never()).saveAll(org.mockito.ArgumentMatchers.anyList())
        assertEquals(ScreeningSessionStatus.DRAFT, session.status)
    }

    @Test
    fun `answer batch stores all validated answers and transitions draft`() {
        val session = session()
        val firstQuestion = ScreeningQuestion(id = UUID.randomUUID(), templateId = session.templateId, stableQuestionId = "B24-BK1")
        val secondQuestion = ScreeningQuestion(id = UUID.randomUUID(), templateId = session.templateId, stableQuestionId = "B24-MK1")
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(sessions.findByIdAndOwnerUserId(session.id, parent.id)).thenReturn(session)
        `when`(questions.findById(firstQuestion.id)).thenReturn(Optional.of(firstQuestion))
        `when`(questions.findById(secondQuestion.id)).thenReturn(Optional.of(secondQuestion))
        `when`(choices.findByQuestionIdAndCode(firstQuestion.id, "YA_SUDAH")).thenReturn(ScreeningChoice(questionId = firstQuestion.id, code = "YA_SUDAH", enabled = true))
        `when`(choices.findByQuestionIdAndCode(secondQuestion.id, "TIDAK_DIAMATI")).thenReturn(ScreeningChoice(questionId = secondQuestion.id, code = "TIDAK_DIAMATI", enabled = true))
        `when`(sessions.save(session)).thenReturn(session)

        val saved = service.saveAnswers(
            jwt,
            session.id,
            SaveScreeningAnswersRequest(
                listOf(
                    SaveScreeningAnswerRequest(firstQuestion.id, "YA_SUDAH"),
                    SaveScreeningAnswerRequest(secondQuestion.id, "TIDAK_DIAMATI", contextCode = "CTX-06"),
                ),
            ),
        )

        assertEquals(2, saved.size)
        assertEquals(ScreeningSessionStatus.IN_PROGRESS, session.status)
        assertEquals("CTX-06", saved.last().contextCode)
        verify(answers).saveAll(org.mockito.ArgumentMatchers.anyList())
    }

    @Test
    fun `multi choice answers are validated and stored in catalog order`() {
        val session = session()
        val question = ScreeningQuestion(id = UUID.randomUUID(), templateId = session.templateId, stableQuestionId = "CTX-04", answerType = ScreeningQuestionAnswerType.MULTI_CHOICE)
        val first = ScreeningChoice(questionId = question.id, code = "BICARA", displayOrder = 1, enabled = true)
        val second = ScreeningChoice(questionId = question.id, code = "GERAK", displayOrder = 2, enabled = true)
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(sessions.findByIdAndOwnerUserId(session.id, parent.id)).thenReturn(session)
        `when`(questions.findById(question.id)).thenReturn(Optional.of(question))
        `when`(choices.findAllByQuestionIdOrderByDisplayOrderAsc(question.id)).thenReturn(listOf(first, second))
        `when`(answers.findBySessionIdAndQuestionId(session.id, question.id)).thenReturn(null)
        `when`(sessions.save(session)).thenReturn(session)

        val saved = service.saveAnswer(jwt, session.id, SaveScreeningAnswerRequest(question.id, "GERAK,BICARA"))

        assertEquals("BICARA,GERAK", saved.answerCode)
    }

    @Test
    fun `mine normalizes expired drafts without changing completed sessions`() {
        val expired = session().apply { expiresAt = Instant.now().minusSeconds(1) }
        val completed = session().apply { status = ScreeningSessionStatus.COMPLETED }
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(sessions.findAllByOwnerUserIdOrderByCreatedAtDesc(parent.id)).thenReturn(listOf(expired, completed))
        `when`(sessions.saveAll(org.mockito.ArgumentMatchers.anyList<ScreeningSession>())).thenAnswer { it.arguments[0] }

        val listed = service.mine(jwt)

        assertEquals(ScreeningSessionStatus.EXPIRED, listed.first().status)
        assertEquals(ScreeningSessionStatus.COMPLETED, listed.last().status)
        verify(sessions).saveAll(org.mockito.ArgumentMatchers.anyList<ScreeningSession>())
    }

    @Test
    fun `available templates and questionnaire preserve catalog fallbacks`() {
        val published = template(ScreeningTemplateStatus.PUBLISHED)
        val hidden = template(ScreeningTemplateStatus.PUBLISHED).apply { ruleSetId = null }
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(templates.findAllByStatusOrderByMinAgeMonthsAscMaxAgeMonthsAscCodeAsc(ScreeningTemplateStatus.PUBLISHED)).thenReturn(listOf(hidden, published))
        assertEquals(listOf(published.id), service.availableTemplates(jwt).map { it.id })

        val session = session()
        val question = ScreeningQuestion(id = UUID.randomUUID(), templateId = session.templateId, stableQuestionId = "Q1", subdomain = "sub")
        val choice = ScreeningChoice(id = UUID.randomUUID(), questionId = question.id, code = "YA_SUDAH", displayOrder = 1, enabled = true)
        val existing = ScreeningAnswer(sessionId = session.id, questionId = question.id, stableQuestionId = question.stableQuestionId, answerCode = choice.code)
        `when`(sessions.findByIdAndOwnerUserId(session.id, parent.id)).thenReturn(session)
        `when`(questions.findAllByTemplateIdOrderByDisplayOrderAsc(session.templateId)).thenReturn(listOf(question))
        `when`(catalogTexts.findAllByResourceTypeAndResourceIdInAndLocale(com.daycare.api.domain.ScreeningCatalogResourceType.QUESTION, listOf(question.id), session.locale)).thenReturn(emptyList())
        `when`(choices.findAllByQuestionIdIn(listOf(question.id))).thenReturn(listOf(choice))
        `when`(answers.findAllBySessionIdOrderByAnsweredAtAscIdAsc(session.id)).thenReturn(listOf(existing))
        `when`(catalogTexts.findAllByResourceTypeAndResourceIdInAndLocale(com.daycare.api.domain.ScreeningCatalogResourceType.CHOICE, listOf(choice.id), session.locale)).thenReturn(emptyList())

        val questionnaire = service.questionnaire(jwt, session.id)
        assertEquals("", questionnaire.questions.single().questionText)
        assertEquals(choice.code, questionnaire.questions.single().choices.single().label)
        assertEquals(choice.code, questionnaire.questions.single().currentAnswerCode)
    }

    @Test
    fun `start validates profile template locale consent and age invariants`() {
        val profile = profile()
        val published = template(ScreeningTemplateStatus.PUBLISHED)
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(profiles.findByIdAndOwnerUserId(profile.id, parent.id)).thenReturn(profile)
        `when`(templates.findById(published.id)).thenReturn(Optional.of(published))

        assertThrows(IllegalArgumentException::class.java) { service.start(jwt, StartScreeningSessionRequest(UUID.randomUUID(), published.id, "id", "v1")) }
        profile.active = false
        assertThrows(IllegalStateException::class.java) { service.start(jwt, StartScreeningSessionRequest(profile.id, published.id, "id", "v1")) }
        profile.active = true
        `when`(templates.findById(published.id)).thenReturn(Optional.empty())
        assertThrows(IllegalArgumentException::class.java) { service.start(jwt, StartScreeningSessionRequest(profile.id, published.id, "id", "v1")) }
        `when`(templates.findById(published.id)).thenReturn(Optional.of(published.apply { status = ScreeningTemplateStatus.DRAFT }))
        assertThrows(IllegalStateException::class.java) { service.start(jwt, StartScreeningSessionRequest(profile.id, published.id, "id", "v1")) }
        published.status = ScreeningTemplateStatus.PUBLISHED
        published.ruleSetId = null
        assertThrows(IllegalStateException::class.java) { service.start(jwt, StartScreeningSessionRequest(profile.id, published.id, "id", "v1")) }
        published.ruleSetId = UUID.randomUUID()
        assertThrows(IllegalArgumentException::class.java) { service.start(jwt, StartScreeningSessionRequest(profile.id, published.id, "xx", "v1")) }
        assertThrows(IllegalArgumentException::class.java) { service.start(jwt, StartScreeningSessionRequest(profile.id, published.id, "id", " ")) }
        assertThrows(IllegalArgumentException::class.java) { service.start(jwt, StartScreeningSessionRequest(profile.id, published.id, "id", "v1", observationLanguage = "x".repeat(121))) }
        assertThrows(IllegalArgumentException::class.java) { service.start(jwt, StartScreeningSessionRequest(profile.id, published.id, "id", "v1", correctedAgeMonths = 99)) }
        assertThrows(IllegalArgumentException::class.java) { service.start(jwt, StartScreeningSessionRequest(profile.id, published.id, "id", "v1", childId = UUID.randomUUID())) }
    }

    @Test
    fun `start supports linked child only with both access services`() {
        val profile = profile()
        val published = template(ScreeningTemplateStatus.PUBLISHED)
        val organizationId = UUID.randomUUID()
        val childId = UUID.randomUUID()
        val accessService = org.mockito.Mockito.mock(AccessService::class.java)
        val childScopeService = org.mockito.Mockito.mock(ChildScopeService::class.java)
        val linked = Child(id = childId, organizationId = organizationId)
        val scope = AccessScope(parent, Membership(userId = parent.id, organizationId = organizationId, role = Role.PARENT), emptySet(), emptySet())
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(profiles.findByIdAndOwnerUserId(profile.id, parent.id)).thenReturn(profile)
        `when`(templates.findById(published.id)).thenReturn(Optional.of(published))
        `when`(accessService.require(jwt, organizationId, setOf(Role.PARENT), readOnly = true)).thenReturn(scope)
        `when`(childScopeService.requireParentLinkedChild(scope, childId, organizationId)).thenReturn(linked)
        `when`(sessions.save(org.mockito.ArgumentMatchers.any(ScreeningSession::class.java))).thenAnswer { it.arguments[0] }
        val linkedService = ScreeningSessionService(identity, profiles, templates, sessions, questions, choices, answers, catalogTexts, accessService, childScopeService)

        val response = linkedService.start(jwt, StartScreeningSessionRequest(profile.id, published.id, "id", "v1", organizationId = organizationId, childId = childId))
        assertEquals(organizationId, response.organizationId)
        assertEquals(childId, response.childId)
        assertThrows(IllegalArgumentException::class.java) { linkedService.start(jwt, StartScreeningSessionRequest(profile.id, published.id, "id", "v1", organizationId = organizationId)) }
    }

    @Test
    fun `batch answers enforce size and update existing records`() {
        val session = session()
        val question = ScreeningQuestion(id = UUID.randomUUID(), templateId = session.templateId, stableQuestionId = "Q1")
        val existing = ScreeningAnswer(sessionId = session.id, questionId = question.id, stableQuestionId = question.stableQuestionId, answerCode = "BELUM")
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(sessions.findByIdAndOwnerUserId(session.id, parent.id)).thenReturn(session)
        `when`(questions.findById(question.id)).thenReturn(Optional.of(question))
        `when`(choices.findByQuestionIdAndCode(question.id, "YA_SUDAH")).thenReturn(ScreeningChoice(questionId = question.id, code = "YA_SUDAH", enabled = true))
        `when`(answers.findBySessionIdAndQuestionId(session.id, question.id)).thenReturn(existing)
        `when`(sessions.save(session)).thenReturn(session)
        assertThrows(IllegalArgumentException::class.java) { service.saveAnswers(jwt, session.id, SaveScreeningAnswersRequest(emptyList())) }
        assertThrows(IllegalArgumentException::class.java) { service.saveAnswers(jwt, session.id, SaveScreeningAnswersRequest(List(501) { SaveScreeningAnswerRequest(UUID.randomUUID(), "YA_SUDAH") })) }
        val updated = service.saveAnswer(jwt, session.id, SaveScreeningAnswerRequest(question.id, "YA_SUDAH", contextCode = " CTX ", note = " note "))
        assertEquals("YA_SUDAH", updated.answerCode)
        assertEquals("CTX", updated.contextCode)
        assertEquals("note", updated.note)
    }

    @Test
    fun `answer validation rejects wrong template and oversized metadata`() {
        val session = session()
        val question = ScreeningQuestion(id = UUID.randomUUID(), templateId = UUID.randomUUID(), stableQuestionId = "Q1")
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(sessions.findByIdAndOwnerUserId(session.id, parent.id)).thenReturn(session)
        `when`(questions.findById(question.id)).thenReturn(Optional.of(question))
        assertThrows(IllegalArgumentException::class.java) { service.saveAnswer(jwt, session.id, SaveScreeningAnswerRequest(question.id, "YA_SUDAH")) }
        question.templateId = session.templateId
        `when`(questions.findById(question.id)).thenReturn(Optional.of(question))
        assertThrows(IllegalArgumentException::class.java) { service.saveAnswer(jwt, session.id, SaveScreeningAnswerRequest(question.id, "YA_SUDAH", contextCode = "x".repeat(121))) }
        assertThrows(IllegalArgumentException::class.java) { service.saveAnswer(jwt, session.id, SaveScreeningAnswerRequest(question.id, "YA_SUDAH", note = "x".repeat(2_001))) }
    }

    @Test
    fun `start requires a published evaluation rule set when repository is wired`() {
        val profile = profile()
        val published = template(ScreeningTemplateStatus.PUBLISHED)
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(profiles.findByIdAndOwnerUserId(profile.id, parent.id)).thenReturn(profile)
        `when`(templates.findById(published.id)).thenReturn(Optional.of(published))
        val ruleSets = mock(com.daycare.api.persistence.ScreeningRuleSetRepository::class.java)
        `when`(ruleSets.findById(published.ruleSetId!!)).thenReturn(Optional.of(com.daycare.api.persistence.ScreeningRuleSet(id = published.ruleSetId!!, status = ScreeningRuleSetStatus.DRAFT)))
        val guarded = ScreeningSessionService(identity, profiles, templates, sessions, questions, choices, answers, catalogTexts, ruleSets = ruleSets)

        assertThrows(IllegalStateException::class.java) { guarded.start(jwt, StartScreeningSessionRequest(profile.id, published.id, "id", "v1")) }
        `when`(ruleSets.findById(published.ruleSetId!!)).thenReturn(Optional.of(com.daycare.api.persistence.ScreeningRuleSet(id = published.ruleSetId!!, status = ScreeningRuleSetStatus.PUBLISHED)))
        `when`(sessions.save(org.mockito.ArgumentMatchers.any(ScreeningSession::class.java))).thenAnswer { it.arguments[0] }
        assertEquals(ScreeningSessionStatus.DRAFT, guarded.start(jwt, StartScreeningSessionRequest(profile.id, published.id, "ID", " v1 ", observationLanguage = " ")).status)
    }

    @Test
    fun `linked child requires both access collaborators`() {
        val profile = profile()
        val published = template(ScreeningTemplateStatus.PUBLISHED)
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(profiles.findByIdAndOwnerUserId(profile.id, parent.id)).thenReturn(profile)
        `when`(templates.findById(published.id)).thenReturn(Optional.of(published))
        val organizationId = UUID.randomUUID(); val childId = UUID.randomUUID()
        val missingAccess = ScreeningSessionService(identity, profiles, templates, sessions, questions, choices, answers, catalogTexts, access = null, childScopes = mock(ChildScopeService::class.java))
        assertThrows(IllegalArgumentException::class.java) { missingAccess.start(jwt, StartScreeningSessionRequest(profile.id, published.id, "id", "v1", organizationId = organizationId, childId = childId)) }
        val missingChildScopes = ScreeningSessionService(identity, profiles, templates, sessions, questions, choices, answers, catalogTexts, access = mock(AccessService::class.java), childScopes = null)
        assertThrows(IllegalArgumentException::class.java) { missingChildScopes.start(jwt, StartScreeningSessionRequest(profile.id, published.id, "id", "v1", organizationId = organizationId, childId = childId)) }
    }

    @Test
    fun `mine leaves future drafts unchanged and answer validation rejects malformed choices`() {
        val future = session()
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(sessions.findAllByOwnerUserIdOrderByCreatedAtDesc(parent.id)).thenReturn(listOf(future))
        assertEquals(ScreeningSessionStatus.DRAFT, service.mine(jwt).single().status)

        val session = session()
        val single = ScreeningQuestion(id = UUID.randomUUID(), templateId = session.templateId, stableQuestionId = "Q1")
        `when`(sessions.findByIdAndOwnerUserId(session.id, parent.id)).thenReturn(session)
        `when`(questions.findById(single.id)).thenReturn(Optional.of(single))
        assertThrows(IllegalArgumentException::class.java) { service.saveAnswer(jwt, session.id, SaveScreeningAnswerRequest(single.id, " ")) }
        assertThrows(IllegalArgumentException::class.java) { service.saveAnswer(jwt, session.id, SaveScreeningAnswerRequest(single.id, "YA_SUDAH, BELUM")) }
        `when`(choices.findByQuestionIdAndCode(single.id, "YA_SUDAH")).thenReturn(ScreeningChoice(questionId = single.id, code = "YA_SUDAH", enabled = false))
        assertThrows(IllegalArgumentException::class.java) { service.saveAnswer(jwt, session.id, SaveScreeningAnswerRequest(single.id, "YA_SUDAH")) }

        val multi = ScreeningQuestion(id = UUID.randomUUID(), templateId = session.templateId, stableQuestionId = "CTX", answerType = ScreeningQuestionAnswerType.MULTI_CHOICE)
        val choice = ScreeningChoice(questionId = multi.id, code = "A", enabled = true)
        `when`(questions.findById(multi.id)).thenReturn(Optional.of(multi))
        `when`(choices.findAllByQuestionIdOrderByDisplayOrderAsc(multi.id)).thenReturn(listOf(choice))
        assertThrows(IllegalArgumentException::class.java) { service.saveAnswer(jwt, session.id, SaveScreeningAnswerRequest(multi.id, "A,A")) }
        assertThrows(IllegalArgumentException::class.java) { service.saveAnswer(jwt, session.id, SaveScreeningAnswerRequest(multi.id, "B")) }
    }

    @Test
    fun `questionnaire uses translated labels and answers endpoint is owner scoped`() {
        val session = session()
        val question = ScreeningQuestion(id = UUID.randomUUID(), templateId = session.templateId, stableQuestionId = "Q1")
        val choice = ScreeningChoice(id = UUID.randomUUID(), questionId = question.id, code = "A", displayOrder = 2, enabled = true)
        val qText = com.daycare.api.persistence.ScreeningCatalogText(resourceType = com.daycare.api.domain.ScreeningCatalogResourceType.QUESTION, resourceId = question.id, locale = "id", textKey = "question.label", textValue = "Pertanyaan")
        val cText = com.daycare.api.persistence.ScreeningCatalogText(resourceType = com.daycare.api.domain.ScreeningCatalogResourceType.CHOICE, resourceId = choice.id, locale = "id", textKey = "choice.label", textValue = "Pilihan")
        val answer = ScreeningAnswer(sessionId = session.id, questionId = question.id, stableQuestionId = question.stableQuestionId, answerCode = "A")
        `when`(identity.sync(jwt)).thenReturn(parent)
        `when`(sessions.findByIdAndOwnerUserId(session.id, parent.id)).thenReturn(session)
        `when`(questions.findAllByTemplateIdOrderByDisplayOrderAsc(session.templateId)).thenReturn(listOf(question))
        `when`(catalogTexts.findAllByResourceTypeAndResourceIdInAndLocale(com.daycare.api.domain.ScreeningCatalogResourceType.QUESTION, listOf(question.id), "id")).thenReturn(listOf(qText))
        `when`(choices.findAllByQuestionIdIn(listOf(question.id))).thenReturn(listOf(choice))
        `when`(answers.findAllBySessionIdOrderByAnsweredAtAscIdAsc(session.id)).thenReturn(listOf(answer))
        `when`(catalogTexts.findAllByResourceTypeAndResourceIdInAndLocale(com.daycare.api.domain.ScreeningCatalogResourceType.CHOICE, listOf(choice.id), "id")).thenReturn(listOf(cText))
        val questionnaire = service.questionnaire(jwt, session.id)
        assertEquals("Pertanyaan", questionnaire.questions.single().questionText)
        assertEquals("Pilihan", questionnaire.questions.single().choices.single().label)
        `when`(answers.findAllBySessionIdOrderByAnsweredAtAscIdAsc(session.id)).thenReturn(listOf(answer))
        assertEquals(1, service.answers(jwt, session.id).size)
    }

    private fun profile(premature: Boolean? = false) = ScreeningChildProfile(
        id = UUID.randomUUID(),
        ownerUserId = parent.id,
        subjectName = "Anak",
        dateOfBirth = LocalDate.now().minusMonths(30),
        prematureBirth = premature,
    )

    private fun template(status: ScreeningTemplateStatus) = ScreeningTemplate(
        id = UUID.randomUUID(),
        code = "DEV_24_35",
        version = 1,
        minAgeMonths = 24,
        maxAgeMonths = 35,
        status = status,
        ruleSetId = UUID.randomUUID(),
    )

    private fun session() = ScreeningSession(
        id = UUID.randomUUID(),
        ownerUserId = parent.id,
        templateId = UUID.randomUUID(),
        templateCode = "DEV_24_35",
        templateVersion = 1,
        status = ScreeningSessionStatus.DRAFT,
        expiresAt = Instant.now().plusSeconds(100),
    )
}
