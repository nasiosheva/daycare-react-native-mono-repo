package com.daycare.backendlauncher.backend

import android.content.Context
import com.daycare.backendlauncher.termux.TermuxCommandExecutor

/**
 * Thin orchestration layer over the Termux-hosted backend. Start/stop calls
 * are fire-and-forget (Termux runs them as background commands); actual
 * confirmation comes from polling BackendStatusChecker, which is the source
 * of truth this app relies on rather than trusting Termux's own process state.
 */
object BackendController {
    fun runSetup(context: Context) = TermuxCommandExecutor.runScriptAsset(context, "setup.sh")
    fun start(context: Context) = TermuxCommandExecutor.runScriptAsset(context, "start.sh")
    fun stop(context: Context) = TermuxCommandExecutor.runScriptAsset(context, "stop.sh")

    suspend fun checkStatus(): BackendStatus = BackendStatusChecker.check()
}
