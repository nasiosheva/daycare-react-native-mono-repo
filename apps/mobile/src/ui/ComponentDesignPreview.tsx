// Mories Deo Hutapea,S.E.,S.Kom
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  AppText,
  AudioPlayer,
  Avatar,
  BackButton,
  Badge,
  Banner,
  BottomSheet,
  Button,
  Card,
  Chip,
  ChipGroup,
  EmptyState,
  ErrorState,
  FloatingActionButton,
  InfoRow,
  MenuItem,
  MenuSection,
  MultiStepFormWizard,
  NavigationCard,
  PasswordInput,
  PinEntryScreen,
  Screen,
  SectionHeader,
  Shimmer,
  ShimmerList,
  TabBar,
  TextField,
  SearchField,
  ToggleSwitch,
  publishInlineFeedback,
} from "@daycare/ui";
import { ParentPromotionSlider } from "@/home/ParentPromotionSlider";

const previewPromotionBanners = [1, 2, 3].map((slide) => ({
  id: `preview-banner-${slide}`,
  title: `Preview slide ${slide}`,
  body: "",
  imageUrl: "https://picsum.photos/seed/picsum/200/300",
  status: "PUBLISHED" as const,
  createdAt: "2026-10-18T09:00:00Z",
  updatedAt: "2026-10-18T09:00:00Z",
}));

const palette = {
  canvas: "#F5F6F3",
  surface: "#FFFFFF",
  text: "#172A3A",
  muted: "#68757D",
  border: "#E3E7E3",
  gold: "#D8A844",
  goldDark: "#735117",
  goldSoft: "#FBF3E2",
  teal: "#247B6E",
  tealSoft: "#E7F3EF",
  red: "#A34343",
  redSoft: "#F8ECEA",
};

