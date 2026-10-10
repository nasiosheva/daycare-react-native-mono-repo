package com.daycare.api.web

import com.daycare.api.service.ScreeningCatalogAdminService
import com.daycare.api.service.ScreeningCatalogValidationResponse
import com.daycare.api.service.ScreeningChildProfileRequest
import com.daycare.api.service.ScreeningCompletionOutcome
import com.daycare.api.service.ScreeningParentProfileService
import com.daycare.api.service.ScreeningResultExportService
import com.daycare.api.service.ScreeningLinkedChildService
import com.daycare.api.service.ScreeningSessionService
import com.daycare.api.service.ScreeningSeedBatchAdminService
import com.daycare.api.service.ScreeningSeedBatchApplyRequest
import com.daycare.api.service.SaveScreeningAnswersRequest
import com.daycare.api.service.SaveScreeningAnswerRequest
import com.daycare.api.service.StartScreeningSessionRequest
import org.springframework.http.CacheControl
import org.springframework.http.ContentDisposition
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import jakarta.validation.Valid
import java.util.UUID

@RestController
@RequestMapping("/v1/parent/screening")
class ParentScreeningController(
    private val profiles: ScreeningParentProfileService,
    private val sessions: ScreeningSessionService,
    private val completion: com.daycare.api.service.ScreeningCompletionService,
    private val exports: ScreeningResultExportService,
    private val linkedChildren: ScreeningLinkedChildService,
) {
    @GetMapping("/profiles")
    fun profiles(@AuthenticationPrincipal jwt: Jwt) = profiles.mine(jwt)

    @GetMapping("/linked-children")
    fun linkedChildren(@AuthenticationPrincipal jwt: Jwt) = linkedChildren.mine(jwt)

    @PostMapping("/profiles") @ResponseStatus(HttpStatus.CREATED)
    fun createProfile(@AuthenticationPrincipal jwt: Jwt, @RequestBody request: ScreeningChildProfileRequest) = profiles.create(jwt, request)

    @PatchMapping("/profiles/{profileId}")
    fun updateProfile(@AuthenticationPrincipal jwt: Jwt, @PathVariable profileId: UUID, @RequestBody request: ScreeningChildProfileRequest) = profiles.update(jwt, profileId, request)

    @DeleteMapping("/profiles/{profileId}")
    fun archiveProfile(@AuthenticationPrincipal jwt: Jwt, @PathVariable profileId: UUID) = profiles.archive(jwt, profileId)

    @GetMapping("/templates")
    fun templates(@AuthenticationPrincipal jwt: Jwt) = sessions.availableTemplates(jwt)

    @GetMapping("/sessions")
    fun sessions(@AuthenticationPrincipal jwt: Jwt) = sessions.mine(jwt)

    @PostMapping("/sessions") @ResponseStatus(HttpStatus.CREATED)
    fun start(@AuthenticationPrincipal jwt: Jwt, @RequestBody request: StartScreeningSessionRequest) = sessions.start(jwt, request)

    @GetMapping("/sessions/{sessionId}/questionnaire")
    fun questionnaire(@AuthenticationPrincipal jwt: Jwt, @PathVariable sessionId: UUID) = sessions.questionnaire(jwt, sessionId)

    @GetMapping("/sessions/{sessionId}/answers")
    fun answers(@AuthenticationPrincipal jwt: Jwt, @PathVariable sessionId: UUID) = sessions.answers(jwt, sessionId)

    @PutMapping("/sessions/{sessionId}/answers")
    fun saveAnswers(@AuthenticationPrincipal jwt: Jwt, @PathVariable sessionId: UUID, @RequestBody request: SaveScreeningAnswersRequest) = sessions.saveAnswers(jwt, sessionId, request)

    @PutMapping("/sessions/{sessionId}/answer")
    fun saveAnswer(@AuthenticationPrincipal jwt: Jwt, @PathVariable sessionId: UUID, @RequestBody request: SaveScreeningAnswerRequest) = sessions.saveAnswer(jwt, sessionId, request)

    @PostMapping("/sessions/{sessionId}/complete")
    fun complete(@AuthenticationPrincipal jwt: Jwt, @PathVariable sessionId: UUID): ResponseEntity<Any> = when (val outcome = completion.complete(jwt, sessionId)) {
        is ScreeningCompletionOutcome.Incomplete -> ResponseEntity.ok(outcome)
        is ScreeningCompletionOutcome.Completed -> ResponseEntity.ok(outcome.result)
    }

    @GetMapping("/sessions/{sessionId}/result")
    fun result(@AuthenticationPrincipal jwt: Jwt, @PathVariable sessionId: UUID) = completion.result(jwt, sessionId)

    @GetMapping("/sessions/{sessionId}/result.pdf", produces = ["application/pdf"])
    fun resultPdf(@AuthenticationPrincipal jwt: Jwt, @PathVariable sessionId: UUID): ResponseEntity<ByteArray> {
        val export = exports.pdf(jwt, sessionId)
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header(HttpHeaders.CONTENT_TYPE, export.contentType).header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(export.fileName).build().toString()).body(export.bytes)
    }
}

