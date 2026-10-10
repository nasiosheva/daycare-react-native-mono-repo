# Backend coverage follow-up — 2026-10-10

## Status

The full Kotlin backend test suite passes locally. JaCoCo currently reports:

- line: `7,979 / 8,615` (`92.62%`)
- branch: `4,614 / 5,749` (`80.26%`)

Line coverage already exceeds the 90% target, but branch coverage does not. The
release coverage gate therefore remains open until both metrics reach at least
90% through behavior-oriented tests; business code is not excluded from the
report.

## Verification

```bash
GRADLE_USER_HOME=.gradle-local ./apps/api/gradlew -p apps/api test jacocoTestReport --no-daemon --max-workers=1
```

The latest full run completed successfully after adding behavior-oriented guard,
ownership, scope, status, media, and lifecycle cases across the service tests.
The branch result above is the full-suite result; focused Gradle test runs also
rewrite JaCoCo execution data and must not be used for the release metric.
