package com.daycare.api.service

import com.daycare.api.domain.ScreeningAnswerCode
import com.daycare.api.domain.ScreeningResultMainStatus
import com.daycare.api.domain.ScreeningResultReasonCode
import com.daycare.api.domain.ScreeningRuleTriggerKind
import com.daycare.api.domain.ScreeningRuleSetStatus
import com.daycare.api.domain.ScreeningReviewStatus
import com.daycare.api.persistence.ScreeningRuleSet
import com.daycare.api.persistence.ScreeningRuleTrigger
import org.springframework.stereotype.Service
import java.util.UUID

data class ScreeningEvaluationAnswer(
    val answerId: UUID,
    val questionId: UUID,
    val stableQuestionId: String,
    val domainCode: String,
    val answerCode: String,
    val required: Boolean,
    val contextCode: String? = null,
)

data class ScreeningEvaluationTrigger(
    val id: UUID,
    val kind: ScreeningRuleTriggerKind,
    val priority: Int,
    val stableQuestionId: String? = null,
    val answerCode: String? = null,
    val contextCode: String? = null,
    val outputStatus: ScreeningResultMainStatus? = null,
    val reasonCode: ScreeningResultReasonCode? = null,
    val domainCode: String? = null,
    val enabled: Boolean = true,
)

data class ScreeningEvaluationRuleSet(
    val code: String,
    val version: Int,
    val triggers: List<ScreeningEvaluationTrigger>,
    val requiredQuestionIds: Set<UUID> = emptySet(),
)

data class ScreeningEvaluationReason(
    val code: ScreeningResultReasonCode,
    val answerId: UUID?,
    val questionId: UUID?,
    val stableQuestionId: String?,
    val answerCode: String?,
    val domainCode: String?,
)

data class ScreeningEvaluationResult(
    val complete: Boolean,
    val mainStatus: ScreeningResultMainStatus?,
    val reasons: List<ScreeningEvaluationReason>,
    val missingRequiredQuestionIds: List<UUID>,
)

fun ScreeningRuleSet.toEvaluationRuleSet(triggers: List<ScreeningRuleTrigger>, requiredQuestionIds: Set<UUID>): ScreeningEvaluationRuleSet {
    require(status == ScreeningRuleSetStatus.PUBLISHED || status == ScreeningRuleSetStatus.RETIRED) { "Screening rule set is not available for an existing session" }
    require(reviewStatus == ScreeningReviewStatus.APPROVED) { "Screening rule set has not passed review" }
    return ScreeningEvaluationRuleSet(
        code = code,
        version = version,
        requiredQuestionIds = requiredQuestionIds,
        triggers = triggers.map {
            ScreeningEvaluationTrigger(
                id = it.id,
                kind = it.triggerKind,
                priority = it.priority,
                stableQuestionId = it.stableQuestionId,
                answerCode = it.answerCode,
                contextCode = it.contextCode,
                outputStatus = it.outputStatus,
                reasonCode = it.reasonCode,
                domainCode = it.domainCode,
                enabled = it.enabled,
            )
        },
    )
}

/**
 * Deterministic, non-diagnostic evaluator. It consumes typed rule records and
 * answer snapshots; it never executes expressions, SQL, scripts, or client
 * supplied text as a rule.
 */
