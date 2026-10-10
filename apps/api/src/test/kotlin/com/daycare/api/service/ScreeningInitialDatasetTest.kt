package com.daycare.api.service

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class ScreeningInitialDatasetTest {
    @Test
    fun `initial package is deterministic draft sized and internally referenced`() {
        val first = ScreeningInitialDataset.definition("test")
        val second = ScreeningInitialDataset.definition("test")

        assertEquals(first, second)
        assertEquals(12, first.templates.size)
        assertEquals(238, first.questions.size)
        assertEquals(964, first.choices.size)
        assertEquals(12, first.ruleSets.size)
        assertEquals(24, first.ruleTriggers.size)
        assertTrue(first.templates.all { it.ruleSetId in first.ruleSets.map { rule -> rule.id } })
        assertTrue(first.questions.all { question -> question.templateId in first.templates.map { it.id } })
        assertTrue(first.choices.all { choice -> choice.questionId in first.questions.map { it.id } })
        assertTrue(first.questions.filter { it.stableQuestionId == "CTX-03" || it.stableQuestionId == "CTX-04" }.all { it.answerType == com.daycare.api.domain.ScreeningQuestionAnswerType.MULTI_CHOICE })
    }
}
