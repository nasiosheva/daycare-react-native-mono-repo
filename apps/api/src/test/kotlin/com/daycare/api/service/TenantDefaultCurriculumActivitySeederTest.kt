package com.daycare.api.service

import com.daycare.api.persistence.CurriculumActivity
import com.daycare.api.persistence.CurriculumActivityRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.ArgumentCaptor
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import java.util.UUID

class TenantDefaultCurriculumActivitySeederTest {
    @Test
    fun `creates the active daily activity catalog for a new tenant`() {
        val activities = mock(CurriculumActivityRepository::class.java)
        val organizationId = UUID.randomUUID()
        val service = TenantDefaultCurriculumActivitySeeder(activities)

        service.seed(organizationId)

        @Suppress("UNCHECKED_CAST")
        val activityCaptor = ArgumentCaptor.forClass(Iterable::class.java) as ArgumentCaptor<Iterable<CurriculumActivity>>
        verify(activities).saveAll(activityCaptor.capture())
        val seededActivities = activityCaptor.value.toList()
        assertEquals(14, seededActivities.size)
        assertEquals(
            listOf(
                "Morning circle",
                "Doa pagi",
                "Senam dan gerak lagu",
                "Snack time",
                "Kegiatan tematik",
                "Sensory play",
                "Outdoor play",
                "Story telling",
                "Art & craft",
                "Lunch time",
                "Nap time",
                "Free play",
                "Review kegiatan",
                "Persiapan pulang",
            ),
            seededActivities.map { it.name },
        )
        assertTrue(seededActivities.all { it.organizationId == organizationId && it.active && it.description.isNotBlank() })
    }
}
