<!-- Mories Deo Hutapea,S.E.,S.Kom -->

# Checklist PR — Chat Realtime Recipient Authorization

## Identitas

| Field | Nilai |
| --- | --- |
| Branch sumber | `fix/chat-realtime-recipient-authorization` |
| Target branch | `production` |
| PR | https://github.com/nasiosheva/daycare-react-native-mono-repo/pull/88 |
| Work item / tujuan | Refresh thread chat ketika reconnect/focus dan amankan event chat lintas tenant menurut membership aktif. |
| Tanggal checklist | `2026-10-17` |

## Ringkasan untuk deskripsi PR

| Area review | Status | Gap / blocker / bukti |
| --- | --- | --- |
| 1. Scope dan konsistensi perubahan | `PASS` | Perubahan realtime chat dan resolver ESLint untuk suffix platform; `.agents/` dan `run-logs/` tidak masuk commit. |
| 2. Konsistensi dokumentasi | `PASS` | README, `docs/business-rules.md`, daily note, dan checklist branch diperbarui. |
| 3. Test dan coverage | `PASS` | `pnpm verify` lulus; backend penuh lulus. Backend JaCoCo: 88% line, 87% branch. |
| 4. Arsitektur dan maintainability | `PASS` | Filtering penerima di service; refresh lifecycle pada hook terpisah; tidak ada perubahan schema. |
| 5. Business rule, role, dan security | `PASS` | Recipient wajib punya relasi anak dan membership aktif dengan role sesuai tenant asal. |
| 6. Database dan API contract | `PASS` | Tidak ada perubahan REST/schema; WebSocket tetap membawa identifier chat dan pemuatan isi melalui REST. |
| 7. UI/UX dan accessibility | `N/A` | Tidak ada perubahan visual/string/control; lifecycle refresh diuji otomatis. |
| 8. Performance dan reliability | `PASS` | Reconnect/focus/foreground refresh; React Query hanya refetch query aktif. |
| 9. Verification dan release readiness | `PARTIAL` | Semua test lokal lulus; CI PR baru akan berjalan. Browser/device/live service tidak diuji. |
| 10. Keputusan akhir reviewer | `DEFER` | Tunggu CI PR lulus sebelum merge. Tidak ada temuan kode terbuka. |

Checklist branch lengkap: `docs/changes/2026-10-17/mr-checklist-fix-chat-realtime-recipient-authorization.md`

Checklist kesiapan commit: `docs/changes/2026-10-17/pre-commit-checklist-fix-chat-realtime-recipient-authorization.md` — `READY`.

Temuan terbuka/blocker: tidak ada temuan kode; CI PR masih menunggu.

## Scope dan aturan produk

- [x] Tujuan branch jelas: thread chat diperbarui saat reconnect, screen focus, atau aplikasi foreground; event lintas tenant hanya ke penerima berwenang.
- [x] `README.md` dan `docs/business-rules.md` selaras dengan implementasi dan aturan penerima aktif.
- [x] Backend mensyaratkan relasi guardian/assignment dan membership aktif dengan role Parent/Staff yang sesuai; Staff Admin aktif fallback bila tidak ada Staff assigned aktif.
- [x] Payload WebSocket tidak berubah; event chat tetap memuat identifier, isi thread dimuat ulang melalui REST tenant/child-scoped.
- [x] Tidak ada operasi pembayaran/mutasi baru; tidak ada perubahan idempotency, locking, atau uniqueness.

## Implementasi dan pengalaman pengguna

- [x] Mengikuti pola repository: pemilihan penerima di `ChildMessageService`, publisher khusus chat, hook lifecycle terpisah.
- [x] Checklist kesiapan commit branch tersedia dan `READY`.
- [x] Review seluruh staged diff menggunakan checklist code review lokal; semua temuan diperbaiki dan diverifikasi ulang.
- [x] Loading/error UI tidak berubah; query thread yang aktif dimuat ulang melalui React Query.
- [x] Tidak ada teks, kontrol, layout, maupun accessibility behavior baru.
- [x] Tidak ada secret/token/log/local-only file di commit; `.agents/` tetap lokal dan `run-logs/` dikosongkan sebelum PR.

