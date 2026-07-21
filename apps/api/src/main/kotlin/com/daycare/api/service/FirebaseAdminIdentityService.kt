package com.daycare.api.service

import com.google.auth.oauth2.GoogleCredentials
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.AuthErrorCode
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthException
import com.google.firebase.auth.UserRecord
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.io.ByteArrayInputStream

interface EmailPasswordIdentityProvisioner {
    fun findOrCreateEmailPasswordUser(email: String, username: String, password: String): String
}

@Service
class FirebaseAdminIdentityService(
    @Value("\${daycare.firebase-service-account-json:}") private val serviceAccountJson: String,
) : EmailPasswordIdentityProvisioner {
    override fun findOrCreateEmailPasswordUser(email: String, username: String, password: String): String = try {
        firebaseAuth().getUserByEmail(email).uid
    } catch (error: FirebaseAuthException) {
        if (error.authErrorCode != AuthErrorCode.USER_NOT_FOUND) {
            throw IllegalArgumentException(error.message ?: "Firebase account could not be read")
        }
        createEmailPasswordUser(email, username, password)
    }

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

    fun deleteUser(firebaseUid: String) {
        try {
            firebaseAuth().deleteUser(firebaseUid)
        } catch (_: FirebaseAuthException) {
            // This is a best-effort rollback after a database transaction fails.
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
