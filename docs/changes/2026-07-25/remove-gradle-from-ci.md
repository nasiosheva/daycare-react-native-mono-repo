# Remove Gradle from CI/CD

Date: 2026-07-25

## Change

- Removed the API Gradle test job from pull requests targeting `production`.
- Removed Java and Gradle setup plus the `bootJar` build from production deployment.
- Production deployment now uploads only the Expo web export.
- Updated the VPS activation script so a web-only release copies the current API JAR into the new release and does not restart the API.

## Affected behavior

GitHub Actions no longer compiles, tests, packages, migrates, or deploys the Spring API. Backend changes require the separate manual API release process. The VPS-installed activation script must be updated from this repository before the next web-only deployment.

## Verification

- Checked both GitHub Actions workflows: no Gradle action, Gradle command, Java setup, or API JAR upload remains.
- Ran `bash -n scripts/production/activate-release.sh`.

## Follow-up

Keep manual API release runbooks and database migration approval separate from the web deployment workflow.
