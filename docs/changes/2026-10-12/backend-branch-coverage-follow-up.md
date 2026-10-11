# Backend branch coverage follow-up

<!-- Mories Deo Hutapea,S.E.,S.Kom -->

## Scope

Menambah pengujian perilaku nyata pada `BillingService` untuk konfigurasi paket, batas validasi diskon, serta filter invoice yang menggunakan nama anak, nomor invoice, dan email Parent.

## Verification

Laporan JaCoCo penuh dijalankan melalui `GRADLE_USER_HOME=.gradle-local ./apps/api/gradlew -p apps/api test jacocoTestReport --no-daemon`. Persentase akhir harus dibaca dari `apps/api/build/reports/jacoco/test/jacocoTestReport.xml`; target branch 90% belum boleh dianggap tercapai sebelum diverifikasi dari laporan tersebut.
