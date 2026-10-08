# Baseline test coverage

## Perubahan

- Backend memakai JaCoCo melalui `pnpm coverage:backend` dan menghasilkan XML serta HTML report di `apps/api/build/reports/jacoco/test/`.
- Semua workspace TypeScript memakai provider `@vitest/coverage-v8` melalui script `test:coverage`.
- Root command `pnpm coverage` menjalankan backend dan seluruh workspace TypeScript secara berurutan. Folder report berada di `coverage/` dan tetap di-ignore oleh Git.

## Hasil baseline 2026-10-08

| Modul | Statements/Lines | Branches | Catatan |
| --- | ---: | ---: | --- |
| Backend Kotlin (JaCoCo) | 51.45% line | 27.87% | 142 kelas terinstrumentasi |
| `@daycare/core` | 100% | 66.66% | Semua test lulus |
| `@daycare/ui` | 2.89% | 67.44% | Komponen React Native belum memiliki test render |
| `@daycare/api-client` | 88.01% | 75.20% | Sebagian method HTTP belum tercakup |
| `apps/mobile` | 20.63% | 66.71% | Test dominan utility/domain; route dan komponen native belum dirender |

Coverage 99% belum tercapai. Angka ini adalah baseline terukur, bukan threshold yang dipaksakan. Peningkatan berikutnya sebaiknya diprioritaskan pada service backend kritis, `packages/ui`, route auth, dan alur chat/notifikasi yang berdampak langsung pada operasional.

## Progress batch service backend

Batch test berikutnya menambahkan coverage untuk `EducationOfferingService`, `AnalyticsService`, `TenantPaymentInstructionService`, `StaffReminderService`, `ParentChildProfileService`, `TenantAnnouncementService`, `ChildIncidentService`, `StaffHandoverService`, `DevelopmentService`, `GlobalCurriculumSeedingService`, `PlatformAdminPinService`, dan `RealtimeSessionRegistry`.

Hasil JaCoCo setelah batch ini:

| Modul | Lines | Branches | Verifikasi |
| --- | ---: | ---: | --- |
| Backend Kotlin | 81.55% | 51.05% | `GRADLE_USER_HOME=.gradle-local ./apps/api/gradlew -p apps/api test --no-daemon --max-workers=1 jacocoTestReport` lulus |

Target 90% line dan branch belum tercapai. Pengukuran terakhir mencakup suite serial penuh: 81.55% line, 51.05% branch, 70.77% instruction, 57.36% method, dan 87.17% class. Kenaikan ini berasal dari eksekusi jalur bisnis nyata pada Child Management, Billing, Child Care Log, Staff Reminder, Private Tutoring, Tenant Announcement, Access, dan capability organisasi; tidak ada pengecualian package bisnis dari laporan. Sisa terbesarnya berada pada branch validasi Billing/Child Management, service akses, realtime handler, controller Spring, dan konfigurasi keamanan. Angka ini dipertahankan sebagai hasil terukur dan tidak dipaksakan menjadi 90% dengan mengecualikan kode.

## Verifikasi

- Suite backend penuh lulus: `GRADLE_USER_HOME=.gradle-local ./apps/api/gradlew -p apps/api test --no-daemon --max-workers=1 jacocoTestReport`.
- Report JaCoCo terakhir: 81.55% line dan 51.05% branch.
- `git diff --check` lulus.
