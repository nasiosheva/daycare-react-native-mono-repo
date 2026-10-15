# Folder personal-docs lokal

<!-- Mories Deo Hutapea,S.E.,S.Kom -->

## Perubahan

Menambahkan folder `docs/personal-docs/` untuk catatan dan dokumen pribadi
pengguna yang hanya berlaku di checkout lokal.

Dokumen akun lokal `docs/local-accounts.md` dipindahkan menjadi
`docs/personal-docs/local-accounts.md`.

Checklist review kode senior ditambahkan sebagai
`docs/personal-docs/code-review-checklist.md`, termasuk kewajiban konsistensi
code/docs changes, test lulus, dan 100% function/method coverage untuk kode
baru.

Checklist tersebut juga mensyaratkan format branch yang jelas dan konsisten
dengan isi perubahan, seperti `feature/`, `fix/`, `refactor/`, `test/`,
`docs/`, atau `chore/`.

`CLAUDE.md` juga diarahkan untuk menggunakan checklist tersebut sebagai acuan
utama ketika pengguna meminta review kode.

Checklist menegaskan bahwa seluruh pekerjaan harus sesuai dengan
`docs/business-rules.md`; perbedaan wajib dihentikan untuk klarifikasi atau
dicatat sebagai gap dengan keputusan eksplisit.

Checklist juga mewajibkan Separation of Concerns dan SOLID secara pragmatis,
serta menetapkan batas file code maksimal 1.000 baris dengan rencana pemecahan
untuk file legacy yang sudah melampaui batas tersebut.

Checklist juga mewajibkan penggunaan component, hook, utility, schema, dan
abstraction reusable yang sudah tersedia sebelum membuat yang baru.

Checklist sekarang juga mencakup review potensi bug, crash, infinite render,
race condition, memory leak, serta render berat pada list dan screen
cross-platform.

## Aturan

- `docs/personal-docs/` ditambahkan ke `.gitignore`.
- Isi folder tidak boleh di-stage, di-commit, di-push, atau dipublikasikan.
- `CLAUDE.md` sekarang menyebutkan batasan ini secara eksplisit.

## Verifikasi

- Folder dibuat di checkout lokal.
- `git check-ignore` memverifikasi pola `docs/personal-docs/` aktif.
- Tidak ada commit atau push dilakukan pada perubahan ini.
