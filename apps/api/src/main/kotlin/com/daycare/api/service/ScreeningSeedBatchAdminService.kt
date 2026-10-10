package com.daycare.api.service

import com.daycare.api.persistence.ScreeningSeedManifestRepository
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

enum class ScreeningSeedBatchAdminStatus { AVAILABLE, APPLIED }

data class ScreeningSeedBatchAdminResponse(
    val batchId: String,
    val seedVersion: String,
    val checksum: String,
    val status: ScreeningSeedBatchAdminStatus,
    val templateCount: Int,
    val questionCount: Int,
    val choiceCount: Int,
    val translationCount: Int,
    val appliedBy: String? = null,
    val appliedAt: Instant? = null,
)

data class ScreeningSeedBatchApplyRequest(
    @field:jakarta.validation.constraints.Pattern(regexp = "APPLY", message = "Type APPLY to confirm the seed batch")
    val confirmation: String,
)

/**
 * Platform-Admin-only facade for the approved, code-bundled screening batch.
 * The browser can select a batch but cannot provide its contents or checksum.
 */
@Service
class ScreeningSeedBatchAdminService(
    private val platform: PlatformAccessService,
    private val seed: ScreeningSeedBatchService,
    private val manifests: ScreeningSeedManifestRepository,
) {
    @Transactional(readOnly = true)
    fun list(jwt: Jwt): List<ScreeningSeedBatchAdminResponse> {
        platform.requirePlatformAdmin(jwt)
        return listOf(metadata())
    }

    @Transactional(readOnly = true)
    fun preview(jwt: Jwt, batchId: String): ScreeningSeedBatchAdminResponse {
        val admin = platform.requirePlatformAdmin(jwt)
        val definition = definition(batchId, admin)
        seed.preview(definition)
        return response(definition.batchId)
    }

    @Transactional
    fun apply(jwt: Jwt, batchId: String, request: ScreeningSeedBatchApplyRequest): ScreeningSeedBatchAdminResponse {
        val admin = platform.requirePlatformAdmin(jwt)
        require(request.confirmation == "APPLY") { "Type APPLY to confirm the seed batch" }
        val definition = definition(batchId, admin)
        seed.apply(definition)
        return response(definition.batchId)
    }

    private fun definition(batchId: String, admin: com.daycare.api.persistence.UserProfile): ScreeningSeedBatchDefinition {
        require(batchId == ScreeningInitialDataset.BATCH_ID) { "Unknown screening seed batch" }
        val actor = "platform-admin:${admin.email ?: admin.username ?: admin.id}"
        return ScreeningInitialDataset.definition(actor)
    }

    private fun metadata(): ScreeningSeedBatchAdminResponse {
        val definition = ScreeningInitialDataset.definition("platform-admin:preview")
        return response(definition.batchId)
    }

    private fun response(batchId: String): ScreeningSeedBatchAdminResponse {
        val definition = ScreeningInitialDataset.definition("platform-admin:preview")
        require(definition.batchId == batchId) { "Unknown screening seed batch" }
        val manifest = manifests.findByBatchId(batchId)
        return ScreeningSeedBatchAdminResponse(
            batchId = definition.batchId,
            seedVersion = definition.seedVersion,
            checksum = definition.checksum,
            status = if (manifest == null) ScreeningSeedBatchAdminStatus.AVAILABLE else ScreeningSeedBatchAdminStatus.APPLIED,
            templateCount = definition.templates.size,
            questionCount = definition.questions.size,
            choiceCount = definition.choices.size,
            translationCount = definition.texts.size,
            appliedBy = manifest?.appliedBy,
            appliedAt = manifest?.appliedAt,
        )
    }
}
