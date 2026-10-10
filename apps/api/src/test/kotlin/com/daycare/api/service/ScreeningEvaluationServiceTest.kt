package com.daycare.api.service

import com.daycare.api.domain.ScreeningAnswerCode
import com.daycare.api.domain.ScreeningResultMainStatus
import com.daycare.api.domain.ScreeningResultReasonCode
import com.daycare.api.domain.ScreeningRuleTriggerKind
import com.daycare.api.domain.ScreeningRuleSetStatus
import com.daycare.api.domain.ScreeningReviewStatus
import com.daycare.api.persistence.ScreeningRuleSet
import com.daycare.api.persistence.ScreeningRuleTrigger
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import java.util.UUID

class ScreeningEvaluationServiceTest {
    // Mories Deo Hutapea,S.E.,S.Kom
    private val service = ScreeningEvaluationService()
    private val emptyRules = ScreeningEvaluationRuleSet("development-v1", 1, emptyList())

    @Test
    fun `all required yes produces reported visible status`() {
        val result = service.evaluate(emptyRules, listOf(answer("YA_SUDAH"), answer("YA_SUDAH")))

        assertTrue(result.complete)
        assertEquals(ScreeningResultMainStatus.KEMAMPUAN_DILAPORKAN_TERLIHAT, result.mainStatus)
    }

    @Test
    fun `not observed produces incomplete observation status with source`() {
        val source = answer(ScreeningAnswerCode.TIDAK_DIAMATI.name)
        val result = service.evaluate(emptyRules, listOf(source))

        assertEquals(ScreeningResultMainStatus.PENGAMATAN_BELUM_CUKUP, result.mainStatus)
        assertEquals(ScreeningResultReasonCode.OBSERVASI_BELUM_CUKUP, result.reasons.single().code)
        assertEquals(source.answerId, result.reasons.single().answerId)
    }

    @Test
    fun `sometimes and not yet answers produce traceable developmental reasons`() {
        val sometimes = answer(ScreeningAnswerCode.KADANG.name)
        val notYet = answer(ScreeningAnswerCode.BELUM.name)

        val result = service.evaluate(emptyRules, listOf(sometimes, notYet))

        assertEquals(ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN, result.mainStatus)
        assertEquals(setOf(sometimes.answerId, notYet.answerId), result.reasons.mapNotNull { it.answerId }.toSet())
        assertTrue(result.reasons.all { it.code == ScreeningResultReasonCode.DISKUSIKAN_BUTIR_PERKEMBANGAN })
    }

    @Test
    fun `explicit higher priority trigger wins while reasons remain additive`() {
        val source = answer(ScreeningAnswerCode.YA_SUDAH.name)
        val rules = ScreeningEvaluationRuleSet(
            "development-v1",
            1,
            listOf(
                ScreeningEvaluationTrigger(UUID.randomUUID(), ScreeningRuleTriggerKind.ANSWER, 1, "Q1", "YA_SUDAH", outputStatus = ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN, reasonCode = ScreeningResultReasonCode.DISKUSIKAN_BUTIR_PERKEMBANGAN),
                ScreeningEvaluationTrigger(UUID.randomUUID(), ScreeningRuleTriggerKind.CONTEXT, 10, contextCode = "LOSS", outputStatus = ScreeningResultMainStatus.SEGERA_DISKUSIKAN, reasonCode = ScreeningResultReasonCode.SEGERA_DISKUSIKAN_KEHILANGAN_KEMAMPUAN),
            ),
        )
        val result = service.evaluate(rules, listOf(source.copy(contextCode = "LOSS")))

        assertEquals(ScreeningResultMainStatus.SEGERA_DISKUSIKAN, result.mainStatus)
        assertEquals(2, result.reasons.size)
    }

    @Test
    fun `missing required answer has no result status`() {
        val requiredQuestionId = UUID.randomUUID()
        val result = service.evaluate(emptyRules.copy(requiredQuestionIds = setOf(requiredQuestionId)), emptyList())

        assertFalse(result.complete)
        assertNull(result.mainStatus)
        assertEquals(1, result.missingRequiredQuestionIds.size)
    }

    @Test
    fun `only approved published catalog rules can be adapted`() {
        val ruleSet = ScreeningRuleSet(status = ScreeningRuleSetStatus.PUBLISHED, reviewStatus = ScreeningReviewStatus.APPROVED)
        val adapted = ruleSet.toEvaluationRuleSet(emptyList(), emptySet())

        assertEquals(ruleSet.version, adapted.version)
    }

    @Test
    fun `approved retired rules can finish an already started session`() {
        val ruleSet = ScreeningRuleSet(status = ScreeningRuleSetStatus.RETIRED, reviewStatus = ScreeningReviewStatus.APPROVED)

        val adapted = ruleSet.toEvaluationRuleSet(emptyList(), emptySet())

        assertEquals(ruleSet.version, adapted.version)
    }

