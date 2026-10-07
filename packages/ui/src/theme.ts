// Dark navy theme matching the Usia Emas badge: navy #202D41 is the logo
// background, gold accents come from its rings and lettering. Every text/icon
// pair below meets WCAG AA (4.5:1 for text, 3:1 for controls) on the surfaces
// it is used with.
export const colors = {
  primary: "#E6BE76",
  primaryPressed: "#C9A15E",
  danger: "#FF8FA0",
  background: "#202D41",
  surface: "#2B3A52",
  surfaceTint: "#26344B",
  dangerSoft: "#4A2C3A",
  accent: "#87CDB5",
  accentSoft: "#23443F",
  text: "#F7F1E3",
  muted: "#C3BBA8",
  border: "#41526E",
  disabled: "#36455E",
  // Text and icons on primary (gold) and danger fills.
  onPrimary: "#1A2436",
  success: "#7FD6AC",
  successSoft: "#20403A",
  warning: "#F5C46A",
  warningSoft: "#4A3B22",
  info: "#93C7F0",
  infoSoft: "#233D57",
  overlay: "rgba(8, 12, 20, 0.6)",
  // Off-state track for switches: 3:1 against the card surface so the control stays visible.
  switchOff: "#8090A8",
  // Lines and labels drawn over a live camera preview or photo stay white regardless of theme.
  onMedia: "#FFFFFF",
  // Letterbox behind a camera preview or photo before it renders.
  mediaBackground: "#000000",
  // QR codes need a light quiet zone to stay scannable on a dark theme.
  codeSurface: "#FFFFFF",
  shadow: "#000000",
} as const;

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

/** Foreground / background / icon for status surfaces (banners, badges, toasts). */
export const toneColors: Record<Tone, { foreground: string; background: string; border: string }> = {
  neutral: { foreground: colors.text, background: colors.disabled, border: colors.border },
  info: { foreground: colors.info, background: colors.infoSoft, border: colors.infoSoft },
  success: { foreground: colors.success, background: colors.successSoft, border: colors.successSoft },
  warning: { foreground: colors.warning, background: colors.warningSoft, border: colors.warningSoft },
  danger: { foreground: colors.danger, background: colors.dangerSoft, border: colors.dangerSoft },
};

export const toneIcons = {
  neutral: "information-circle",
  info: "information-circle",
  success: "checkmark-circle",
  warning: "warning",
  danger: "alert-circle",
} as const satisfies Record<Tone, string>;

export const backgroundGradient = { colors: ["#1B2638", "#202D41", "#26364F"], locations: [0, 0.5, 1] } as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

export const shadows = {
  sm: { shadowColor: colors.shadow, shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  md: { shadowColor: colors.shadow, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
} as const;

export const typography = {
  h1: { fontSize: 32, lineHeight: 40, fontWeight: "700", letterSpacing: -0.4 },
  h2: { fontSize: 28, lineHeight: 36, fontWeight: "700", letterSpacing: -0.3 },
  h3: { fontSize: 24, lineHeight: 32, fontWeight: "700", letterSpacing: -0.2 },
  h4: { fontSize: 20, lineHeight: 28, fontWeight: "600" },
  h5: { fontSize: 18, lineHeight: 26, fontWeight: "600" },
  h6: { fontSize: 16, lineHeight: 24, fontWeight: "600" },
  bodyLarge: { fontSize: 18, lineHeight: 28, fontWeight: "400" },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" },
  bodySmall: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
  label: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "500" },
  overline: { fontSize: 11, lineHeight: 16, fontWeight: "700", letterSpacing: 0.5 },
} as const satisfies Record<string, TextStyle>;
import type { TextStyle } from "react-native";
