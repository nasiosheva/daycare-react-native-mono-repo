package com.daycare.api.service

import com.daycare.api.domain.ScreeningLocaleCodes
import com.daycare.api.domain.ScreeningSessionStatus
import com.daycare.api.domain.ScreeningTemplateStatus
import com.daycare.api.domain.Role
import com.daycare.api.persistence.ScreeningAnswer
import com.daycare.api.persistence.ScreeningAnswerRepository
import com.daycare.api.persistence.ScreeningChildProfileRepository
import com.daycare.api.persistence.ScreeningChoiceRepository
import com.daycare.api.persistence.ScreeningQuestionRepository
import com.daycare.api.persistence.ScreeningSession
import com.daycare.api.persistence.ScreeningSessionRepository
import com.daycare.api.persistence.ScreeningTemplateRepository
import com.daycare.api.persistence.ScreeningRuleSetRepository
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.Period
import java.util.Locale
import java.util.UUID

data class StartScreeningSessionRequest(
    val profileId: UUID,
    val templateId: UUID,
    val locale: String,
    val consentVersion: String,
    val observationLanguage: String? = null,
    val correctedAgeMonths: Int? = null,
    val organizationId: UUID? = null,
    val childId: UUID? = null,
)

data class ScreeningSessionResponse(
    val id: UUID,
    val profileId: UUID,
    val templateId: UUID,
    val templateCode: String,
    val templateVersion: Int,
    val status: ScreeningSessionStatus,
    val locale: String,
    val observationLanguage: String?,
    val organizationId: UUID?,
    val childId: UUID?,
    val expiresAt: Instant,
    val ageMonths: Int,
    val correctedAgeMonths: Int?,
)

data class SaveScreeningAnswerRequest(
    val questionId: UUID,
    val answerCode: String,
    val contextCode: String? = null,
    val note: String? = null,
)

data class SaveScreeningAnswersRequest(
    val answers: List<SaveScreeningAnswerRequest>,
)

data class ScreeningAnswerResponse(
    val id: UUID,
    val sessionId: UUID,
    val questionId: UUID,
    val stableQuestionId: String,
    val answerCode: String,
    val contextCode: String?,
    val note: String?,
    val answeredAt: Instant,
)

data class ScreeningAvailableTemplateResponse(
    val id: UUID,
    val code: String,
    val version: Int,
    val minAgeMonths: Int,
    val maxAgeMonths: Int,
)

data class ScreeningQuestionnaireResponse(
    val session: ScreeningSessionResponse,
    val questions: List<ScreeningQuestionnaireQuestionResponse>,
)

data class ScreeningQuestionnaireQuestionResponse(
    val id: UUID,
    val stableQuestionId: String,
    val domain: String,
    val subdomain: String?,
    val answerType: com.daycare.api.domain.ScreeningQuestionAnswerType,
    val required: Boolean,
    val needsOpportunity: Boolean,
    val informationalOnly: Boolean,
    val displayOrder: Int,
    val questionText: String,
    val currentAnswerCode: String?,
    val choices: List<ScreeningQuestionnaireChoiceResponse>,
)

data class ScreeningQuestionnaireChoiceResponse(val id: UUID, val code: String, val displayOrder: Int, val enabled: Boolean, val label: String)