    @Test
    fun `invalid rule set metadata and triggers are rejected`() {
        val answerTrigger = ScreeningEvaluationTrigger(
            UUID.randomUUID(),
            ScreeningRuleTriggerKind.ANSWER,
            priority = 0,
            stableQuestionId = "Q1",
            answerCode = "YA_SUDAH",
            outputStatus = ScreeningResultMainStatus.KEMAMPUAN_DILAPORKAN_TERLIHAT,
        )
        val contextTrigger = ScreeningEvaluationTrigger(
            UUID.randomUUID(),
            ScreeningRuleTriggerKind.CONTEXT,
            priority = 0,
            contextCode = "LOSS",
            reasonCode = ScreeningResultReasonCode.SEGERA_DISKUSIKAN_KEHILANGAN_KEMAMPUAN,
        )
        listOf(
            emptyRules.copy(code = ""),
            emptyRules.copy(version = 0),
            emptyRules.copy(triggers = listOf(answerTrigger, answerTrigger)),
            emptyRules.copy(triggers = listOf(answerTrigger.copy(priority = -1))),
            emptyRules.copy(triggers = listOf(answerTrigger.copy(answerCode = null))),
            emptyRules.copy(triggers = listOf(answerTrigger.copy(contextCode = "CTX"))),
            emptyRules.copy(triggers = listOf(contextTrigger.copy(contextCode = null))),
            emptyRules.copy(triggers = listOf(contextTrigger.copy(outputStatus = null, reasonCode = null))),
        ).forEach { invalid ->
            assertThrows(IllegalArgumentException::class.java) { service.evaluate(invalid, emptyList()) }
        }
    }

    @Test
    fun `answer snapshots reject duplicate or incomplete records`() {
        val id = UUID.randomUUID()
        val valid = ScreeningEvaluationAnswer(id, id, "Q1", "BK", "YA_SUDAH", required = true)

        assertThrows(IllegalArgumentException::class.java) { service.evaluate(emptyRules, listOf(valid, valid)) }
        assertThrows(IllegalArgumentException::class.java) { service.evaluate(emptyRules, listOf(valid.copy(stableQuestionId = ""))) }
        assertThrows(IllegalArgumentException::class.java) { service.evaluate(emptyRules, listOf(valid.copy(domainCode = ""))) }
        assertThrows(IllegalArgumentException::class.java) { service.evaluate(emptyRules, listOf(valid.copy(answerCode = ""))) }
    }

    @Test
    fun `answer and context triggers match only their scoped codes`() {
        val id = UUID.randomUUID()
        val answer = ScreeningEvaluationAnswer(id, id, "Q1", "BK", "YA_SUDAH,BELUM", required = true, contextCode = "LOSS")
        val rules = ScreeningEvaluationRuleSet(
            "rules",
            1,
            listOf(
                ScreeningEvaluationTrigger(UUID.randomUUID(), ScreeningRuleTriggerKind.ANSWER, 0, stableQuestionId = "Q1", answerCode = "YA_SUDAH", outputStatus = ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN, reasonCode = ScreeningResultReasonCode.DISKUSIKAN_BUTIR_PERKEMBANGAN),
                ScreeningEvaluationTrigger(UUID.randomUUID(), ScreeningRuleTriggerKind.ANSWER, 0, stableQuestionId = "Q2", answerCode = "YA_SUDAH", outputStatus = ScreeningResultMainStatus.SEGERA_DISKUSIKAN),
                ScreeningEvaluationTrigger(UUID.randomUUID(), ScreeningRuleTriggerKind.CONTEXT, 0, stableQuestionId = "Q1", contextCode = "OTHER", outputStatus = ScreeningResultMainStatus.SEGERA_DISKUSIKAN),
                ScreeningEvaluationTrigger(UUID.randomUUID(), ScreeningRuleTriggerKind.CONTEXT, 0, stableQuestionId = null, contextCode = "LOSS", outputStatus = ScreeningResultMainStatus.SEGERA_DISKUSIKAN, reasonCode = ScreeningResultReasonCode.SEGERA_DISKUSIKAN_KEHILANGAN_KEMAMPUAN),
            ),
        )

        val result = service.evaluate(rules, listOf(answer))

        assertEquals(ScreeningResultMainStatus.SEGERA_DISKUSIKAN, result.mainStatus)
        assertEquals(2, result.reasons.size)
    }

    @Test
    fun `fallback prefers observation over discussion and explicit status over fallback`() {
        val observation = answer(ScreeningAnswerCode.TIDAK_DIAMATI.name)
        val discussion = answer(ScreeningAnswerCode.KADANG.name)
        assertEquals(ScreeningResultMainStatus.PENGAMATAN_BELUM_CUKUP, service.evaluate(emptyRules, listOf(discussion, observation)).mainStatus)

        val explicit = ScreeningEvaluationRuleSet(
            "rules",
            1,
            listOf(ScreeningEvaluationTrigger(UUID.randomUUID(), ScreeningRuleTriggerKind.ANSWER, 0, stableQuestionId = "Q1", answerCode = ScreeningAnswerCode.TIDAK_DIAMATI.name, outputStatus = ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN)),
        )
        assertEquals(ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN, service.evaluate(explicit, listOf(observation)).mainStatus)
    }

