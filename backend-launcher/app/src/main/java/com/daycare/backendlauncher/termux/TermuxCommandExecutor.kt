package com.daycare.backendlauncher.termux

import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

/**
 * Fires scripts into Termux via its documented RUN_COMMAND plugin API
 * (https://github.com/termux/termux-app/wiki/RUN_COMMAND-Intent). Termux must
 * have "allow-external-apps=true" in ~/.termux/termux.properties — that flag
 * is a deliberate one-time step only the user can toggle inside Termux itself,
 * it cannot be set from an external app.
 *
 * Rather than requiring our shell scripts to already exist inside Termux's
 * sandboxed home directory (which this app has no access to), every script
 * is bundled as a text asset and passed inline to "bash -c", so the RUN_COMMAND
 * path always points at an executable that is guaranteed to exist: bash itself.
 */
private const val TERMUX_RUN_COMMAND_SERVICE = "com.termux.app.RunCommandService"
private const val TERMUX_BASH_PATH = "/data/data/com.termux/files/usr/bin/bash"

object TermuxCommandExecutor {
    fun runScriptAsset(context: Context, assetName: String, runInBackground: Boolean = true) {
        val scriptText = context.assets.open("termux-scripts/$assetName")
            .bufferedReader()
            .use { it.readText() }

        val intent = Intent().apply {
            setClassName(TERMUX_PACKAGE, TERMUX_RUN_COMMAND_SERVICE)
            action = "com.termux.RUN_COMMAND"
            putExtra("com.termux.RUN_COMMAND_PATH", TERMUX_BASH_PATH)
            putExtra("com.termux.RUN_COMMAND_ARGUMENTS", arrayOf("-c", scriptText))
            putExtra("com.termux.RUN_COMMAND_BACKGROUND", runInBackground)
            putExtra("com.termux.RUN_COMMAND_COMMAND_LABEL", assetName)
        }
        ContextCompat.startForegroundService(context, intent)
    }
}