@Service
class ScreeningSessionService(
    private val identity: IdentityService,
    private val profiles: ScreeningChildProfileRepository,
    private val templates: ScreeningTemplateRepository,
    private val sessions: ScreeningSessionRepository,
    private val questions: ScreeningQuestionRepository,
    private val choices: ScreeningChoiceRepository,
    private val answers: ScreeningAnswerRepository,
    private val catalogTexts: com.daycare.api.persistence.ScreeningCatalogTextRepository,
    private val access: AccessService? = null,
    private val childScopes: ChildScopeService? = null,
    private val ruleSets: ScreeningRuleSetRepository? = null,
) {
    @Transactional(readOnly = true)
    fun availableTemplates(jwt: Jwt): List<ScreeningAvailableTemplateResponse> {
        requireRegisteredParent(identity.sync(jwt))
        return templates.findAllByStatusOrderByMinAgeMonthsAscMaxAgeMonthsAscCodeAsc(ScreeningTemplateStatus.PUBLISHED)
            .filter { it.ruleSetId != null }
            .map { ScreeningAvailableTemplateResponse(it.id, it.code, it.version, it.minAgeMonths, it.maxAgeMonths) }
    }

    @Transactional(readOnly = true)
    fun questionnaire(jwt: Jwt, sessionId: UUID): ScreeningQuestionnaireResponse {
        val parent = requireRegisteredParent(identity.sync(jwt))
        val session = ownedSession(sessionId, parent.id)
        val locale = session.locale
        val templateQuestions = questions.findAllByTemplateIdOrderByDisplayOrderAsc(session.templateId)
        val questionTexts = catalogTexts.findAllByResourceTypeAndResourceIdInAndLocale(com.daycare.api.domain.ScreeningCatalogResourceType.QUESTION, templateQuestions.map { it.id }, locale).associateBy { it.resourceId to it.textKey }
        val allChoices = choices.findAllByQuestionIdIn(templateQuestions.map { it.id })
        val currentAnswers = answers.findAllBySessionIdOrderByAnsweredAtAscIdAsc(session.id).associateBy { it.questionId }
        val choiceTexts = catalogTexts.findAllByResourceTypeAndResourceIdInAndLocale(com.daycare.api.domain.ScreeningCatalogResourceType.CHOICE, allChoices.map { it.id }, locale).associateBy { it.resourceId to it.textKey }
        return ScreeningQuestionnaireResponse(session.toResponse(), templateQuestions.map { question ->
            ScreeningQuestionnaireQuestionResponse(question.id, question.stableQuestionId, question.domain, question.subdomain, question.answerType, question.required, question.needsOpportunity, question.informationalOnly, question.displayOrder, questionTexts[question.id to "question.label"]?.textValue ?: "", currentAnswers[question.id]?.answerCode, allChoices.filter { it.questionId == question.id }.sortedBy { it.displayOrder }.map { choice -> ScreeningQuestionnaireChoiceResponse(choice.id, choice.code, choice.displayOrder, choice.enabled, choiceTexts[choice.id to "choice.label"]?.textValue ?: choice.code) })
        })
    }
    @Transactional
    fun start(jwt: Jwt, request: StartScreeningSessionRequest): ScreeningSessionResponse {
        val parent = requireRegisteredParent(identity.sync(jwt))
        val profile = profiles.findByIdAndOwnerUserId(request.profileId, parent.id)
            ?: throw IllegalArgumentException("Screening profile was not found")
        check(profile.active) { "Archived screening profile cannot start a session" }
        val template = templates.findById(request.templateId).orElseThrow { IllegalArgumentException("Screening template was not found") }
        check(template.status == ScreeningTemplateStatus.PUBLISHED) { "Screening template is not published" }
        val ruleSetId = template.ruleSetId ?: throw IllegalStateException("Screening template has no published evaluation rule set")
        ruleSets?.let { repository -> check(repository.findById(ruleSetId).orElse(null)?.status == com.daycare.api.domain.ScreeningRuleSetStatus.PUBLISHED) { "Screening template has no published evaluation rule set" } }
        val locale = normalizeLocale(request.locale)
        val consentVersion = request.consentVersion.trim()
        require(consentVersion.isNotBlank() && consentVersion.length <= 80) { "Screening consent version is required" }
        val observationLanguage = request.observationLanguage?.trim()?.takeIf(String::isNotBlank)?.also { require(it.length <= 120) { "Observation language is too long" } }
        val linkedChild = when {
            request.childId == null && request.organizationId == null -> null
            request.childId != null && request.organizationId != null -> {
                val accessService = requireNotNull(access) { "Linked screening child access is unavailable" }
                val childScopeService = requireNotNull(childScopes) { "Linked screening child access is unavailable" }
                val scope = accessService.require(jwt, request.organizationId, setOf(Role.PARENT), readOnly = true)
                childScopeService.requireParentLinkedChild(scope, request.childId, request.organizationId)
            }
            else -> throw IllegalArgumentException("Linked screening child and organization must be supplied together")
        }
        val today = LocalDate.now()
        val ageMonths = completedMonths(profile.dateOfBirth, today)
        val correctedAge = request.correctedAgeMonths
        require(correctedAge == null || correctedAge in 0..ageMonths) { "Corrected age is outside the valid range" }
        check(profile.prematureBirth != true) { "Screening is not available for premature profiles until corrected-age policy is approved" }
        val effectiveAge = correctedAge ?: ageMonths
        require(effectiveAge in template.minAgeMonths..template.maxAgeMonths) { "Screening template is not available for this profile age" }
        val now = Instant.now()
        return sessions.save(
            ScreeningSession(
                profileId = profile.id,
                ownerUserId = parent.id,
                templateId = template.id,
                templateCode = template.code,
                templateVersion = template.version,
                status = ScreeningSessionStatus.DRAFT,
                locale = locale,
                observationLanguage = observationLanguage,
                organizationId = linkedChild?.organizationId,
                childId = linkedChild?.id,
                consentVersion = consentVersion,
                consentedAt = now,
                startedAt = now,
                expiresAt = now.plus(Duration.ofDays(30)),
                ageMonths = ageMonths,
                correctedAgeMonths = correctedAge,
                subjectNameSnapshot = profile.subjectName,
                dateOfBirthSnapshot = profile.dateOfBirth,
                createdAt = now,
                updatedAt = now,
            ),
        ).toResponse()
    }

    @Transactional
    fun mine(jwt: Jwt): List<ScreeningSessionResponse> {
        val parent = requireRegisteredParent(identity.sync(jwt))
        val now = Instant.now()
        val owned = sessions.findAllByOwnerUserIdOrderByCreatedAtDesc(parent.id)
        val expired = owned.filter { it.status == ScreeningSessionStatus.DRAFT || it.status == ScreeningSessionStatus.IN_PROGRESS }
            .filter { !it.expiresAt.isAfter(now) }
            .onEach {
                it.status = ScreeningSessionStatus.EXPIRED
                it.updatedAt = now
            }
        if (expired.isNotEmpty()) sessions.saveAll(expired)
        return owned.map { it.toResponse() }
    }

    @Transactional(readOnly = true)
    fun answers(jwt: Jwt, sessionId: UUID): List<ScreeningAnswerResponse> {
        val parent = requireRegisteredParent(identity.sync(jwt))
        val session = ownedSession(sessionId, parent.id)
        return answers.findAllBySessionIdOrderByAnsweredAtAscIdAsc(session.id).map { it.toResponse() }
    }

    @Transactional
    fun saveAnswer(jwt: Jwt, sessionId: UUID, request: SaveScreeningAnswerRequest): ScreeningAnswerResponse {
        val parent = requireRegisteredParent(identity.sync(jwt))
        val session = ownedSession(sessionId, parent.id)
        ensureWritable(session)
        return persistValidatedAnswers(session, validateRequests(session, listOf(request))).single().toResponse()
    }

    @Transactional
    fun saveAnswers(jwt: Jwt, sessionId: UUID, request: SaveScreeningAnswersRequest): List<ScreeningAnswerResponse> {
        val parent = requireRegisteredParent(identity.sync(jwt))
        val session = ownedSession(sessionId, parent.id)
        ensureWritable(session)
        require(request.answers.isNotEmpty()) { "Screening answer batch cannot be empty" }
        require(request.answers.size <= 500) { "Screening answer batch is too large" }
        return persistValidatedAnswers(session, validateRequests(session, request.answers)).map { it.toResponse() }
    }

    private fun validateRequests(session: ScreeningSession, requests: List<SaveScreeningAnswerRequest>): List<ValidatedScreeningAnswer> {
        require(requests.map { it.questionId }.distinct().size == requests.size) { "Screening answer batch contains duplicate questions" }
        return requests.map { request ->
            val question = questions.findById(request.questionId).orElseThrow { IllegalArgumentException("Screening question was not found") }
            require(question.templateId == session.templateId) { "Screening question belongs to a different template" }
            val answerCode = normalizeAnswerCode(question, request.answerCode)
            val contextCode = request.contextCode?.trim()?.takeIf(String::isNotBlank)?.also { require(it.length <= 120) { "Screening context code is too long" } }
            val note = request.note?.trim()?.takeIf(String::isNotBlank).also { require(it == null || it.length <= 2_000) { "Screening answer note is too long" } }
            ValidatedScreeningAnswer(question, answerCode, contextCode, note, answers.findBySessionIdAndQuestionId(session.id, question.id))
        }
    }

    private fun normalizeAnswerCode(question: com.daycare.api.persistence.ScreeningQuestion, raw: String): String {
        val codes = raw.split(',').map { it.trim() }.filter(String::isNotBlank)
        require(codes.isNotEmpty() && codes.size == codes.distinct().size) { "Screening answer is required" }
        require(codes.all { it.length <= 64 }) { "Screening answer is too long" }
        if (question.answerType == com.daycare.api.domain.ScreeningQuestionAnswerType.SINGLE_CHOICE) {
            require(codes.size == 1) { "This question accepts one answer" }
            require(choices.findByQuestionIdAndCode(question.id, codes.single())?.enabled == true) { "Screening answer is not available" }
            return codes.single()
        }
        val enabledChoices = choices.findAllByQuestionIdOrderByDisplayOrderAsc(question.id).filter { it.enabled }
        require(codes.all { code -> enabledChoices.any { it.code == code } }) { "Screening answer is not available" }
        val displayOrder = enabledChoices.withIndex().associate { it.value.code to it.index }
        return codes.sortedBy { displayOrder[it] ?: Int.MAX_VALUE }.joinToString(",")
    }

    private fun persistValidatedAnswers(session: ScreeningSession, validated: List<ValidatedScreeningAnswer>): List<ScreeningAnswer> {
        val now = Instant.now()
        val toSave = validated.map { item ->
            val answer = item.existing ?: ScreeningAnswer(sessionId = session.id, questionId = item.question.id, stableQuestionId = item.question.stableQuestionId)
            answer.stableQuestionId = item.question.stableQuestionId
            answer.answerCode = item.answerCode
            answer.contextCode = item.contextCode
            answer.note = item.note
            answer.answeredAt = now
            answer.updatedAt = now
            answer
        }
        if (session.status == ScreeningSessionStatus.DRAFT) session.status = ScreeningSessionStatus.IN_PROGRESS
        session.updatedAt = now
        sessions.save(session)
        answers.saveAll(toSave)
        return toSave
    }

    private data class ValidatedScreeningAnswer(
        val question: com.daycare.api.persistence.ScreeningQuestion,
        val answerCode: String,
        val contextCode: String?,
        val note: String?,
        val existing: ScreeningAnswer?,
    )

    private fun ownedSession(sessionId: UUID, ownerUserId: UUID): ScreeningSession = sessions.findByIdAndOwnerUserId(sessionId, ownerUserId)
        ?: throw IllegalArgumentException("Screening session was not found")

    private fun ensureWritable(session: ScreeningSession) {
        if (session.status == ScreeningSessionStatus.EXPIRED || session.expiresAt.isBefore(Instant.now())) {
            session.status = ScreeningSessionStatus.EXPIRED
            session.updatedAt = Instant.now()
            sessions.save(session)
            throw IllegalStateException("Screening session has expired")
        }
        check(session.status == ScreeningSessionStatus.DRAFT || session.status == ScreeningSessionStatus.IN_PROGRESS) { "Screening session cannot be edited" }
    }

    private fun normalizeLocale(value: String): String = value.trim().lowercase(Locale.ROOT).also {
        require(it in ScreeningLocaleCodes.supported) { "Screening locale is not supported" }
    }

    private fun completedMonths(dateOfBirth: LocalDate, today: LocalDate): Int {
        require(!dateOfBirth.isAfter(today)) { "Screening profile date of birth cannot be in the future" }
        return Period.between(dateOfBirth, today).toTotalMonths().toInt()
    }
}

private fun ScreeningSession.toResponse() = ScreeningSessionResponse(
    id = id,
    profileId = profileId,
    templateId = templateId,
    templateCode = templateCode,
    templateVersion = templateVersion,
    status = status,
    locale = locale,
    observationLanguage = observationLanguage,
    organizationId = organizationId,
    childId = childId,
    expiresAt = expiresAt,
    ageMonths = ageMonths,
    correctedAgeMonths = correctedAgeMonths,
)

private fun ScreeningAnswer.toResponse() = ScreeningAnswerResponse(
    id = id,
    sessionId = sessionId,
    questionId = questionId,
    stableQuestionId = stableQuestionId,
    answerCode = answerCode,
    contextCode = contextCode,
    note = note,
    answeredAt = answeredAt,
)
