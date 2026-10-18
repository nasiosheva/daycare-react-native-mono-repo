package com.daycare.api.service

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test

// Mories Deo Hutapea,S.E.,S.Kom
class ImageUrlValidationTest {
    @Test
    fun `accepts only https urls with a host and respects storage length`() {
        assertEquals("https://images.example/promo.jpg", requireHttpsImageUrl(" https://images.example/promo.jpg "))
        assertNull(requireHttpsImageUrl(null))
        assertThrows(IllegalArgumentException::class.java) { requireHttpsImageUrl("http://images.example/promo.jpg") }
        assertThrows(IllegalArgumentException::class.java) { requireHttpsImageUrl("https://user:secret@images.example/promo.jpg") }
        assertThrows(IllegalArgumentException::class.java) { requireHttpsImageUrl("https:///promo.jpg") }
        assertThrows(IllegalArgumentException::class.java) { requireHttpsImageUrl("not a url") }
        assertThrows(IllegalArgumentException::class.java) { requireHttpsImageUrl("https://example.com/" + "x".repeat(2048)) }
    }
}