// Mories Deo Hutapea,S.E.,S.Kom
@Service
class ScreeningEvaluationService {
    fun evaluate(ruleSet: ScreeningEvaluationRuleSet, answers: List<ScreeningEvaluationAnswer>): ScreeningEvaluationResult {
        validateRuleSet(ruleSet)
        validateAnswers(answers)
        val missingRequired = ruleSet.requiredQuestionIds.filter { requiredId -> answers.none { it.questionId == requiredId } }
        if (missingRequired.isNotEmpty()) return ScreeningEvaluationResult(false, null, emptyList(), missingRequired)

        val matched = ruleSet.triggers.asSequence()
            .filter { it.enabled }
            .filter { trigger -> answers.any { answer -> trigger.matches(answer) } }
            .sortedWith(compareByDescending<ScreeningEvaluationTrigger> { screeningResultStatusRank(it.outputStatus) }.thenByDescending { it.priority }.thenBy { it.id })
            .toList()
        val explicitStatus = matched.mapNotNull { it.outputStatus }.maxByOrNull(::screeningResultStatusRank)
        val fallbackStatus = when {
            answers.any { it.hasAnswerCode(ScreeningAnswerCode.TIDAK_DIAMATI.name) || it.hasAnswerCode("TIDAK_YAKIN") } -> ScreeningResultMainStatus.PENGAMATAN_BELUM_CUKUP
            answers.any { it.hasAnswerCode(ScreeningAnswerCode.KADANG.name) || it.hasAnswerCode(ScreeningAnswerCode.BELUM.name) } -> ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN
            answers.filter { it.required }.all { it.hasAnswerCode(ScreeningAnswerCode.YA_SUDAH.name) } -> ScreeningResultMainStatus.KEMAMPUAN_DILAPORKAN_TERLIHAT
            else -> ScreeningResultMainStatus.PENGAMATAN_BELUM_CUKUP
        }
        val reasons = matched.mapNotNull { trigger ->
            val answer = answers.firstOrNull { trigger.matches(it) }
            trigger.reasonCode?.let { reason ->
                ScreeningEvaluationReason(reason, answer?.answerId, answer?.questionId, answer?.stableQuestionId, answer?.answerCode, trigger.domainCode ?: answer?.domainCode)
            }
        }.distinctBy { listOf(it.code, it.answerId, it.questionId) }
        val fallbackReasons = buildList {
            answers.filter { it.hasAnswerCode(ScreeningAnswerCode.KADANG.name) || it.hasAnswerCode(ScreeningAnswerCode.BELUM.name) }
                .filter { answer -> reasons.none { it.code == ScreeningResultReasonCode.DISKUSIKAN_BUTIR_PERKEMBANGAN && it.answerId == answer.answerId } }
                .forEach { answer -> add(ScreeningEvaluationReason(ScreeningResultReasonCode.DISKUSIKAN_BUTIR_PERKEMBANGAN, answer.answerId, answer.questionId, answer.stableQuestionId, answer.answerCode, answer.domainCode)) }
            answers.filter { it.hasAnswerCode(ScreeningAnswerCode.TIDAK_DIAMATI.name) || it.hasAnswerCode("TIDAK_YAKIN") }
                .filter { answer -> reasons.none { it.code == ScreeningResultReasonCode.OBSERVASI_BELUM_CUKUP && it.answerId == answer.answerId } }
                .forEach { answer -> add(ScreeningEvaluationReason(ScreeningResultReasonCode.OBSERVASI_BELUM_CUKUP, answer.answerId, answer.questionId, answer.stableQuestionId, answer.answerCode, answer.domainCode)) }
        }
        return ScreeningEvaluationResult(true, explicitStatus ?: fallbackStatus, reasons + fallbackReasons, emptyList())
    }

    private fun validateRuleSet(ruleSet: ScreeningEvaluationRuleSet) {
        require(ruleSet.code.isNotBlank() && ruleSet.version > 0) { "Screening rule set metadata is invalid" }
        require(ruleSet.requiredQuestionIds.size == ruleSet.requiredQuestionIds.distinct().size) { "Screening rule set contains duplicate required question IDs" }
        require(ruleSet.triggers.map { it.id }.distinct().size == ruleSet.triggers.size) { "Screening rule set contains duplicate trigger IDs" }
        ruleSet.triggers.forEach { trigger ->
            require(trigger.priority >= 0) { "Screening rule trigger priority is invalid" }
            when (trigger.kind) {
                // A null question scope is the reviewed, typed global fallback
                // used by the seeded developmental rules (for example BELUM).
                ScreeningRuleTriggerKind.ANSWER -> require(!trigger.answerCode.isNullOrBlank() && trigger.contextCode == null) { "Answer trigger must use an answer code" }
                ScreeningRuleTriggerKind.CONTEXT -> require(!trigger.contextCode.isNullOrBlank()) { "Context trigger must use a context code" }
            }
            require(trigger.outputStatus != null || trigger.reasonCode != null) { "Screening rule trigger must produce a typed status or reason" }
        }
    }

    private fun validateAnswers(answers: List<ScreeningEvaluationAnswer>) {
        require(answers.map { it.questionId }.distinct().size == answers.size) { "Screening session contains duplicate question answers" }
        require(answers.all { it.stableQuestionId.isNotBlank() && it.domainCode.isNotBlank() && it.answerCode.isNotBlank() }) { "Screening answer snapshot is invalid" }
    }

}

internal fun ScreeningEvaluationTrigger.matches(answer: ScreeningEvaluationAnswer): Boolean = when (kind) {
    ScreeningRuleTriggerKind.ANSWER -> (stableQuestionId == null || stableQuestionId == answer.stableQuestionId) && answerCode?.let(answer.answerCode::containsCode) == true
    ScreeningRuleTriggerKind.CONTEXT -> (stableQuestionId == null || stableQuestionId == answer.stableQuestionId) && contextCode == answer.contextCode
}

internal fun ScreeningEvaluationAnswer.hasAnswerCode(code: String): Boolean = answerCode.containsCode(code)

private fun String.containsCode(code: String): Boolean = split(',').any { it == code }

internal fun screeningResultStatusRank(status: ScreeningResultMainStatus?): Int = when (status) {
    ScreeningResultMainStatus.SEGERA_DISKUSIKAN -> 4
    ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN -> 3
    ScreeningResultMainStatus.PENGAMATAN_BELUM_CUKUP -> 2
    ScreeningResultMainStatus.KEMAMPUAN_DILAPORKAN_TERLIHAT -> 1
    null -> 0
}