export function ComponentDesignPreview() {
  const [selectedPlan, setSelectedPlan] = useState("Paket harian");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedTab, setSelectedTab] = useState("semua");
  const [wizardStep, setWizardStep] = useState(1);
  const [showPinPreview, setShowPinPreview] = useState(false);
  const [pinValue, setPinValue] = useState("12");
  const [audioStatus, setAudioStatus] = useState<"playing" | "paused">("paused");
  const [audioPosition, setAudioPosition] = useState(42000);
  const [search, setSearch] = useState("Nadia");
  const [clearableText, setClearableText] = useState("");
  const [chipSelected, setChipSelected] = useState("Hadir");

  if (showPinPreview) {
    return <PinEntryScreen
      value={pinValue}
      onChange={setPinValue}
      title="Pratinjau PIN"
      description="Layar khusus untuk memasukkan PIN dengan keypad numerik."
      header={<BackButton onPress={() => setShowPinPreview(false)} accessibilityLabel="Kembali ke galeri komponen" />}
      deleteAccessibilityLabel="Hapus digit terakhir"
    />;
  }

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <View style={styles.header}>
      <Text style={styles.eyebrow}>USIA EMAS · KONSEP ALTERNATIF</Text>
      <Text style={styles.title}>Gaya modern minimal</Text>
      <Text style={styles.subtitle}>Galeri lengkap komponen bersama dan konsep visual alternatif. Pratinjau ini tidak mengubah layar aplikasi lainnya.</Text>
    </View>

    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Tombol</Text>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel="Buat pesanan" style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Buat pesanan</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Lihat detail" style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Lihat detail</Text>
        </Pressable>
      </View>
    </View>

    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Galeri lengkap @daycare/ui</Text>
      <Text style={styles.helper}>Contoh berikut memakai komponen yang benar-benar digunakan aplikasi, bukan mockup statis.</Text>
    </View>

    <View style={styles.section} testID="component-AppText">
      <Text style={styles.sectionTitle}>AppText</Text>
      <Card title="Skala tipografi" subtitle="Judul, isi, label, dan keterangan memakai token yang sama.">
        <AppText variant="h3">Judul bagian</AppText>
        <AppText variant="body">Teks isi untuk informasi utama.</AppText>
        <AppText variant="label">Label tindakan</AppText>
        <AppText variant="caption" tone="muted">Keterangan tambahan</AppText>
        <AppText variant="bodySmall" tone="danger">Pesan validasi</AppText>
      </Card>
    </View>

    <View style={styles.section} testID="component-AudioPlayer">
      <Text style={styles.sectionTitle}>AudioPlayer</Text>
      <Card title="Pesan suara" subtitle="Contoh kontrol putar dan seek yang interaktif.">
        <AudioPlayer
          status={audioStatus}
          positionMs={audioPosition}
          durationMs={96000}
          onPlayPause={() => setAudioStatus((status) => status === "playing" ? "paused" : "playing")}
          onSeek={setAudioPosition}
          playAccessibilityLabel="Putar pesan suara"
          pauseAccessibilityLabel="Jeda pesan suara"
          seekAccessibilityLabel="Posisi pesan suara"
        />
      </Card>
    </View>

    <View style={styles.section} testID="component-Avatar">
      <Text style={styles.sectionTitle}>Avatar</Text>
      <Card title="Ukuran avatar">
        <View style={styles.row}><Avatar name="Nadia Hutapea" size="sm" /><Avatar name="Nadia Hutapea" /><Avatar name="Nadia Hutapea" size="lg" /></View>
      </Card>
    </View>

    <View style={styles.section} testID="component-BackButton">
      <Text style={styles.sectionTitle}>BackButton</Text>
      <Card><BackButton onPress={() => undefined} accessibilityLabel="Kembali" /></Card>
    </View>

    <View style={styles.section} testID="component-Badge">
      <Text style={styles.sectionTitle}>Badge</Text>
      <Card title="Status">
        <View style={styles.row}>
          <Badge label="Aktif" tone="success" icon="checkmark-circle" />
          <Badge label="Menunggu" tone="warning" icon="time-outline" />
          <Badge label="Perlu perhatian" tone="danger" icon="alert-circle" />
          <Badge label="Informasi" tone="info" />
        </View>
      </Card>
    </View>

    <View style={styles.section} testID="component-Banner">
      <Text style={styles.sectionTitle}>Banner</Text>
      <View style={styles.stack}>
        <Banner title="Informasi" message="Perubahan tersimpan." tone="info" />
        <Banner title="Perlu diperiksa" message="Lengkapi data sebelum melanjutkan." tone="warning" />
        <Banner title="Terjadi kesalahan" message="Coba lagi beberapa saat." tone="danger" />
      </View>
      <ParentPromotionSlider banners={previewPromotionBanners} interactive={false} sectionTitle="Slider banner preview · 3 slide" />
    </View>

    <View style={styles.section} testID="component-BottomSheet">
      <Text style={styles.sectionTitle}>BottomSheet</Text>
      <Card title="Panel tindakan">
        <Text style={styles.bodyText}>Lihat panel dari bawah dengan tombol aksi yang tetap terlihat.</Text>
        <Button onPress={() => setSheetVisible(true)}>Buka BottomSheet</Button>
      </Card>
    </View>

    <View style={styles.section} testID="component-Button">
      <Text style={styles.sectionTitle}>Button</Text>
      <Card title="Varian tindakan">
        <View style={styles.row}>
          <Button onPress={() => undefined}>Utama</Button>
          <Button variant="secondary" onPress={() => undefined}>Sekunder</Button>
          <Button variant="danger" onPress={() => undefined}>Hapus</Button>
          <Button variant="ghost" onPress={() => undefined}>Teks saja</Button>
          <Button loading onPress={() => undefined}>Menyimpan</Button>
          <Button disabled onPress={() => undefined}>Nonaktif</Button>
        </View>
      </Card>
    </View>

    <View style={styles.section} testID="component-Card">
      <Text style={styles.sectionTitle}>Card dan InfoRow</Text>
      <View style={styles.stack}>
        <Card title="Ringkasan anak" subtitle="Daycare · Cabang utama" icon="person-outline" trailing={<Badge label="Aktif" tone="success" />}>
          <InfoRowsPreview />
        </Card>
        <Card title="Kartu berwarna" variant="tinted"><Text style={styles.bodyText}>Informasi sekunder dalam permukaan lembut.</Text></Card>
        <Card title="Pilihan aktif" variant="selected"><Text style={styles.bodyText}>Kartu yang sedang dipilih.</Text></Card>
      </View>
    </View>

    <View style={styles.section} testID="component-Chip">
      <Text style={styles.sectionTitle}>Chip dan ChipGroup</Text>
      <Card title="Filter status">
        <ChipGroup accessibilityLabel="Filter kehadiran">
          {["Semua", "Hadir", "Izin"].map((item) => <Chip key={item} label={item} selected={chipSelected === item} onPress={() => setChipSelected(item)} />)}
        </ChipGroup>
      </Card>
    </View>

    <View style={styles.section} testID="component-EmptyState">
      <Text style={styles.sectionTitle}>EmptyState dan ErrorState</Text>
      <View style={styles.stack}>
        <Card><EmptyState title="Belum ada tagihan" description="Tagihan baru akan muncul di sini." icon="receipt-outline" action={{ label: "Muat ulang", onPress: () => undefined }} compact /></Card>
        <Card><ErrorState title="Data belum termuat" description="Periksa koneksi internet, lalu coba kembali." retryLabel="Coba lagi" onRetry={() => undefined} compact /></Card>
      </View>
    </View>

    <View style={styles.section} testID="component-FloatingActionButton">
      <Text style={styles.sectionTitle}>FloatingActionButton</Text>
      <Card title="Aksi mengambang">
        <View style={styles.row}>
          <FloatingActionButton accessibilityLabel="Tambah catatan" icon="add" onPress={() => undefined}>Tambah catatan</FloatingActionButton>
          <FloatingActionButton accessibilityLabel="Buat baru" icon="add" iconOnly variant="surface" onPress={() => undefined}>Buat baru</FloatingActionButton>
        </View>
      </Card>
    </View>

    <View style={styles.section} testID="component-MenuItem">
      <Text style={styles.sectionTitle}>MenuItem dan MenuSection</Text>
      <Card>
        <MenuSection title="Pengelolaan">
          <MenuItem title="Data anak" description="Lihat dan kelola profil anak." icon="people-outline" badge={<Badge label="12" />} onPress={() => undefined} />
          <MenuItem title="Perlu perhatian" description="Ada konfigurasi yang belum lengkap." icon="alert-circle-outline" attention badge={<Badge label="2" tone="danger" />} onPress={() => undefined} />
        </MenuSection>
      </Card>
    </View>

    <View style={styles.section} testID="component-MultiStepFormWizard">
      <Text style={styles.sectionTitle}>MultiStepFormWizard</Text>
      <Card title="Form bertahap" subtitle="Stepper menunjukkan progres dan garis penghubung langkah.">
        <MultiStepFormWizard
          steps={[{ id: "profil", label: "Profil" }, { id: "layanan", label: "Layanan" }, { id: "tinjau", label: "Tinjau" }]}
          currentStep={wizardStep}
          progressLabel={`Langkah ${wizardStep + 1} dari 3`}
        >
          <AppText>Informasi langkah {wizardStep + 1}</AppText>
        </MultiStepFormWizard>
        <View style={styles.row}>
          <Button variant="secondary" disabled={wizardStep === 0} onPress={() => setWizardStep((step) => Math.max(0, step - 1))}>Sebelumnya</Button>
          <Button disabled={wizardStep === 2} onPress={() => setWizardStep((step) => Math.min(2, step + 1))}>Berikutnya</Button>
        </View>
      </Card>
    </View>

    <View style={styles.section} testID="component-NavigationCard">
      <Text style={styles.sectionTitle}>NavigationCard</Text>
      <NavigationCard accessibilityLabel="Buka profil Nadia" onPress={() => undefined} leading={<Avatar name="Nadia" />}>
        <AppText variant="label">Nadia Hutapea</AppText>
        <AppText variant="bodySmall" tone="muted">Lihat detail profil anak</AppText>
      </NavigationCard>
    </View>

    <View style={styles.section} testID="component-PasswordInput">
      <Text style={styles.sectionTitle}>PasswordInput</Text>
      <Card title="Kata sandi"><PasswordInput placeholder="Masukkan kata sandi" accessibilityLabel="Kata sandi" showLabel="Tampilkan" hideLabel="Sembunyikan" /></Card>
    </View>

    <View style={styles.section} testID="component-PinEntryScreen">
      <Text style={styles.sectionTitle}>PinEntryScreen</Text>
      <Card title="Layar PIN khusus" subtitle="Komponen ini memakai seluruh layar, jadi pratinjaunya dibuka terpisah.">
        <Button variant="secondary" onPress={() => setShowPinPreview(true)}>Buka pratinjau PIN</Button>
      </Card>
    </View>

    <View style={styles.section} testID="component-Screen">
      <Text style={styles.sectionTitle}>Screen</Text>
      <View style={styles.screenPreview}>
        <Screen title="Ringkasan" headerAction={<Badge label="Hari ini" tone="info" />} footer={<Text style={styles.screenFooter}>Footer tetap di bawah</Text>}>
          <SectionHeader title="Aktivitas" description="Contoh struktur halaman bersama." />
          <Card title="Check-in anak"><AppText variant="h3">12 anak</AppText></Card>
          <View testID="component-InlineFeedback" style={styles.stack}>
            <AppText variant="label">InlineFeedback</AppText>
            <AppText variant="bodySmall" tone="muted">Umpan balik tampil di bagian atas Screen setelah tindakan.</AppText>
            <Button onPress={() => publishInlineFeedback("Tersimpan", "Perubahan berhasil disimpan.", "success")}>Tampilkan umpan balik</Button>
          </View>
        </Screen>
      </View>
    </View>

    <View style={styles.section} testID="component-SectionHeader">
      <Text style={styles.sectionTitle}>SectionHeader</Text>
      <Card><SectionHeader title="Kegiatan hari ini" description="Ringkasan aktivitas kelas." action={<Button variant="ghost" onPress={() => undefined}>Lihat semua</Button>} /></Card>
    </View>

    <View style={styles.section} testID="component-Shimmer">
      <Text style={styles.sectionTitle}>Shimmer dan ShimmerList</Text>
      <Card title="Placeholder loading">
        <Shimmer width="56%" height={20} />
        <ShimmerList count={2} variant="row" />
        <ShimmerList count={2} variant="tile" />
      </Card>
    </View>

    <View style={styles.section} testID="component-TabBar">
      <Text style={styles.sectionTitle}>TabBar</Text>
      <Card>
        <TabBar
          accessibilityLabel="Filter daftar"
          items={[{ key: "semua", label: "Semua", count: 12 }, { key: "aktif", label: "Aktif", count: 9 }, { key: "arsip", label: "Arsip", count: 3 }]}
          selected={selectedTab}
          onSelect={setSelectedTab}
        />
      </Card>
    </View>

    <View style={styles.section} testID="component-TextField">
      <Text style={styles.sectionTitle}>TextField dan SearchField</Text>
      <Card title="Form dasar">
        <TextField label="Nama anak" placeholder="Masukkan nama" value={clearableText} onChangeText={setClearableText} clearable clearAccessibilityLabel="Hapus teks" required hint="Gunakan nama sesuai dokumen." />
        <TextField label="Catatan" placeholder="Tulis catatan" multiline />
        <TextField label="Email" value="alamat tidak valid" editable={false} error="Periksa kembali alamat email." />
        <SearchField label="Cari anak" placeholder="Nama anak" value={search} onChangeText={setSearch} clearAccessibilityLabel="Hapus pencarian" />
      </Card>
    </View>

    <View style={styles.section} testID="component-ToggleSwitch">
      <Text style={styles.sectionTitle}>ToggleSwitch</Text>
      <Card title="Pengaturan notifikasi">
        <ToggleSwitch label="Pengingat aktif" description="Kirim pengingat 30 menit sebelum tutup." value={reminderEnabled} onValueChange={setReminderEnabled} accessibilityLabel="Pengingat aktif" />
        <ToggleSwitch label="Pengaturan nonaktif" description="Contoh switch yang tidak dapat diubah." value={false} disabled onValueChange={() => undefined} accessibilityLabel="Pengaturan nonaktif" />
      </Card>
    </View>

    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Konsep visual alternatif</Text>
      <Text style={styles.helper}>Eksplorasi warna dan bentuk ini tetap sebatas preview; komponen di atas mempertahankan tampilan aktif aplikasi.</Text>
    </View>

    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Pilihan</Text>
      <View style={styles.row}>
        {["Paket harian", "Paket bulanan"].map((label) => {
          const selected = selectedPlan === label;
          return <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => setSelectedPlan(label)}
            style={[styles.choice, selected && styles.choiceSelected]}
          >
            <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
          </Pressable>;
        })}
      </View>
      <Text style={styles.helper}>Pilihan aktif: {selectedPlan}</Text>
    </View>

    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Field dan status</Text>
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Nama anak</Text>
        <TextInput accessibilityLabel="Nama anak" placeholder="Masukkan nama anak" placeholderTextColor={palette.muted} style={styles.input} />
        <View style={styles.statusRow}>
          <Text style={styles.bodyText}>Status pembayaran</Text>
          <View style={styles.badge}><Text style={styles.badgeText}>Belum dibayar</Text></View>
        </View>
      </View>
    </View>

    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Kartu ringkasan</Text>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatar}><Text style={styles.avatarText}>N</Text></View>
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>Nadia Hutapea</Text>
            <Text style={styles.helper}>Daycare · Cabang utama</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
        <View style={styles.divider} />
        <Text style={styles.bodyText}>Check-in hari ini</Text>
        <Text style={styles.cardValue}>07.42</Text>
      </View>
    </View>

    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Pengaturan</Text>
      <View style={styles.card}>
        <View style={styles.statusRow}>
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>Pengingat sebelum tutup</Text>
            <Text style={styles.helper}>Kirim pengingat 30 menit sebelumnya</Text>
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Pengingat aktif"
            accessibilityState={{ checked: reminderEnabled }}
            onPress={() => setReminderEnabled((enabled) => !enabled)}
            style={[styles.switchTrack, reminderEnabled && styles.switchTrackOn]}
          >
            <View style={[styles.switchThumb, reminderEnabled && styles.switchThumbOn]} />
          </Pressable>
        </View>
      </View>
    </View>
    <BottomSheet
      visible={sheetVisible}
      onClose={() => setSheetVisible(false)}
      title="Buat pesanan"
      closeAccessibilityLabel="Tutup panel"
      negativeAction={{ label: "Batal", onPress: () => setSheetVisible(false) }}
      positiveAction={{ label: "Lanjut", onPress: () => setSheetVisible(false) }}
    >
      <AppText>Panel ini cocok untuk tindakan singkat tanpa meninggalkan halaman.</AppText>
    </BottomSheet>
  </ScrollView>;
}

