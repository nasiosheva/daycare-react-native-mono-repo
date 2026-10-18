# Adopsi OpenSpec

<!-- Mories Deo Hutapea,S.E.,S.Kom -->

Repo ini sekarang menggunakan OpenSpec dengan schema `spec-driven` dan output artefak berbahasa Indonesia.

## Workflow

Perubahan baru mengikuti urutan:

1. `explore` untuk memahami kebutuhan dan batasan.
2. `propose` untuk membuat proposal, spesifikasi delta, desain, dan task.
3. Review manusia sebelum kode diubah.
4. `apply` untuk mengerjakan task dari proposal.
5. `archive` setelah implementasi dan verifikasi selesai.

## Lokasi artefak

- `openspec/changes/`: perubahan aktif yang sedang direncanakan atau dikerjakan.
- `openspec/specs/`: spesifikasi utama yang sudah diarsipkan dan menjadi sumber perilaku sistem.
- `openspec/changes/archive/`: riwayat perubahan yang sudah selesai.
- `.agents/skills/`: adapter OpenSpec lokal untuk Codex; tidak dibagikan melalui Git.
- `.claude/skills/`: adapter OpenSpec lokal untuk Claude Code; tidak dibagikan melalui Git.
- `.claude/settings.local.json`: izin lokal Claude Code; tidak dibagikan melalui Git.

Adapter tersebut hanya menyediakan entry point sesuai tool masing-masing; semua proposal, desain, task, dan spesifikasi tetap satu di bawah `openspec/`. Setiap developer atau agent menjalankan `openspec init` lokal untuk membuat adapter yang diperlukan.

`docs/business-rules.md` tetap menjadi sumber aturan bisnis aplikasi. Spesifikasi OpenSpec tidak boleh bertentangan dengan dokumen tersebut; bila aturan bisnis berubah, keduanya harus diperbarui secara konsisten. `docs/changes/` tetap digunakan untuk catatan implementasi harian dan bukti verifikasi repo.

## Perintah awal

Untuk memulai perubahan baru:

```text
Codex:  $openspec-propose "jelaskan perubahan yang ingin dibuat"
Claude: /openspec-propose "jelaskan perubahan yang ingin dibuat"
```

Jangan langsung mengubah kode sebelum proposal, spesifikasi, desain, dan task ditinjau.
