# Navigation bootstrap redirect

## Perubahan

- Root Expo Router `Stack` sekarang selalu tetap mounted; access guards berjalan
  sebagai redirect-only siblings sehingga `router.replace("/home")` tidak lagi
  dikirim saat navigator sedang dilepas.
- Route bootstrap `/` diperbolehkan selama AuthProvider dan tenant context
  menyelesaikan loading. Redirect awal tetap dimiliki `app/index.tsx`.
- Ditambahkan regression assertion untuk route `/` pada profile dan tenant
  context guards.

## Verifikasi

- `pnpm --filter @daycare/app test -- --run`.
- `pnpm --filter @daycare/app typecheck`.