    @Test
    fun `only published or retired approved rule sets can be adapted`() {
        listOf(
            ScreeningRuleSetStatus.DRAFT to ScreeningReviewStatus.APPROVED,
            ScreeningRuleSetStatus.PUBLISHED to ScreeningReviewStatus.NOT_REVIEWED,
        ).forEach { (status, review) ->
            assertThrows(IllegalArgumentException::class.java) {
                ScreeningRuleSet(status = status, reviewStatus = review).toEvaluationRuleSet(emptyList(), emptySet())
            }
        }
    }

    @Test
    fun `evaluator covers disabled nonmatching triggers and unknown observation code`() {
        val source = answer("TIDAK_YAKIN")
        val disabled = ScreeningEvaluationTrigger(UUID.randomUUID(), ScreeningRuleTriggerKind.ANSWER, 0, stableQuestionId = "Q1", answerCode = "YA_SUDAH", enabled = false, outputStatus = ScreeningResultMainStatus.SEGERA_DISKUSIKAN)
        val wrongAnswer = ScreeningEvaluationTrigger(UUID.randomUUID(), ScreeningRuleTriggerKind.ANSWER, 0, stableQuestionId = "Q2", answerCode = "YA_SUDAH", outputStatus = ScreeningResultMainStatus.SEGERA_DISKUSIKAN)
        val wrongContext = ScreeningEvaluationTrigger(UUID.randomUUID(), ScreeningRuleTriggerKind.CONTEXT, 0, stableQuestionId = "Q1", contextCode = "OTHER", outputStatus = ScreeningResultMainStatus.SEGERA_DISKUSIKAN)

        val result = service.evaluate(emptyRules.copy(triggers = listOf(disabled, wrongAnswer, wrongContext)), listOf(source))

        assertEquals(ScreeningResultMainStatus.PENGAMATAN_BELUM_CUKUP, result.mainStatus)
        assertEquals(ScreeningResultReasonCode.OBSERVASI_BELUM_CUKUP, result.reasons.single().code)
    }

    @Test
    fun `evaluator handles optional answers, fallback ordering and duplicate reason suppression`() {
        val yesOptional = answer("YA_SUDAH").copy(required = false)
        val context = answer("KADANG").copy(contextCode = "CTX")
        val trigger = ScreeningEvaluationTrigger(UUID.randomUUID(), ScreeningRuleTriggerKind.ANSWER, 1, stableQuestionId = context.stableQuestionId, answerCode = "KADANG", reasonCode = ScreeningResultReasonCode.DISKUSIKAN_BUTIR_PERKEMBANGAN)
        val result = service.evaluate(emptyRules.copy(triggers = listOf(trigger)), listOf(yesOptional, context))
        assertEquals(ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN, result.mainStatus)
        assertEquals(1, result.reasons.count { it.code == ScreeningResultReasonCode.DISKUSIKAN_BUTIR_PERKEMBANGAN })
    }

    @Test
    fun `typed trigger matching and status ranks cover every supported status`() {
        val id = UUID.randomUUID()
        val answer = ScreeningEvaluationAnswer(id, id, "Q1", "BK", "YA_SUDAH", true, contextCode = "CTX")
        assertTrue(ScreeningEvaluationTrigger(UUID.randomUUID(), ScreeningRuleTriggerKind.ANSWER, 0, stableQuestionId = "Q1", answerCode = "YA_SUDAH").matches(answer))
        assertTrue(ScreeningEvaluationTrigger(UUID.randomUUID(), ScreeningRuleTriggerKind.ANSWER, 0, stableQuestionId = null, answerCode = "YA_SUDAH").matches(answer))
        assertFalse(ScreeningEvaluationTrigger(UUID.randomUUID(), ScreeningRuleTriggerKind.ANSWER, 0, stableQuestionId = "Q1", answerCode = null).matches(answer))
        assertTrue(ScreeningEvaluationTrigger(UUID.randomUUID(), ScreeningRuleTriggerKind.CONTEXT, 0, stableQuestionId = null, contextCode = "CTX").matches(answer))
        assertFalse(ScreeningEvaluationTrigger(UUID.randomUUID(), ScreeningRuleTriggerKind.CONTEXT, 0, stableQuestionId = "Q2", contextCode = "CTX").matches(answer))
        assertEquals(4, screeningResultStatusRank(ScreeningResultMainStatus.SEGERA_DISKUSIKAN))
        assertEquals(3, screeningResultStatusRank(ScreeningResultMainStatus.DISKUSIKAN_PERKEMBANGAN))
        assertEquals(2, screeningResultStatusRank(ScreeningResultMainStatus.PENGAMATAN_BELUM_CUKUP))
        assertEquals(1, screeningResultStatusRank(ScreeningResultMainStatus.KEMAMPUAN_DILAPORKAN_TERLIHAT))
        assertEquals(0, screeningResultStatusRank(null))
    }

    private fun answer(code: String) = ScreeningEvaluationAnswer(
        answerId = UUID.randomUUID(),
        questionId = UUID.randomUUID(),
        stableQuestionId = "Q1",
        domainCode = "BK",
        answerCode = code,
        required = true,
    )
}
