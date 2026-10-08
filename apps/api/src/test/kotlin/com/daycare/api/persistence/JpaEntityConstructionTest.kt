package com.daycare.api.persistence

import jakarta.persistence.Entity
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test
import java.io.File
import java.net.URL

/**
 * Verifies that every mapped entity keeps the no-argument constructor required by
 * Hibernate. This also exercises default field initialization for the persistence
 * model instead of leaving mapping-only classes entirely untested.
 */
class JpaEntityConstructionTest {
    @Test
    fun `all mapped entities are instantiable by JPA`() {
        val resource = requireNotNull(Thread.currentThread().contextClassLoader.getResource("com/daycare/api/persistence"))
        require(resource.protocol == "file") { "The test expects the local compiled class directory" }
        val directory = File(URL(resource.toString()).toURI())
        directory.listFiles { file -> file.extension == "class" && !file.name.contains('$') }
            .orEmpty()
            .map { it.name.removeSuffix(".class") }
            .map { Class.forName("com.daycare.api.persistence.$it") }
            .filter { it.isAnnotationPresent(Entity::class.java) }
            .forEach { type -> assertNotNull(type.getDeclaredConstructor().newInstance(), type.name) }
    }
}
