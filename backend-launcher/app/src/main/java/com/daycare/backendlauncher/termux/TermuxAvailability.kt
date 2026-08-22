package com.daycare.backendlauncher.termux

import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat

const val TERMUX_PACKAGE = "com.termux"
const val RUN_COMMAND_PERMISSION = "com.termux.permission.RUN_COMMAND"

data class TermuxAvailability(val installed: Boolean, val runCommandPermissionGranted: Boolean) {
    val ready: Boolean get() = installed && runCommandPermissionGranted
}

fun checkTermuxAvailability(context: Context): TermuxAvailability {
    val installed = try {
        context.packageManager.getPackageInfo(TERMUX_PACKAGE, 0)
        true
    } catch (_: PackageManager.NameNotFoundException) {
        false
    }
    val granted = ContextCompat.checkSelfPermission(context, RUN_COMMAND_PERMISSION) ==
        PackageManager.PERMISSION_GRANTED
    return TermuxAvailability(installed = installed, runCommandPermissionGranted = granted)
}
