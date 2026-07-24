export const colors = {
  primary: "#B93659",
  primaryPressed: "#922440",
  danger: "#A92C43",
  background: "#FFF7F8",
  surface: "#FFFFFF",
  surfaceTint: "#FFF0F3",
  dangerSoft: "#FCE8ED",
  accent: "#87CDB5",
  accentSoft: "#E8F7F1",
  text: "#3D2632",
  muted: "#806674",
  border: "#F0C9D4",
  disabled: "#F5E3E8",
  onPrimary: "#FFFFFF",
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

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