## Database, test, dan verifikasi

- [x] Tidak ada migration/schema.
- [x] Regression tests ditulis sebelum implementasi; RED/GREEN tercatat pada checklist kesiapan commit dan daily note.
- [x] Test terkait: publisher/session registry/ChildMessageService; realtime invalidation, mute preference, serta hook focus/foreground.
- [x] `pnpm verify` lulus untuk seluruh workspace TypeScript: lint, typecheck, dan test (60 file/242 test mobile; packages/core 10 test, packages/ui 30 test, packages/api-client 67 test).
- [x] `GRADLE_USER_HOME=.gradle-local ./apps/api/gradlew -p apps/api test --no-daemon --max-workers=1 --rerun-tasks` lulus (`BUILD SUCCESSFUL`).
- [ ] CI untuk head PR saat ini: workflow `Mobile unit tests` sedang berjalan pada PR #88; tunggu hasil untuk head terbaru sebelum merge.
- [x] `git diff --cached --check` lulus. Coverage backend: 88% line / 87% branch dari `apps/api/build/reports/jacoco/test/html/index.html`; coverage frontend tidak dihitung pada verifikasi ini.
- [x] Verifikasi lokal dibedakan dari CI/device/browser/live service; tidak ada klaim untuk yang belum dijalankan.

## Dokumentasi dan release hygiene

- [x] Daily note tersedia di `docs/changes/2026-10-17/child-messages-cross-tenant-realtime.md`.
- [x] README dan business rules diperbarui.
- [x] File baru yang mendukung watermark memuat `Mories Deo Hutapea,S.E.,S.Kom`.
- [x] Branch bukan `production`; target PR adalah `production`; tidak dilakukan broad-stage.
- [x] `run-logs/` diverifikasi kosong sebelum membuka PR; tidak ada isinya di commit.
- [x] `docs/personal-docs/`, `CLAUDE.md`, akun lokal, secret, keystore, dan artefak lokal-only tidak dimasukkan.
- [x] Checklist khusus branch ini disimpan bersama dokumentasi perubahan.

## Bukti verifikasi dan hasil yang belum selesai

| Pemeriksaan | Hasil / perintah / tautan | Catatan atau alasan N/A |
| --- | --- | --- |
| Test frontend | `pnpm verify` — PASS | 242 mobile test, 10 core, 30 UI, 67 API-client. Full lint memiliki warning non-blocking; 0 error. |
| Test backend | `GRADLE_USER_HOME=.gradle-local ./apps/api/gradlew -p apps/api test --no-daemon --max-workers=1 --rerun-tasks` — PASS | BUILD SUCCESSFUL; JaCoCo 88% line / 87% branch. Ada warning compiler deprecation/type yang tidak menyebabkan kegagalan. |
| CI head PR | IN_PROGRESS | PR #88; workflow `Mobile unit tests` sedang berjalan. Hasil harus diverifikasi lagi setelah commit checklist ini di-push. |
| Coverage line/branch | Backend 88% / 87% | `apps/api/build/reports/jacoco/test/html/index.html`; coverage frontend tidak dihitung. |
| DB/migration | N/A | Tidak ada schema atau migration yang berubah. |
| Browser/device/live service | Tidak dilakukan | Fokus perubahan pada lifecycle/realtime; automated tests lulus. |
| Blocker/follow-up | Tunggu CI | Jangan merge sebelum seluruh required checks pada head PR lulus. |

## Setelah merge

- [ ] Merge dikonfirmasi pada PR ini.
- [ ] Checkout disinkronkan ke `production` dan branch lokal yang sudah merged dibersihkan sesuai aturan repo.
- [ ] Worktree serta file lokal-only yang tidak terkait tetap dipertahankan.
