-- Optional, idempotent seed for the reference "Program Daycare Berdasarkan Usia 1-5 Tahun"
-- curriculum: 4 global LearningLevel age bands, 24 DevelopmentProgram rows (one per age band x
-- domain), and 138 DevelopmentProgramItem milestones. This file is NOT a Flyway migration and is
-- never run automatically as part of a schema build - it is executed on demand by
-- GlobalCurriculumSeeder.kt only when explicitly enabled (see
-- daycare.seed-global-curriculum-enabled). A schema reset followed by a plain Flyway migrate
-- therefore leaves development_programs/development_program_items/the global learning_levels
-- empty until this is deliberately run.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM learning_levels WHERE organization_id IS NULL AND name = 'Toddler (1-2 Tahun)') THEN
    RETURN;
  END IF;

  INSERT INTO learning_levels (id, organization_id, name, min_age_months, max_age_months, display_order, is_template, active) VALUES
  (gen_random_uuid(), NULL, 'Toddler (1-2 Tahun)', 12, 24, 0, true, true),
  (gen_random_uuid(), NULL, 'Kelompok Bermain (2-3 Tahun)', 24, 36, 1, true, true),
  (gen_random_uuid(), NULL, 'Kelompok A (3-4 Tahun)', 36, 48, 2, true, true),
  (gen_random_uuid(), NULL, 'Kelompok B (4-5 Tahun)', 48, 60, 3, true, true);

  INSERT INTO development_programs (id, organization_id, learning_level_id, name, description, duration_days, minimum_yes_percent, minimum_yes_streak, domain, is_template, active, created_at)
  SELECT gen_random_uuid(), NULL, level.id, cat.name, '', cat.duration_days, cat.minimum_yes_percent, cat.minimum_yes_streak, cat.domain, true, true, now()
  FROM learning_levels level
  CROSS JOIN (VALUES
    ('KEMANDIRIAN', 'Kemandirian', 21, 80, 7),
    ('BAHASA_KOMUNIKASI', 'Bahasa & Komunikasi', 21, 70, 5),
    ('KOGNITIF', 'Kognitif', 30, 70, 3),
    ('MOTORIK_HALUS', 'Motorik Halus', 30, 70, 3),
    ('MOTORIK_KASAR', 'Motorik Kasar', 21, 70, 3),
    ('SOSIAL_EMOSI', 'Sosial & Emosi', 21, 70, 5)
  ) AS cat(domain, name, duration_days, minimum_yes_percent, minimum_yes_streak)
  WHERE level.organization_id IS NULL AND level.is_template = true
    AND level.name IN ('Toddler (1-2 Tahun)', 'Kelompok Bermain (2-3 Tahun)', 'Kelompok A (3-4 Tahun)', 'Kelompok B (4-5 Tahun)');

  INSERT INTO development_program_items (id, organization_id, development_program_id, name, display_order, active, created_at)
  SELECT gen_random_uuid(), NULL, gc.id, item.name, item.display_order, true, now()
  FROM development_programs gc
  JOIN learning_levels level ON level.id = gc.learning_level_id
  JOIN (VALUES
  ('Toddler (1-2 Tahun)', 'BAHASA_KOMUNIKASI', 'Bernyanyi lagu anak', 0),
  ('Toddler (1-2 Tahun)', 'BAHASA_KOMUNIKASI', 'Menyebut nama sendiri', 1),
  ('Toddler (1-2 Tahun)', 'BAHASA_KOMUNIKASI', 'Menyebut nama ayah dan ibu', 2),
  ('Toddler (1-2 Tahun)', 'BAHASA_KOMUNIKASI', 'Menambah kosakata baru', 3),
  ('Toddler (1-2 Tahun)', 'BAHASA_KOMUNIKASI', 'Menirukan kata dan kalimat sederhana', 4),
  ('Toddler (1-2 Tahun)', 'BAHASA_KOMUNIKASI', 'Mendengarkan cerita pendek', 5),
  ('Toddler (1-2 Tahun)', 'KEMANDIRIAN', 'Tidur siang sesuai jadwal', 0),
  ('Toddler (1-2 Tahun)', 'KEMANDIRIAN', 'Mulai mengenal toilet (toilet readiness)', 1),
  ('Toddler (1-2 Tahun)', 'KEMANDIRIAN', 'Minum dari gelas', 2),
  ('Toddler (1-2 Tahun)', 'KEMANDIRIAN', 'Makan sendiri menggunakan sendok', 3),
  ('Toddler (1-2 Tahun)', 'KEMANDIRIAN', 'Mencuci tangan dengan bantuan', 4),
  ('Toddler (1-2 Tahun)', 'KEMANDIRIAN', 'Melepas sepatu/sandal', 5),
  ('Toddler (1-2 Tahun)', 'KEMANDIRIAN', 'Merapikan mainan setelah bermain', 6),
  ('Toddler (1-2 Tahun)', 'KOGNITIF', 'Memasangkan benda yang sama', 0),
  ('Toddler (1-2 Tahun)', 'KOGNITIF', 'Mengenali warna dasar', 1),
  ('Toddler (1-2 Tahun)', 'KOGNITIF', 'Mengenali bentuk dasar', 2),
  ('Toddler (1-2 Tahun)', 'KOGNITIF', 'Mengenali anggota tubuh', 3),
  ('Toddler (1-2 Tahun)', 'KOGNITIF', 'Mengenali hewan dan suaranya', 4),
  ('Toddler (1-2 Tahun)', 'KOGNITIF', 'Mengenali buah dan sayur', 5),
  ('Toddler (1-2 Tahun)', 'KOGNITIF', 'Mengenali kendaraan', 6),
  ('Toddler (1-2 Tahun)', 'KOGNITIF', 'Menyusun balok sederhana', 7),
  ('Toddler (1-2 Tahun)', 'MOTORIK_HALUS', 'Memasukkan balok sesuai bentuk', 0),
  ('Toddler (1-2 Tahun)', 'MOTORIK_HALUS', 'Mencoret dengan krayon', 1),
  ('Toddler (1-2 Tahun)', 'MOTORIK_HALUS', 'Finger painting', 2),
  ('Toddler (1-2 Tahun)', 'MOTORIK_HALUS', 'Menempel stiker', 3),
  ('Toddler (1-2 Tahun)', 'MOTORIK_HALUS', 'Memindahkan benda menggunakan sendok', 4),
  ('Toddler (1-2 Tahun)', 'MOTORIK_HALUS', 'Puzzle 2-4 keping', 5),
  ('Toddler (1-2 Tahun)', 'MOTORIK_KASAR', 'Bermain rintangan sederhana', 0),
  ('Toddler (1-2 Tahun)', 'MOTORIK_KASAR', 'Berjalan di garis', 1),
  ('Toddler (1-2 Tahun)', 'MOTORIK_KASAR', 'Berlari', 2),
  ('Toddler (1-2 Tahun)', 'MOTORIK_KASAR', 'Melompat kecil', 3),
  ('Toddler (1-2 Tahun)', 'MOTORIK_KASAR', 'Menendang bola', 4),
  ('Toddler (1-2 Tahun)', 'MOTORIK_KASAR', 'Melempar bola besar', 5),
  ('Toddler (1-2 Tahun)', 'SOSIAL_EMOSI', 'Mengucapkan tolong dan terima kasih', 0),
  ('Toddler (1-2 Tahun)', 'SOSIAL_EMOSI', 'Bermain bersama teman', 1),
  ('Toddler (1-2 Tahun)', 'SOSIAL_EMOSI', 'Belajar berbagi', 2),
  ('Toddler (1-2 Tahun)', 'SOSIAL_EMOSI', 'Belajar antre', 3),
  ('Toddler (1-2 Tahun)', 'SOSIAL_EMOSI', 'Mengenali emosi dasar (1-2 tahun)', 4),
  ('Kelompok Bermain (2-3 Tahun)', 'BAHASA_KOMUNIKASI', 'Mengikuti instruksi 2 langkah', 0),
  ('Kelompok Bermain (2-3 Tahun)', 'BAHASA_KOMUNIKASI', 'Berbicara menggunakan kalimat sederhana', 1),
  ('Kelompok Bermain (2-3 Tahun)', 'BAHASA_KOMUNIKASI', 'Menjawab pertanyaan sederhana', 2),
  ('Kelompok Bermain (2-3 Tahun)', 'BAHASA_KOMUNIKASI', 'Menghafal lagu anak (2-3 tahun)', 3),
  ('Kelompok Bermain (2-3 Tahun)', 'BAHASA_KOMUNIKASI', 'Menceritakan pengalaman singkat', 4),
  ('Kelompok Bermain (2-3 Tahun)', 'KEMANDIRIAN', 'Melepas dan memakai sandal', 0),
  ('Kelompok Bermain (2-3 Tahun)', 'KEMANDIRIAN', 'Merapikan mainan (2-3 tahun)', 1),
  ('Kelompok Bermain (2-3 Tahun)', 'KEMANDIRIAN', 'Membuka tas dan botol minum sendiri', 2),
  ('Kelompok Bermain (2-3 Tahun)', 'KEMANDIRIAN', 'Toilet training', 3),
  ('Kelompok Bermain (2-3 Tahun)', 'KEMANDIRIAN', 'Makan dengan rapi', 4),
  ('Kelompok Bermain (2-3 Tahun)', 'KEMANDIRIAN', 'Minum tanpa tumpah', 5),
  ('Kelompok Bermain (2-3 Tahun)', 'KEMANDIRIAN', 'Cuci tangan mandiri', 6),
  ('Kelompok Bermain (2-3 Tahun)', 'KOGNITIF', 'Menghitung 1-10', 0),
  ('Kelompok Bermain (2-3 Tahun)', 'KOGNITIF', 'Mengenali warna (2-3 tahun)', 1),
  ('Kelompok Bermain (2-3 Tahun)', 'KOGNITIF', 'Mengenali bentuk (2-3 tahun)', 2),
  ('Kelompok Bermain (2-3 Tahun)', 'KOGNITIF', 'Mengenali huruf A-Z (2-3 tahun)', 3),
  ('Kelompok Bermain (2-3 Tahun)', 'KOGNITIF', 'Mengenali ukuran besar-kecil', 4),
  ('Kelompok Bermain (2-3 Tahun)', 'KOGNITIF', 'Mengelompokkan benda berdasarkan warna atau bentuk', 5),
  ('Kelompok Bermain (2-3 Tahun)', 'KOGNITIF', 'Puzzle 6-8 keping', 6),
  ('Kelompok Bermain (2-3 Tahun)', 'MOTORIK_HALUS', 'Mewarnai dalam area', 0),
  ('Kelompok Bermain (2-3 Tahun)', 'MOTORIK_HALUS', 'Menggunting garis lurus', 1),
  ('Kelompok Bermain (2-3 Tahun)', 'MOTORIK_HALUS', 'Membuat kolase sederhana', 2),
  ('Kelompok Bermain (2-3 Tahun)', 'MOTORIK_HALUS', 'Bermain playdough', 3),
  ('Kelompok Bermain (2-3 Tahun)', 'MOTORIK_HALUS', 'Meronce ukuran besar', 4),
  ('Kelompok Bermain (2-3 Tahun)', 'MOTORIK_KASAR', 'Melompat dengan dua kaki', 0),
  ('Kelompok Bermain (2-3 Tahun)', 'MOTORIK_KASAR', 'Berdiri satu kaki beberapa detik', 1),
  ('Kelompok Bermain (2-3 Tahun)', 'MOTORIK_KASAR', 'Berlari menghindari rintangan', 2),
  ('Kelompok Bermain (2-3 Tahun)', 'MOTORIK_KASAR', 'Menangkap bola besar', 3),
  ('Kelompok Bermain (2-3 Tahun)', 'MOTORIK_KASAR', 'Menari mengikuti musik', 4),
  ('Kelompok Bermain (2-3 Tahun)', 'SOSIAL_EMOSI', 'Mengungkapkan perasaan', 0),
  ('Kelompok Bermain (2-3 Tahun)', 'SOSIAL_EMOSI', 'Bermain peran sederhana', 1),
  ('Kelompok Bermain (2-3 Tahun)', 'SOSIAL_EMOSI', 'Mengucapkan maaf', 2),
  ('Kelompok Bermain (2-3 Tahun)', 'SOSIAL_EMOSI', 'Menunggu giliran', 3),
  ('Kelompok Bermain (2-3 Tahun)', 'SOSIAL_EMOSI', 'Bermain kelompok kecil', 4),
  ('Kelompok A (3-4 Tahun)', 'BAHASA_KOMUNIKASI', 'Bercerita dari gambar', 0),
  ('Kelompok A (3-4 Tahun)', 'BAHASA_KOMUNIKASI', 'Menghafal doa pendek', 1),
  ('Kelompok A (3-4 Tahun)', 'BAHASA_KOMUNIKASI', 'Mengenal lawan kata sederhana', 2),
  ('Kelompok A (3-4 Tahun)', 'BAHASA_KOMUNIKASI', 'Mengikuti instruksi 3 langkah', 3),
  ('Kelompok A (3-4 Tahun)', 'BAHASA_KOMUNIKASI', 'Menghafal alamat rumah', 4),
  ('Kelompok A (3-4 Tahun)', 'BAHASA_KOMUNIKASI', 'Berbicara dengan kalimat lengkap', 5),
  ('Kelompok A (3-4 Tahun)', 'KEMANDIRIAN', 'Toilet mandiri', 0),
  ('Kelompok A (3-4 Tahun)', 'KEMANDIRIAN', 'Menggosok gigi dengan pengawasan', 1),
  ('Kelompok A (3-4 Tahun)', 'KEMANDIRIAN', 'Menyiapkan perlengkapan makan', 2),
  ('Kelompok A (3-4 Tahun)', 'KEMANDIRIAN', 'Membereskan perlengkapan sendiri', 3),
  ('Kelompok A (3-4 Tahun)', 'KEMANDIRIAN', 'Memakai pakaian sederhana sendiri', 4),
  ('Kelompok A (3-4 Tahun)', 'KOGNITIF', 'Mengenali konsep waktu (pagi, siang, malam)', 0),
  ('Kelompok A (3-4 Tahun)', 'KOGNITIF', 'Mengenali angka 1-20', 1),
  ('Kelompok A (3-4 Tahun)', 'KOGNITIF', 'Mengenali huruf besar dan kecil', 2),
  ('Kelompok A (3-4 Tahun)', 'KOGNITIF', 'Menulis nama depan', 3),
  ('Kelompok A (3-4 Tahun)', 'KOGNITIF', 'Menghitung benda', 4),
  ('Kelompok A (3-4 Tahun)', 'KOGNITIF', 'Mengenali pola sederhana', 5),
  ('Kelompok A (3-4 Tahun)', 'MOTORIK_HALUS', 'Menggambar bentuk dasar', 0),
  ('Kelompok A (3-4 Tahun)', 'MOTORIK_HALUS', 'Menggunting mengikuti pola', 1),
  ('Kelompok A (3-4 Tahun)', 'MOTORIK_HALUS', 'Menulis garis dan lengkung', 2),
  ('Kelompok A (3-4 Tahun)', 'MOTORIK_HALUS', 'Meronce (3-4 tahun)', 3),
  ('Kelompok A (3-4 Tahun)', 'MOTORIK_HALUS', 'Puzzle 12 keping', 4),
  ('Kelompok A (3-4 Tahun)', 'MOTORIK_KASAR', 'Melompat jauh', 0),
  ('Kelompok A (3-4 Tahun)', 'MOTORIK_KASAR', 'Berjalan di papan keseimbangan', 1),
  ('Kelompok A (3-4 Tahun)', 'MOTORIK_KASAR', 'Melempar dan menangkap bola', 2),
  ('Kelompok A (3-4 Tahun)', 'MOTORIK_KASAR', 'Bermain estafet sederhana', 3),
  ('Kelompok A (3-4 Tahun)', 'MOTORIK_KASAR', 'Senam irama', 4),
  ('Kelompok A (3-4 Tahun)', 'SOSIAL_EMOSI', 'Bermain kelompok', 0),
  ('Kelompok A (3-4 Tahun)', 'SOSIAL_EMOSI', 'Menyelesaikan konflik sederhana', 1),
  ('Kelompok A (3-4 Tahun)', 'SOSIAL_EMOSI', 'Mengenali aturan permainan', 2),
  ('Kelompok A (3-4 Tahun)', 'SOSIAL_EMOSI', 'Menunjukkan empati', 3),
  ('Kelompok A (3-4 Tahun)', 'SOSIAL_EMOSI', 'Bertanggung jawab terhadap barang pribadi', 4),
  ('Kelompok B (4-5 Tahun)', 'BAHASA_KOMUNIKASI', 'Berani berbicara di depan teman', 0),
  ('Kelompok B (4-5 Tahun)', 'BAHASA_KOMUNIKASI', 'Menceritakan pengalaman dengan runtut', 1),
  ('Kelompok B (4-5 Tahun)', 'BAHASA_KOMUNIKASI', 'Menjawab pertanyaan mengapa', 2),
  ('Kelompok B (4-5 Tahun)', 'BAHASA_KOMUNIKASI', 'Mengenali huruf dan bunyi huruf', 3),
  ('Kelompok B (4-5 Tahun)', 'BAHASA_KOMUNIKASI', 'Mengenali kata sederhana', 4),
  ('Kelompok B (4-5 Tahun)', 'BAHASA_KOMUNIKASI', 'Menyukai kegiatan membaca buku bersama', 5),
  ('Kelompok B (4-5 Tahun)', 'KEMANDIRIAN', 'Memakai baju dan sepatu sendiri', 0),
  ('Kelompok B (4-5 Tahun)', 'KEMANDIRIAN', 'Mengancingkan baju dan membuka resleting', 1),
  ('Kelompok B (4-5 Tahun)', 'KEMANDIRIAN', 'Menyiapkan tas sendiri', 2),
  ('Kelompok B (4-5 Tahun)', 'KEMANDIRIAN', 'Menjaga kebersihan diri', 3),
  ('Kelompok B (4-5 Tahun)', 'KEMANDIRIAN', 'Mandiri ke toilet', 4),
  ('Kelompok B (4-5 Tahun)', 'KOGNITIF', 'Mengenali angka 1-50', 0),
  ('Kelompok B (4-5 Tahun)', 'KOGNITIF', 'Berhitung sederhana', 1),
  ('Kelompok B (4-5 Tahun)', 'KOGNITIF', 'Mengenali pola lebih kompleks', 2),
  ('Kelompok B (4-5 Tahun)', 'KOGNITIF', 'Mengenali konsep kanan-kiri', 3),
  ('Kelompok B (4-5 Tahun)', 'KOGNITIF', 'Mengenali hari dalam seminggu', 4),
  ('Kelompok B (4-5 Tahun)', 'KOGNITIF', 'Mengenali jam secara sederhana', 5),
  ('Kelompok B (4-5 Tahun)', 'KOGNITIF', 'Menulis nama lengkap', 6),
  ('Kelompok B (4-5 Tahun)', 'KOGNITIF', 'Duduk fokus 10-20 menit untuk belajar atau membaca', 7),
  ('Kelompok B (4-5 Tahun)', 'MOTORIK_HALUS', 'Menulis huruf dan angka', 0),
  ('Kelompok B (4-5 Tahun)', 'MOTORIK_HALUS', 'Menggambar orang sederhana', 1),
  ('Kelompok B (4-5 Tahun)', 'MOTORIK_HALUS', 'Menggunting bentuk', 2),
  ('Kelompok B (4-5 Tahun)', 'MOTORIK_HALUS', 'Melipat kertas', 3),
  ('Kelompok B (4-5 Tahun)', 'MOTORIK_HALUS', 'Membuat kerajinan sederhana', 4),
  ('Kelompok B (4-5 Tahun)', 'MOTORIK_KASAR', 'Melompat dengan satu kaki', 0),
  ('Kelompok B (4-5 Tahun)', 'MOTORIK_KASAR', 'Berlari zig-zag', 1),
  ('Kelompok B (4-5 Tahun)', 'MOTORIK_KASAR', 'Bermain bola sederhana', 2),
  ('Kelompok B (4-5 Tahun)', 'MOTORIK_KASAR', 'Senam (4-5 tahun)', 3),
  ('Kelompok B (4-5 Tahun)', 'MOTORIK_KASAR', 'Permainan keseimbangan', 4),
  ('Kelompok B (4-5 Tahun)', 'SOSIAL_EMOSI', 'Memimpin permainan sederhana', 0),
  ('Kelompok B (4-5 Tahun)', 'SOSIAL_EMOSI', 'Bekerja sama dalam kelompok', 1),
  ('Kelompok B (4-5 Tahun)', 'SOSIAL_EMOSI', 'Menyelesaikan tugas sampai selesai', 2),
  ('Kelompok B (4-5 Tahun)', 'SOSIAL_EMOSI', 'Mengendalikan emosi dengan arahan', 3),
  ('Kelompok B (4-5 Tahun)', 'SOSIAL_EMOSI', 'Menghargai pendapat teman', 4)
  ) AS item(level_name, domain, name, display_order) ON item.level_name = level.name AND item.domain = gc.domain
  WHERE gc.organization_id IS NULL AND gc.is_template = true;
END $$;
