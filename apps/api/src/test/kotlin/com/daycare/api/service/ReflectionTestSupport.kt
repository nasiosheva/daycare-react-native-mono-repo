package com.daycare.api.service

import java.lang.reflect.InvocationTargetException
import java.lang.reflect.Method

private val primitiveWrappers: Map<Class<*>, Class<*>> = mapOf(
    java.lang.Integer.TYPE to java.lang.Integer::class.java,
    java.lang.Long.TYPE to java.lang.Long::class.java,
    java.lang.Short.TYPE to java.lang.Short::class.java,
    java.lang.Byte.TYPE to java.lang.Byte::class.java,
    java.lang.Double.TYPE to java.lang.Double::class.java,
    java.lang.Float.TYPE to java.lang.Float::class.java,
    java.lang.Boolean.TYPE to java.lang.Boolean::class.java,
    java.lang.Character.TYPE to java.lang.Character::class.java,
)

private fun Method.acceptsArgs(args: Array<out Any?>): Boolean = parameterTypes.indices.all { index ->
    val arg = args[index]
    val type = parameterTypes[index]
    val boxedType = if (type.isPrimitive) primitiveWrappers[type] ?: type else type
    arg == null || boxedType.isInstance(arg)
}

/**
 * Invokes a private method on [target] for white-box unit tests. `declaredMethods` order is
 * unspecified by the JVM, so name+arity alone can silently pick the wrong overload; this only
 * skips the argument-type check when name+arity already identify a single candidate.
 */
fun invokePrivate(target: Any, name: String, vararg args: Any?): Any? {
    val candidates = target.javaClass.declaredMethods.filter { it.name == name && it.parameterCount == args.size }
    require(candidates.isNotEmpty()) { "No private method named '$name' with ${args.size} parameter(s) on ${target.javaClass.simpleName}" }
    val method = candidates.singleOrNull() ?: candidates.single { it.acceptsArgs(args) }
    method.isAccessible = true
    return try {
        method.invoke(target, *args)
    } catch (error: InvocationTargetException) {
        throw (error.targetException ?: error)
    }
}

// Mories Deo Hutapea,S.E.,S.Kom
