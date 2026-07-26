# Kotlin Gradle Wrapper

## Change

- Added the committed Gradle Wrapper for the Kotlin/Spring API module at `apps/api` using Gradle 8.14.2.
- Updated the root API development command and local backend launcher to run `apps/api/gradlew -p apps/api` instead of requiring a globally installed Gradle executable.
- Documented the JDK 21 requirement and wrapper-based backend test command in the README.

## Affected behavior

Open or attach `apps/api/build.gradle.kts` as a Gradle project in IntelliJ IDEA or Android Studio. The IDE now reads the wrapper version from the repository and imports the standard Kotlin source roots under `apps/api/src/main/kotlin` consistently. The root directory remains the pnpm monorepo and is not itself a Gradle project.

## Verification

- Generated the wrapper with Gradle 8.14.2 and confirmed `apps/api/gradlew`, `gradle-wrapper.jar`, and `gradle-wrapper.properties` exist.
- Verified the wrapper resolves Gradle 8.14.2 on JDK 21 and reviewed launcher/package commands to confirm they target the nested `apps/api` build without requiring global `gradle`.

## Follow-up

- In IntelliJ IDEA or Android Studio, set the Gradle JVM for the `apps/api` module to JDK 21 and reload the Gradle project once.
- The wrapper was subsequently made local-only at the repository owner's request. A fresh clone needs Gradle 8.14.2 available once to regenerate `apps/api/gradlew` with `gradle -p apps/api wrapper --gradle-version 8.14.2` before wrapper-based scripts can run.
