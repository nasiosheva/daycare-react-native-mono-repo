// Mories Deo Hutapea,S.E.,S.Kom
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ComponentDesignPreview } from "./ComponentDesignPreview";

jest.mock("@/i18n/I18nProvider", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

describe("ComponentDesignPreview", () => {
  it("shows the alternative component styles and responds to selection", () => {
    render(<ComponentDesignPreview />);

    expect(screen.getByText("Gaya modern minimal")).toBeTruthy();
    expect(screen.getByText("Status pembayaran")).toBeTruthy();
    expect(screen.getByText("Belum dibayar")).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Paket bulanan" }));
    expect(screen.getByText("Pilihan aktif: Paket bulanan")).toBeTruthy();
  });

  it("keeps the switch preview interactive and accessible", () => {
    render(<ComponentDesignPreview />);
    const control = screen.getAllByRole("switch", { name: "Pengingat aktif" })[0];

    expect(control.props.accessibilityState.checked).toBe(true);
    fireEvent.press(control);
    expect(screen.getAllByRole("switch", { name: "Pengingat aktif" })[0].props.accessibilityState.checked).toBe(false);
  });

  it("clears a clearable text field through its accessible X action", () => {
    render(<ComponentDesignPreview />);
    const input = screen.getByPlaceholderText("Masukkan nama");

    fireEvent.changeText(input, "Nama percobaan");
    expect(input.props.value).toBe("Nama percobaan");
    fireEvent.press(screen.getByRole("button", { name: "Hapus teks" }));
    expect(input.props.value).toBe("");
  });

  it("shows exactly three preview promotion slides", () => {
    render(<ComponentDesignPreview />);

    expect(screen.getByLabelText("Preview slide 1")).toBeTruthy();
    expect(screen.getByLabelText("Preview slide 2")).toBeTruthy();
    expect(screen.getByLabelText("Preview slide 3")).toBeTruthy();
    expect(screen.queryByLabelText("Preview slide 4")).toBeNull();
  });

  it("previews every shared UI component category", () => {
    render(<ComponentDesignPreview />);

    for (const component of [
      "AppText",
      "AudioPlayer",
      "Avatar",
      "BackButton",
      "Badge",
      "Banner",
      "BottomSheet",
      "Button",
      "Card",
      "Chip",
      "EmptyState",
      "FloatingActionButton",
      "InlineFeedback",
      "MenuItem",
      "MultiStepFormWizard",
      "NavigationCard",
      "PasswordInput",
      "PinEntryScreen",
      "Screen",
      "SectionHeader",
      "Shimmer",
      "TabBar",
      "TextField",
      "ToggleSwitch",
    ]) {
      expect(screen.getByTestId(`component-${component}`)).toBeTruthy();
    }
  });

  it("lets users inspect interactive sheet, wizard, and full-screen examples", () => {
    render(<ComponentDesignPreview />);

    fireEvent.press(screen.getByRole("button", { name: "Buka BottomSheet" }));
    expect(screen.getByText("Panel ini cocok untuk tindakan singkat tanpa meninggalkan halaman.")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Batal" }));
    fireEvent.press(screen.getByRole("button", { name: "Buka BottomSheet" }));
    fireEvent.press(screen.getByRole("button", { name: "Lanjut" }));

    expect(screen.getByText("Langkah 2 dari 3")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Berikutnya" }));
    expect(screen.getByText("Langkah 3 dari 3")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Sebelumnya" }));
    expect(screen.getByText("Langkah 2 dari 3")).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Buka pratinjau PIN" }));
    expect(screen.getByText("Pratinjau PIN")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "3" }));
    expect(screen.getByLabelText("3 of 6 PIN digits entered")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Kembali ke galeri komponen" }));
    expect(screen.getByText("Gaya modern minimal")).toBeTruthy();
  });

  it("exercises the shared component examples and their primary actions", () => {
    render(<ComponentDesignPreview />);

    fireEvent.press(screen.getByRole("button", { name: "Putar pesan suara" }));
    fireEvent.press(screen.getByRole("button", { name: "Kembali" }));
    fireEvent.press(screen.getByRole("button", { name: "Utama" }));
    fireEvent.press(screen.getByRole("button", { name: "Sekunder" }));
    fireEvent.press(screen.getByRole("button", { name: "Hapus" }));
    fireEvent.press(screen.getByRole("button", { name: "Teks saja" }));
    fireEvent.press(screen.getByRole("button", { name: "Muat ulang" }));
    fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    fireEvent.press(screen.getByRole("button", { name: "Tambah catatan" }));
    fireEvent.press(screen.getByRole("button", { name: "Buat baru" }));
    fireEvent.press(screen.getByRole("button", { name: "Data anak. Lihat dan kelola profil anak." }));
    fireEvent.press(screen.getByRole("button", { name: "Perlu perhatian. Ada konfigurasi yang belum lengkap." }));
    fireEvent.press(screen.getByRole("button", { name: "Buka profil Nadia" }));
    fireEvent.press(screen.getByRole("button", { name: "Lihat semua" }));
    fireEvent.press(screen.getByRole("tab", { name: "Aktif" }));
    fireEvent.press(screen.getByRole("radio", { name: "Izin" }));
    fireEvent.press(screen.getByRole("button", { name: "Tampilkan umpan balik" }));
    fireEvent.press(screen.getAllByRole("switch", { name: "Pengingat aktif" })[1]);

    expect(screen.getByText("Tersimpan")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Aktif" }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole("radio", { name: "Izin" }).props.accessibilityState.checked).toBe(true);
    expect(screen.getAllByRole("switch", { name: "Pengingat aktif" })[1].props.accessibilityState.checked).toBe(false);
  });
});
