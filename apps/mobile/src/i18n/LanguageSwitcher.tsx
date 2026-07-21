import { Pressable, StyleSheet, View } from "react-native";
import { AppText, Button, colors, radius, spacing } from "@daycare/ui";
import { useI18n } from "./I18nProvider";

const localeLabels = { id: "ID", en: "EN" } as const;

type LanguageSwitcherProps = {
  compact?: boolean;
};

export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  if (compact) {
    return <View style={styles.compactContainer}>
      {(["id", "en"] as const).map((item) => {
        const selected = locale === item;
        return <Pressable
          key={item}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          onPress={() => void setLocale(item)}
          style={({ pressed }) => [styles.compactOption, selected && styles.compactOptionSelected, pressed && styles.pressed]}
        >
          <AppText variant="label" style={selected ? styles.compactLabelSelected : styles.compactLabel}>{localeLabels[item]}</AppText>
        </Pressable>;
      })}
    </View>;
  }

  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
    <Button variant={locale === "id" ? "primary" : "secondary"} onPress={() => void setLocale("id")}>{t("common.indonesian")}</Button>
    <Button variant={locale === "en" ? "primary" : "secondary"} onPress={() => void setLocale("en")}>{t("common.english")}</Button>
  </View>;
}

const styles = StyleSheet.create({
  compactContainer: {
    flexDirection: "row",
    alignSelf: "flex-end",
    padding: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  compactOption: {
    minWidth: 44,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
  },
  compactOptionSelected: {
    backgroundColor: colors.primary,
  },
  compactLabel: {
    color: colors.muted,
  },
  compactLabelSelected: {
    color: colors.onPrimary,
  },
  pressed: {
    opacity: 0.84,
  },
});
