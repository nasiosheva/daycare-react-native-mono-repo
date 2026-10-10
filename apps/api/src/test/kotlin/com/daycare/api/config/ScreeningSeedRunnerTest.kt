package com.daycare.api.config

import com.daycare.api.service.ScreeningInitialDataset
import com.daycare.api.service.ScreeningSeedBatchApplyStatus
import com.daycare.api.service.ScreeningSeedBatchResult
import com.daycare.api.service.ScreeningSeedBatchService
import com.daycare.api.service.ScreeningSeedBatchDefinition
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`

class ScreeningSeedRunnerTest {
    private val seed = mock(ScreeningSeedBatchService::class.java)
    private val runner = ScreeningSeedRunner(seed)

    @Test
    fun `operator configuration validates batch and operator and supports preview`() {
        assertThrows(IllegalArgumentException::class.java) { runner.runWithConfiguration("wrong", false, "operator") }
        assertThrows(IllegalArgumentException::class.java) { runner.runWithConfiguration(ScreeningInitialDataset.BATCH_ID, false, " ") }
        val result = ScreeningSeedBatchResult(ScreeningSeedBatchApplyStatus.PREVIEW, ScreeningInitialDataset.BATCH_ID, 1, 2, 3, 4)
        val expected = ScreeningInitialDataset.definition("operator")
        `when`(seed.preview(expected)).thenReturn(result)

        runner.runWithConfiguration(" ${ScreeningInitialDataset.BATCH_ID} ", false, " operator ")

        verify(seed).preview(expected)
    }

    @Test
    fun `operator configuration can explicitly apply the approved package`() {
        val result = ScreeningSeedBatchResult(ScreeningSeedBatchApplyStatus.APPLIED, ScreeningInitialDataset.BATCH_ID, 1, 2, 3, 4)
        val expected = ScreeningInitialDataset.definition("operator")
        `when`(seed.apply(expected)).thenReturn(result)

        runner.runWithConfiguration(ScreeningInitialDataset.BATCH_ID, true, "operator")

        verify(seed).apply(expected)
    }
}