function InfoRowsPreview() {
  return <View style={styles.stack}>
    <InfoRow label="Status" value="Aktif" icon="checkmark-circle-outline" />
    <InfoRow label="Check-in hari ini" value="07.42" icon="time-outline" />
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.canvas },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: 24, paddingBottom: 48, gap: 28 },
  header: { gap: 8, paddingTop: 12 },
  eyebrow: { color: palette.goldDark, fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: palette.text, fontSize: 30, fontWeight: "800", letterSpacing: -0.7 },
  subtitle: { color: palette.muted, fontSize: 15, lineHeight: 22, maxWidth: 560 },
  section: { gap: 12 },
  sectionTitle: { color: palette.text, fontSize: 18, fontWeight: "700" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  primaryButton: { minHeight: 48, justifyContent: "center", alignItems: "center", backgroundColor: palette.gold, borderRadius: 14, paddingHorizontal: 20 },
  primaryButtonText: { color: palette.text, fontSize: 15, fontWeight: "700" },
  secondaryButton: { minHeight: 48, justifyContent: "center", alignItems: "center", backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 14, paddingHorizontal: 20 },
  secondaryButtonText: { color: palette.text, fontSize: 15, fontWeight: "600" },
  choice: { minHeight: 42, justifyContent: "center", paddingHorizontal: 16, borderWidth: 1, borderColor: palette.border, borderRadius: 12, backgroundColor: palette.surface },
  choiceSelected: { backgroundColor: palette.goldSoft, borderColor: palette.gold },
  choiceText: { color: palette.muted, fontSize: 14, fontWeight: "600" },
  choiceTextSelected: { color: palette.goldDark },
  helper: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  stack: { gap: 12 },
  screenPreview: { height: 330, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: palette.border },
  screenFooter: { color: palette.text, padding: 12, textAlign: "center", backgroundColor: palette.surface },
  card: { gap: 14, padding: 18, borderRadius: 18, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  fieldLabel: { color: palette.text, fontSize: 14, fontWeight: "600" },
  input: { minHeight: 48, borderWidth: 1, borderColor: palette.border, borderRadius: 12, paddingHorizontal: 14, color: palette.text, fontSize: 15, backgroundColor: palette.surface },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  bodyText: { color: palette.text, fontSize: 14, fontWeight: "500" },
  badge: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: palette.goldSoft },
  badgeText: { color: palette.goldDark, fontSize: 12, fontWeight: "700" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: palette.tealSoft },
  avatarText: { color: palette.teal, fontSize: 17, fontWeight: "800" },
  cardCopy: { flex: 1, gap: 3 },
  cardTitle: { color: palette.text, fontSize: 15, fontWeight: "700" },
  chevron: { color: palette.muted, fontSize: 25, lineHeight: 28 },
  divider: { height: 1, backgroundColor: palette.border },
  cardValue: { color: palette.teal, fontSize: 22, fontWeight: "800" },
  switchTrack: { width: 48, height: 28, justifyContent: "center", padding: 3, borderRadius: 999, backgroundColor: palette.border },
  switchTrackOn: { alignItems: "flex-end", backgroundColor: palette.teal },
  switchThumb: { width: 22, height: 22, borderRadius: 999, backgroundColor: palette.surface },
  switchThumbOn: { backgroundColor: "#FFFFFF" },
});
