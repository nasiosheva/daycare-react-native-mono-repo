# Parent–Staff chat over realtime WebSocket

## Scope

Parent, Staff, and Staff Admin continue to use the existing append-only
per-child message thread. This change makes its realtime delivery explicit:
the REST endpoint persists and authorizes the message, then the server sends a
tenant-scoped `CHILD_MESSAGES` WebSocket event to the intended other side.

## Safety contract

- The WebSocket event contains only `childId` and `messageId`; it never carries
  message text, sender names, or other child data.
- The client treats the event as an invalidation hint and refetches only the
  affected thread through the protected REST endpoint. A reconnect or missed
  event cannot lose persisted messages.
- Recipient selection remains unchanged: Parent messages go to assigned Staff,
  or active Staff Admins only when no Staff is assigned; Staff/Staff Admin
  messages go to linked guardians.
- Tenant and child-scope checks still run on every REST read/send operation.
- Pesan milik pengirim menampilkan status `SENT`/Terkirim atau `READ`/Dibaca.
  `READ` berarti setidaknya satu pihak lawan yang berwenang telah menandai
  thread terbaca; status tersebut dihitung server dari `ChildMessageRead`.
- Profil Parent memakai floating action **Pesan** dengan unread count dari
  endpoint summary tenant + child; membuka thread menandai pesan masuk terbaca
  dan meng-invalidasi summary lokal.
- Staff dan Staff Admin memiliki floating action **Pesan anak** yang membuka
  daftar anak dalam scope server mereka; memilih anak membuka thread yang sama.
- Reply menyimpan `replyToMessageId` yang harus berada pada tenant dan anak
  yang sama. Response REST mengembalikan preview pesan asal, sedangkan UI
  menyediakan bubble reply dan lompatan terukur ke bubble asal.
- Bila refetch realtime menambahkan pesan dari lawan chat saat pengguna sedang
  membaca riwayat, UI menampilkan floating action terlokalisasi berbentuk ikon
  panah bawah saja, dengan jumlah tetap tersedia melalui label aksesibilitas,
  untuk menggeser ke ujung thread dan mengosongkan jumlah tersebut. Pesan yang
  dikirim pengguna sendiri selalu menggeser ke ujung secara otomatis tanpa
  action; posisi yang sudah berada di ujung juga mengikuti pesan lawan otomatis.

## Verification

The ChildMessageService and realtime query-invalidation tests verify both
persisted notification delivery and the identifier-only WebSocket event for
Parent → Staff Admin/Staff and Staff → Parent flows.
