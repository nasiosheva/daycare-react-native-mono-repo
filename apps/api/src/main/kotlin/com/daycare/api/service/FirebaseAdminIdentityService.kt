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

object FirebaseIdentityError {
    const val ACCOUNT_READ_FAILED = "firebase.account_read_failed"
    const val ACCOUNT_CREATE_FAILED = "firebase.account_create_failed"
    const val PASSWORD_UPDATE_FAILED = "firebase.password_update_failed"
    const val SERVICE_ACCOUNT_MISSING = "firebase.service_account_missing"
}

@Service
class FirebaseAdminIdentityService(
    @Value("\${daycare.firebase-service-account-json:}") private val serviceAccountJson: String,
) : EmailPasswordIdentityProvisioner {
    override fun findOrCreateEmailPasswordUser(email: String, username: String, password: String): String = try {
        firebaseAuth().getUserByEmail(email).uid
    } catch (error: FirebaseAuthException) {
        if (error.authErrorCode != AuthErrorCode.USER_NOT_FOUND) {
            throw IllegalStateException(FirebaseIdentityError.ACCOUNT_READ_FAILED)
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
        throw IllegalStateException(FirebaseIdentityError.ACCOUNT_CREATE_FAILED)
    }

    fun updatePassword(firebaseUid: String, password: String) {
        try {
            firebaseAuth().updateUser(UserRecord.UpdateRequest(firebaseUid).setPassword(password))
        } catch (error: FirebaseAuthException) {
            throw IllegalStateException(FirebaseIdentityError.PASSWORD_UPDATE_FAILED)
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
        require(serviceAccountJson.isNotBlank()) { FirebaseIdentityError.SERVICE_ACCOUNT_MISSING }
        val app = synchronized(this) {
            FirebaseApp.getApps().firstOrNull() ?: FirebaseApp.initializeApp(FirebaseOptions.builder()
                .setCredentials(GoogleCredentials.fromStream(ByteArrayInputStream(serviceAccountJson.toByteArray())))
                .build())
        }
        return FirebaseAuth.getInstance(app)
    }
}
