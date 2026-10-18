// Mories Deo Hutapea,S.E.,S.Kom
import { useState } from "react";
import { Image, StyleSheet, View, type ImageResizeMode, type ImageStyle, type StyleProp } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText, colors, radius, spacing } from "@daycare/ui";

export function FallbackImage({ uri, accessibilityLabel, fallbackLabel, style, resizeMode = "cover" }: { uri: string; accessibilityLabel: string; fallbackLabel: string; style?: StyleProp<ImageStyle>; resizeMode?: ImageResizeMode }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const imageFailed = failedUri === uri;

  if (imageFailed) return <View accessibilityRole="image" accessibilityLabel={fallbackLabel} style={[style, styles.fallback]}>
    <Ionicons name="image-outline" size={28} color={colors.muted} />
    <AppText variant="caption" tone="muted">{fallbackLabel}</AppText>
  </View>;

  return <Image accessible accessibilityLabel={accessibilityLabel} source={{ uri }} onError={() => setFailedUri(uri)} style={style} resizeMode={resizeMode} />;
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center", gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
});
