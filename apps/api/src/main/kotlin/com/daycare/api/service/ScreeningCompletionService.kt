package com.daycare.api.service

// Mories Deo Hutapea,S.E.,S.Kom

import com.daycare.api.domain.ScreeningAnswerCode
import com.daycare.api.domain.ScreeningCatalogResourceType
import com.daycare.api.domain.ScreeningResultMainStatus
import com.daycare.api.domain.ScreeningReviewStatus
import com.daycare.api.domain.ScreeningSessionStatus
import com.daycare.api.domain.ScreeningRuleSetStatus
import com.daycare.api.domain.ScreeningTemplateStatus
import com.daycare.api.persistence.ScreeningAnswer
import com.daycare.api.persistence.ScreeningAnswerRepository
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
import com.daycare.api.persistence.ScreeningRuleSetRepository
import com.daycare.api.persistence.ScreeningRuleTriggerRepository
import com.daycare.api.persistence.ScreeningSession
import com.daycare.api.persistence.ScreeningSessionRepository
import com.daycare.api.persistence.ScreeningTemplateRepository
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

data class ScreeningResultDomainResponse(
    val domainCode: String,
    val statusCode: ScreeningResultMainStatus,
    val observedCount: Int,
    val incompleteCount: Int,
    val attentionCount: Int,
    val displayOrder: Int,
)

data class ScreeningResultReasonResponse(
    val reasonCode: String,
    val questionId: UUID?,
    val answerId: UUID?,
    val stableQuestionId: String?,
    val answerCode: String?,
    val domainCode: String?,
    val textSnapshot: String,
    val displayOrder: Int,
    val questionTextSnapshot: String? = null,
    val answerLabelSnapshot: String? = null,
)

data class ScreeningResultItemResponse(
    val questionId: UUID,
    val answerId: UUID?,
    val stableQuestionId: String,
    val domainCode: String,
    val questionTextSnapshot: String,
    val answerCode: String?,
    val answerLabelSnapshot: String?,
    val noteSnapshot: String?,
    val displayOrder: Int,
)

data class ScreeningResultResponse(
    val id: UUID,
    val sessionId: UUID,
    val templateCode: String,
    val templateVersion: Int,
    val ruleVersion: Int,
    val locale: String,
    val mainStatus: ScreeningResultMainStatus,
    val completenessStatus: String,
    val disclaimerVersion: String,
    val statusTitleSnapshot: String,
    val statusSummarySnapshot: String,
    val nextStepSnapshot: String,
    val disclaimerTextSnapshot: String,
    val subjectNameSnapshot: String,
    val dateOfBirthSnapshot: LocalDate,
    val ageMonths: Int,
    val correctedAgeMonths: Int?,
    val generatedAt: Instant,
    val domains: List<ScreeningResultDomainResponse>,
    val reasons: List<ScreeningResultReasonResponse>,
    val items: List<ScreeningResultItemResponse>,
)

sealed interface ScreeningCompletionOutcome {
    data class Incomplete(val sessionId: UUID, val missingRequiredQuestionIds: List<UUID>) : ScreeningCompletionOutcome
    data class Completed(val result: ScreeningResultResponse) : ScreeningCompletionOutcome
}

private object ScreeningResultTextKeys {
    const val QUESTION_LABEL = "question.label"
    const val CHOICE_LABEL = "choice.label"
    const val DISCLAIMER = "disclaimer.v1"

    fun statusPrefix(status: ScreeningResultMainStatus) = "result.status.${status.name}"
    fun reason(reasonCode: String) = "result.reason.$reasonCode"
}

/**
 * Completes a Parent-owned screening session only when the complete, reviewed
 * catalog can be snapshotted. No result is written for incomplete answers or
 * missing narrative text; this prevents an empty result from looking valid.
 */
