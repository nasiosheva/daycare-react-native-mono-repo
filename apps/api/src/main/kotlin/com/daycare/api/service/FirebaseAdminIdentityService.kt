package com.daycare.api.service

import com.google.auth.oauth2.GoogleCredentials
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthException
import com.google.firebase.auth.UserRecord
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.io.ByteArrayInputStream

@Service
class FirebaseAdminIdentityService(
    @Value("\${daycare.firebase-service-account-json:}") private val serviceAccountJson: String,
) {
    fun createEmailPasswordUser(email: String, username: String, password: String): String = try {
        firebaseAuth().createUser(UserRecord.CreateRequest()
            .setEmail(email)
            .setDisplayName(username)
            .setPassword(password))
            .uid
    } catch (error: FirebaseAuthException) {
        throw IllegalArgumentException(error.message ?: "Firebase account could not be created")
    }

    fun updatePassword(firebaseUid: String, password: String) {
        try {
            firebaseAuth().updateUser(UserRecord.UpdateRequest(firebaseUid).setPassword(password))
        } catch (error: FirebaseAuthException) {
            throw IllegalArgumentException(error.message ?: "Firebase password could not be updated")
        }
    }

    private fun firebaseAuth(): FirebaseAuth {
        require(serviceAccountJson.isNotBlank()) { "FIREBASE_SERVICE_ACCOUNT_JSON must be configured before creating an Admin account" }
        val app = synchronized(this) {
            FirebaseApp.getApps().firstOrNull() ?: FirebaseApp.initializeApp(FirebaseOptions.builder()
                .setCredentials(GoogleCredentials.fromStream(ByteArrayInputStream(serviceAccountJson.toByteArray())))
                .build())
        }
        return FirebaseAuth.getInstance(app)
    }
}
