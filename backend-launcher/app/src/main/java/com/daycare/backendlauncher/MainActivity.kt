package com.daycare.backendlauncher

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.daycare.backendlauncher.backend.BackendController
import com.daycare.backendlauncher.backend.BackendStatus
import com.daycare.backendlauncher.termux.RUN_COMMAND_PERMISSION
import com.daycare.backendlauncher.termux.TERMUX_PACKAGE
import com.daycare.backendlauncher.termux.checkTermuxAvailability
import kotlinx.coroutines.delay

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    LauncherScreen()
                }
            }
        }
    }
}

@Composable
private fun LauncherScreen() {
    val context = LocalContext.current
    var termux by remember { mutableStateOf(checkTermuxAvailability(context)) }
    var status by remember { mutableStateOf(BackendStatus.CHECKING) }

    val requestPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        termux = checkTermuxAvailability(context)
    }

    LaunchedEffect(Unit) {
        while (true) {
            status = BackendController.checkStatus()
            delay(5_000)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("Daycare Backend Launcher", style = MaterialTheme.typography.headlineSmall)

        Text("1. Termux terinstal: ${if (termux.installed) "Ya" else "Belum"}")
        if (!termux.installed) {
            Button(onClick = {
                context.startActivity(
                    Intent(Intent.ACTION_VIEW, Uri.parse("https://f-droid.org/packages/com.termux/")),
                )
            }) { Text("Buka halaman install Termux (F-Droid)") }
        }

        Text("2. Izin RUN_COMMAND: ${if (termux.runCommandPermissionGranted) "Diberikan" else "Belum"}")
        if (termux.installed && !termux.runCommandPermissionGranted) {
            Button(onClick = { requestPermission.launch(RUN_COMMAND_PERMISSION) }) {
                Text("Minta izin RUN_COMMAND")
            }
        }

        Text(
            "3. Di Termux, pastikan \"allow-external-apps=true\" sudah diset di " +
                "~/.termux/termux.properties, lalu jalankan \"termux-reload-settings\". " +
                "Ini langkah manual sekali saja, tidak bisa diotomasi dari luar Termux.",
        )

        if (termux.ready) {
            Button(onClick = { BackendController.runSetup(context) }) {
                Text("Jalankan setup (install JDK 21 + Postgres)")
            }
            Text(
                "4. Salin jar backend (apps/api build output) ke " +
                    "/data/data/com.termux/files/home/backend-launcher/api.jar " +
                    "di dalam Termux, lalu:",
            )
            Button(onClick = { BackendController.start(context) }) { Text("Start backend") }
            Button(onClick = { BackendController.stop(context) }) { Text("Stop backend") }
        }

        Text(
            "Status: " + when (status) {
                BackendStatus.RUNNING -> "● Berjalan (127.0.0.1:8080)"
                BackendStatus.NOT_RESPONDING -> "○ Tidak merespons"
                BackendStatus.CHECKING -> "Mengecek..."
            },
        )
        Button(onClick = {
            context.packageManager.getLaunchIntentForPackage(TERMUX_PACKAGE)?.let(context::startActivity)
        }) { Text("Buka Termux (untuk lihat log manual)") }
    }
}
