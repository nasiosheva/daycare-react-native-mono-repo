# Parent access hardening

## Perubahan

- Parent self-service enrollment, transfer, retry, cancel, family profile, dan
  payment proof sekarang mensyaratkan `UserProfile.registrationRole=PARENT`.
- Membership Parent nonaktif tidak lagi otomatis mendapat seluruh route
  read-only. Exception harus disebutkan oleh endpoint; inbox notifikasi pada
  tenant yang masih dapat dibaca dan invoice/proof milik Parent tetap menjadi
  jalur terbatas.
- Detail invoice dan payment proof menerima serta memvalidasi
  `X-Organization-Id`; client meneruskan `organizationId` dari item agregat
  asalnya sehingga direct link lintas tenant tidak dapat menebak tenant.
- Home Parent tetap menggabungkan invoice milik sendiri dari membership aktif
  maupun nonaktif yang masih memenuhi exception billing; query operasional anak
  tetap hanya memakai membership aktif.
- Direct-link Parent tetap read-only sampai ada entitlement layanan `ACTIVE`
  yang belum melewati masa berlaku. Mutasi absence, consent, pickup
  authorization, dan emergency contact kini memeriksa entitlement milik Parent
  pada tenant dan child yang sama.
- Feedback tenant mensyaratkan child aktif yang benar-benar terhubung kepada
  Parent; QR di Home tidak ditampilkan untuk child direct-link tanpa
  entitlement. Inbox agregat tetap dapat menampilkan membership Parent
  operasional saat tidak ada tenant aktif.

## Dokumentasi

`docs/business-rules.md` dan `README.md` menjelaskan state
`LINKED_READ_ONLY`, exception billing/inbox, serta batas bahwa implementasi ini
belum menggantikan target `GuardianAuthority`/`accessMode` per resource.

## Verifikasi

- `./apps/api/gradlew -p apps/api test --no-daemon --rerun-tasks` — lulus (termasuk
  regression test entitlement dan QR Parent; 4 test yang memang di-skip tetap
  dicatat oleh suite).
- Test tambahan mencakup penolakan self-service non-Parent dan direct-link
  tanpa entitlement.
- `pnpm verify` — lulus untuk lint, typecheck, dan test seluruh workspace
  JavaScript/TypeScript.

## Tindak lanjut

`GuardianAuthority`, `reasonCode`, dan `allowedActions` formal tetap target
produk sesuai §13.12; endpoint baru wajib mengikuti policy exception ini sampai
resolver grant tersebut tersedia.