@RestController
@RequestMapping("/v1/platform/screening")
class PlatformScreeningCatalogController(
    private val catalog: ScreeningCatalogAdminService,
    private val seedBatches: ScreeningSeedBatchAdminService,
) {
    @GetMapping("/seed-batches")
    fun seedBatches(@AuthenticationPrincipal jwt: Jwt) = seedBatches.list(jwt)

    @PostMapping("/seed-batches/{batchId}/preview")
    fun previewSeedBatch(@AuthenticationPrincipal jwt: Jwt, @PathVariable batchId: String) = seedBatches.preview(jwt, batchId)

    @PostMapping("/seed-batches/{batchId}/apply")
    fun applySeedBatch(@AuthenticationPrincipal jwt: Jwt, @PathVariable batchId: String, @Valid @RequestBody request: ScreeningSeedBatchApplyRequest) = seedBatches.apply(jwt, batchId, request)

    @GetMapping("/templates")
    fun list(@AuthenticationPrincipal jwt: Jwt) = catalog.list(jwt)

    @GetMapping("/templates/{templateId}")
    fun get(@AuthenticationPrincipal jwt: Jwt, @PathVariable templateId: UUID) = catalog.get(jwt, templateId)

    @PostMapping("/templates") @ResponseStatus(HttpStatus.CREATED)
    fun create(@AuthenticationPrincipal jwt: Jwt, @RequestBody request: com.daycare.api.service.ScreeningTemplateDefinitionRequest) = catalog.create(jwt, request)

    @PutMapping("/templates/{templateId}")
    fun update(@AuthenticationPrincipal jwt: Jwt, @PathVariable templateId: UUID, @RequestParam expectedRevision: Long, @RequestBody request: com.daycare.api.service.ScreeningTemplateDefinitionRequest) = catalog.update(jwt, templateId, expectedRevision, request)

    @GetMapping("/templates/{templateId}/validate")
    fun validate(@AuthenticationPrincipal jwt: Jwt, @PathVariable templateId: UUID): ScreeningCatalogValidationResponse = catalog.validate(jwt, templateId)

    @PostMapping("/templates/{templateId}/publish")
    fun publish(@AuthenticationPrincipal jwt: Jwt, @PathVariable templateId: UUID) = catalog.publish(jwt, templateId)

    @PostMapping("/templates/{templateId}/review")
    fun review(@AuthenticationPrincipal jwt: Jwt, @PathVariable templateId: UUID, @RequestBody request: com.daycare.api.service.ScreeningCatalogReviewRequest) = catalog.review(jwt, templateId, request.approved)

    @PostMapping("/templates/{templateId}/retire")
    fun retire(@AuthenticationPrincipal jwt: Jwt, @PathVariable templateId: UUID) = catalog.retire(jwt, templateId)

    @DeleteMapping("/templates/{templateId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(@AuthenticationPrincipal jwt: Jwt, @PathVariable templateId: UUID) = catalog.deleteDraft(jwt, templateId)
}
