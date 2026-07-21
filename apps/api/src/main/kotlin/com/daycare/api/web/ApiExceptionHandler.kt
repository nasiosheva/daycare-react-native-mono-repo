package com.daycare.api.web

import com.daycare.api.service.AttendanceConflict
import org.springframework.http.HttpStatus
import org.springframework.http.ProblemDetail
import org.springframework.security.access.AccessDeniedException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class ApiExceptionHandler {
    @ExceptionHandler(IllegalArgumentException::class)
    fun invalidRequest(error: IllegalArgumentException): ProblemDetail = problem(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", error.message)
    @ExceptionHandler(AttendanceConflict::class)
    fun conflict(error: AttendanceConflict): ProblemDetail = problem(HttpStatus.CONFLICT, "ATTENDANCE_CONFLICT", error.message)
    @ExceptionHandler(AccessDeniedException::class)
    fun forbidden(error: AccessDeniedException): ProblemDetail = problem(HttpStatus.FORBIDDEN, "FORBIDDEN", error.message)

    private fun problem(status: HttpStatus, code: String, detail: String?): ProblemDetail = ProblemDetail.forStatusAndDetail(status, detail ?: status.reasonPhrase).apply { setProperty("code", code) }
}
