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

## Verifikasi

- `pnpm coverage` lulus: backend JaCoCo dan seluruh test coverage Vitest selesai tanpa test gagal.
- `git diff --check` lulus.
