import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText, BottomSheet, Button, colors, radius, spacing } from "@daycare/ui";
import { useI18n } from "@/i18n/I18nProvider";
import { supportedLocales, type AppLocale } from "@/i18n/translations";

const localeLabels: Record<AppLocale, string> = {
  id: "Bahasa Indonesia",
  en: "English",
  zh: "中文（简体）",
  fr: "Français",
  pt: "Português",
  es: "Español",
  ru: "Русский",
};

export function LanguageSelectField() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const select = (next: AppLocale) => { void setLocale(next); close(); };

  return <View style={styles.field}>
    <AppText variant="label">{t("profile.language")}</AppText>
    <Pressable accessibilityRole="button" accessibilityLabel={t("profile.language")} onPress={() => setOpen(true)} style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}>
      <AppText>{localeLabels[locale]}</AppText>
      <AppText variant="label" tone="muted">⌄</AppText>
    </Pressable>
    <BottomSheet visible={open} onClose={close} closeAccessibilityLabel={t("common.close")} title={t("profile.language")}>
      <View style={styles.options}>{supportedLocales.map((item) => <Button key={item} variant={item === locale ? "primary" : "secondary"} onPress={() => select(item)}>{localeLabels[item]}</Button>)}</View>
    </BottomSheet>
  </View>;
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  trigger: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  options: { gap: spacing.sm },
  pressed: { opacity: 0.82 },
});