@Service
class ScreeningCompletionService(
    private val identity: IdentityService,
    private val sessions: ScreeningSessionRepository,
    private val templates: ScreeningTemplateRepository,
    private val answers: ScreeningAnswerRepository,
    private val questions: ScreeningQuestionRepository,
    private val choices: ScreeningChoiceRepository,
    private val rules: ScreeningRuleSetRepository,
    private val triggers: ScreeningRuleTriggerRepository,
    private val catalogTexts: ScreeningCatalogTextRepository,
    private val results: ScreeningResultRepository,
    private val resultDomains: ScreeningResultDomainRepository,
    private val resultReasons: ScreeningResultReasonRepository,
    private val resultItems: ScreeningResultItemRepository,
    private val evaluator: ScreeningEvaluationService,
) {
    @Transactional
    fun complete(jwt: Jwt, sessionId: UUID): ScreeningCompletionOutcome {
        val parent = requireRegisteredParent(identity.sync(jwt))
        val session = sessions.findByIdAndOwnerUserId(sessionId, parent.id)
            ?: throw IllegalArgumentException("Screening session was not found")
        if (session.status == ScreeningSessionStatus.COMPLETED) {
            val existing = results.findBySessionId(session.id)
                ?: throw IllegalStateException("Completed screening session has no result")
            return ScreeningCompletionOutcome.Completed(loadResponse(existing))
        }
        ensureWritable(session)
        val prepared = prepare(session)
        val evaluation = evaluator.evaluate(prepared.evaluationRuleSet, prepared.evaluationAnswers)
        if (!evaluation.complete) {
            return ScreeningCompletionOutcome.Incomplete(session.id, evaluation.missingRequiredQuestionIds)
        }
        val mainStatus = evaluation.mainStatus ?: throw IllegalStateException("Complete screening evaluation has no status")
        val resultTexts = prepareResultTexts(session, mainStatus, evaluation.reasons)
        val now = Instant.now()
        val result = results.save(
            ScreeningResult(
                sessionId = session.id,
                templateId = prepared.template.id,
                templateCode = prepared.template.code,
                templateVersion = prepared.template.version,
                ruleVersion = prepared.databaseRuleSet.version,
                locale = session.locale,
                mainStatus = mainStatus,
                completenessStatus = "COMPLETE",
                disclaimerVersion = "v1",
                statusTitleSnapshot = resultTexts.statusTitle,
                statusSummarySnapshot = resultTexts.statusSummary,
                nextStepSnapshot = resultTexts.nextStep,
                disclaimerTextSnapshot = resultTexts.disclaimer,
                subjectNameSnapshot = session.subjectNameSnapshot,
                dateOfBirthSnapshot = session.dateOfBirthSnapshot,
                ageMonths = session.ageMonths,
                correctedAgeMonths = session.correctedAgeMonths,
                generatedAt = now,
                createdAt = now,
            ),
        )
        val domains = buildDomains(result.id, prepared)
        val reasons = evaluation.reasons.mapIndexed { index, reason ->
            ScreeningResultReason(
                resultId = result.id,
                reasonCode = reason.code,
                questionId = reason.questionId,
                answerId = reason.answerId,
                stableQuestionId = reason.stableQuestionId,
                answerCode = reason.answerCode,
                domainCode = reason.domainCode,
                textSnapshot = resultTexts.reasonTexts.getValue(reason.code.name),
                displayOrder = index,
            )
        }
        val items = prepared.questions.mapIndexed { index, question ->
            val answer = prepared.answerByQuestionId[question.id]
            val answerChoices = answer?.let { prepared.choiceByQuestionAndCodeForQuestion[question.id].orEmpty().filter { choice -> it.answerCode.split(',').contains(choice.code) } }
            ScreeningResultItem(
                resultId = result.id,
                questionId = question.id,
                answerId = answer?.id,
                stableQuestionId = question.stableQuestionId,
                domainCode = question.domain,
                questionTextSnapshot = prepared.questionTexts.getValue(question.id),
                answerCode = answer?.answerCode,
                answerLabelSnapshot = answerChoices?.takeIf { it.isNotEmpty() }?.joinToString(", ") { choice -> prepared.choiceTexts.getValue(choice.id) },
                noteSnapshot = answer?.note,
                displayOrder = index,
            )
        }
        resultDomains.saveAll(domains)
        resultReasons.saveAll(reasons)
        resultItems.saveAll(items)
        session.status = ScreeningSessionStatus.COMPLETED
        session.completedAt = now
        session.updatedAt = now
        sessions.save(session)
        return ScreeningCompletionOutcome.Completed(toResponse(result, domains, reasons, items))
    }

    @Transactional(readOnly = true)
    fun result(jwt: Jwt, sessionId: UUID): ScreeningResultResponse {
        val parent = requireRegisteredParent(identity.sync(jwt))
        val session = sessions.findByIdAndOwnerUserId(sessionId, parent.id)
            ?: throw IllegalArgumentException("Screening session was not found")
        check(session.status == ScreeningSessionStatus.COMPLETED) { "Screening result is not available" }
        val result = results.findBySessionId(session.id)
            ?: throw IllegalStateException("Completed screening session has no result")
        return loadResponse(result)
    }

    private fun prepare(session: ScreeningSession): PreparedScreening = run {
        val template = templates.findById(session.templateId).orElseThrow { IllegalStateException("Screening template was not found") }
        check(template.status == ScreeningTemplateStatus.PUBLISHED || template.status == ScreeningTemplateStatus.RETIRED) { "Screening template is not available for an existing session" }
        check(template.code == session.templateCode && template.version == session.templateVersion) { "Screening session template snapshot does not match catalog" }
        val ruleSetId = template.ruleSetId ?: throw IllegalStateException("Screening template has no evaluation rule set")
        check(template.ruleVersion > 0) { "Screening template rule version is invalid" }
        val ruleSet = rules.findById(ruleSetId).orElseThrow { IllegalStateException("Screening evaluation rule set was not found") }
        check(ruleSet.status == ScreeningRuleSetStatus.PUBLISHED || ruleSet.status == ScreeningRuleSetStatus.RETIRED) { "Screening evaluation rule set is not available for an existing session" }
        check(ruleSet.version == template.ruleVersion) { "Screening template rule version does not match rule set" }
        val templateQuestions = questions.findAllByTemplateIdOrderByDisplayOrderAsc(template.id)
        require(templateQuestions.isNotEmpty()) { "Screening template has no questions" }
        require(templateQuestions.any { it.required }) { "Screening template has no required questions" }
        require(templateQuestions.all { it.reviewStatus == ScreeningReviewStatus.APPROVED }) { "Screening template contains unreviewed questions" }
        val questionIds = templateQuestions.map { it.id }
        val templateChoices = choices.findAllByQuestionIdIn(questionIds)
        require(templateQuestions.all { question -> templateChoices.any { it.questionId == question.id && it.enabled } }) { "Screening template contains a question without an enabled choice" }
        val sessionAnswers = answers.findAllBySessionIdOrderByAnsweredAtAscIdAsc(session.id)
        require(sessionAnswers.map { it.questionId }.distinct().size == sessionAnswers.size) { "Screening session contains duplicate answers" }
        val questionById = templateQuestions.associateBy { it.id }
        require(sessionAnswers.all { answer -> questionById[answer.questionId] != null }) { "Screening session contains an answer from another template" }
        val choiceByQuestionAndCode = templateChoices.associateBy { it.questionId to it.code }
        val choiceByQuestion = templateChoices.groupBy { it.questionId }
        require(sessionAnswers.all { answer -> answer.answerCode.split(',').all { code -> choiceByQuestionAndCode[answer.questionId to code]?.enabled == true } }) { "Screening session contains an unavailable answer" }
        val requiredQuestionIds = templateQuestions.filter { it.required }.map { it.id }.toSet()
        val evaluationAnswers = sessionAnswers.map { answer ->
            val question = questionById.getValue(answer.questionId)
            ScreeningEvaluationAnswer(answer.id, question.id, question.stableQuestionId, question.domain, answer.answerCode, question.required, answer.contextCode)
        }
        val evaluationRuleSet = ruleSet.toEvaluationRuleSet(
            triggers.findAllByRuleSetIdAndEnabledTrueOrderByDisplayOrderAsc(ruleSet.id),
            requiredQuestionIds,
        )
        val questionTexts = requireTexts(ScreeningCatalogResourceType.QUESTION, questionIds, session.locale, ScreeningResultTextKeys.QUESTION_LABEL)
        val choiceTexts = requireTexts(ScreeningCatalogResourceType.CHOICE, templateChoices.map { it.id }, session.locale, ScreeningResultTextKeys.CHOICE_LABEL)
        PreparedScreening(template, ruleSet, templateQuestions, sessionAnswers.associateBy { it.questionId }, choiceByQuestionAndCode, choiceByQuestion, evaluationAnswers, evaluationRuleSet, questionTexts, choiceTexts)
    }

    private fun prepareResultTexts(session: ScreeningSession, status: ScreeningResultMainStatus, reasons: List<ScreeningEvaluationReason>): PreparedResultTexts {
        val texts = catalogTexts.findAllByResourceTypeAndResourceIdInAndLocale(ScreeningCatalogResourceType.TEMPLATE, listOf(session.templateId), session.locale)
            .associateBy { it.textKey }
        fun required(key: String): String = texts[key]?.textValue?.trim()?.takeIf(String::isNotBlank)
            ?: throw IllegalStateException("Screening result narrative is incomplete")
        val prefix = ScreeningResultTextKeys.statusPrefix(status)
        val reasonTexts = reasons.map { it.code.name }.distinct().associateWith { code -> required(ScreeningResultTextKeys.reason(code)) }
        return PreparedResultTexts(
            statusTitle = required("$prefix.title"),
            statusSummary = required("$prefix.summary"),
            nextStep = required("$prefix.next_step"),
            disclaimer = required(ScreeningResultTextKeys.DISCLAIMER),
            reasonTexts = reasonTexts,
        )
    }

    private fun requireTexts(resourceType: ScreeningCatalogResourceType, resourceIds: Collection<UUID>, locale: String, textKey: String): Map<UUID, String> {
        val rows = catalogTexts.findAllByResourceTypeAndResourceIdInAndLocale(resourceType, resourceIds, locale)
        val matching = rows.filter { it.textKey == textKey }
        require(matching.map { it.resourceId }.distinct().size == matching.size) { "Screening catalog contains duplicate text" }
        return resourceIds.associateWith { resourceId ->
            matching.firstOrNull { it.resourceId == resourceId }?.textValue?.trim()?.takeIf(String::isNotBlank)
                ?: throw IllegalStateException("Screening catalog text is incomplete")
        }
    }

    private fun buildDomains(resultId: UUID, prepared: PreparedScreening): List<ScreeningResultDomain> = prepared.questions
        .groupBy { it.domain }
        .entries
        .mapIndexedNotNull { index, (domain, domainQuestions) ->
            val domainAnswers = domainQuestions.mapNotNull { prepared.answerByQuestionId[it.id] }
            if (domainAnswers.isEmpty()) return@mapIndexedNotNull null
            val matchedStatuses = prepared.evaluationRuleSet.triggers
                .filter { it.enabled && it.domainCode == domain }
                .filter { trigger -> domainAnswers.any { answer -> trigger.matches(answer.toEvaluationAnswer(domainQuestions.first { it.id == answer.questionId })) } }
                .mapNotNull { it.outputStatus }
            val fallbackStatus = when {
                domainAnswers.any { it.hasAnswerCode(ScreeningAnswerCode.TIDAK_DIAMATI.name) || it.hasAnswerCode("TIDAK_YAKIN") } -> ScreeningResultMainStatus.PENGAMATAN_BELUM_CUKUP
                domainAnswers.any { it.hasAnswerCode(ScreeningAnswerCode.KADANG.name) || it.hasAnswerCode(ScreeningAnswerCode.BELUM.name) } -> ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN
                domainAnswers.all { it.hasAnswerCode(ScreeningAnswerCode.YA_SUDAH.name) } -> ScreeningResultMainStatus.KEMAMPUAN_DILAPORKAN_TERLIHAT
                else -> ScreeningResultMainStatus.PENGAMATAN_BELUM_CUKUP
            }
            ScreeningResultDomain(
                resultId = resultId,
                domainCode = domain,
                statusCode = matchedStatuses.maxByOrNull(::screeningResultStatusRank) ?: fallbackStatus,
                observedCount = domainAnswers.count { !it.hasAnswerCode(ScreeningAnswerCode.TIDAK_DIAMATI.name) && !it.hasAnswerCode("TIDAK_YAKIN") },
                incompleteCount = domainQuestions.count { prepared.answerByQuestionId[it.id] == null || prepared.answerByQuestionId[it.id]?.hasAnswerCode(ScreeningAnswerCode.TIDAK_DIAMATI.name) == true || prepared.answerByQuestionId[it.id]?.hasAnswerCode("TIDAK_YAKIN") == true },
                attentionCount = domainAnswers.count { it.hasAnswerCode(ScreeningAnswerCode.KADANG.name) || it.hasAnswerCode(ScreeningAnswerCode.BELUM.name) },
                displayOrder = index,
            )
        }

    private fun ScreeningAnswer.toEvaluationAnswer(question: ScreeningQuestion): ScreeningEvaluationAnswer = ScreeningEvaluationAnswer(id, question.id, question.stableQuestionId, question.domain, answerCode, question.required, contextCode)

    private fun loadResponse(result: ScreeningResult): ScreeningResultResponse = toResponse(
        result,
        resultDomains.findAllByResultIdOrderByDisplayOrderAsc(result.id),
        resultReasons.findAllByResultIdOrderByDisplayOrderAsc(result.id),
        resultItems.findAllByResultIdOrderByDisplayOrderAsc(result.id),
    )

    private fun toResponse(result: ScreeningResult, domains: List<ScreeningResultDomain>, reasons: List<ScreeningResultReason>, items: List<ScreeningResultItem>) = ScreeningResultResponse(
        id = result.id,
        sessionId = result.sessionId,
        templateCode = result.templateCode,
        templateVersion = result.templateVersion,
        ruleVersion = result.ruleVersion,
        locale = result.locale,
        mainStatus = result.mainStatus,
        completenessStatus = result.completenessStatus,
        disclaimerVersion = result.disclaimerVersion,
        statusTitleSnapshot = result.statusTitleSnapshot,
        statusSummarySnapshot = result.statusSummarySnapshot,
        nextStepSnapshot = result.nextStepSnapshot,
        disclaimerTextSnapshot = result.disclaimerTextSnapshot,
        subjectNameSnapshot = result.subjectNameSnapshot,
        dateOfBirthSnapshot = result.dateOfBirthSnapshot,
        ageMonths = result.ageMonths,
        correctedAgeMonths = result.correctedAgeMonths,
        generatedAt = result.generatedAt,
        domains = domains.map { ScreeningResultDomainResponse(it.domainCode, it.statusCode, it.observedCount, it.incompleteCount, it.attentionCount, it.displayOrder) },
        reasons = reasons.map { reason ->
            val item = items.firstOrNull { it.answerId != null && it.answerId == reason.answerId }
                ?: items.firstOrNull { it.questionId == reason.questionId }
            ScreeningResultReasonResponse(
                reason.reasonCode.name,
                reason.questionId,
                reason.answerId,
                reason.stableQuestionId,
                reason.answerCode,
                reason.domainCode,
                reason.textSnapshot,
                reason.displayOrder,
                item?.questionTextSnapshot,
                item?.answerLabelSnapshot,
            )
        },
        items = items.map { ScreeningResultItemResponse(it.questionId, it.answerId, it.stableQuestionId, it.domainCode, it.questionTextSnapshot, it.answerCode, it.answerLabelSnapshot, it.noteSnapshot, it.displayOrder) },
    )

    private fun ensureWritable(session: ScreeningSession) {
        if (session.status == ScreeningSessionStatus.EXPIRED || !session.expiresAt.isAfter(Instant.now())) {
            session.status = ScreeningSessionStatus.EXPIRED
            session.updatedAt = Instant.now()
            sessions.save(session)
            throw IllegalStateException("Screening session has expired")
        }
        check(session.status == ScreeningSessionStatus.DRAFT || session.status == ScreeningSessionStatus.IN_PROGRESS) { "Screening session cannot be completed" }
    }

    private data class PreparedResultTexts(
        val statusTitle: String,
        val statusSummary: String,
        val nextStep: String,
        val disclaimer: String,
        val reasonTexts: Map<String, String>,
    )

    private data class PreparedScreening(
        val template: com.daycare.api.persistence.ScreeningTemplate,
        val databaseRuleSet: com.daycare.api.persistence.ScreeningRuleSet,
        val questions: List<ScreeningQuestion>,
        val answerByQuestionId: Map<UUID, ScreeningAnswer>,
        val choiceByQuestionAndCode: Map<Pair<UUID, String>, ScreeningChoice>,
        val choiceByQuestionAndCodeForQuestion: Map<UUID, List<ScreeningChoice>>,
        val evaluationAnswers: List<ScreeningEvaluationAnswer>,
        val evaluationRuleSet: ScreeningEvaluationRuleSet,
        val questionTexts: Map<UUID, String>,
        val choiceTexts: Map<UUID, String>,
    )
}

private fun ScreeningAnswer.hasAnswerCode(code: String): Boolean = answerCode.split(',').any { it == code }
