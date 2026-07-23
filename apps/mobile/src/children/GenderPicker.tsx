import { Pressable, StyleSheet, View } from "react-native";
import { childGenders, type ChildGender } from "@daycare/core";
import { AppText, colors, radius, spacing } from "@daycare/ui";
import { useI18n } from "@/i18n/I18nProvider";

type GenderPickerProps = {
  value?: ChildGender;
  onChange: (gender: ChildGender) => void;
};

export function GenderPicker({ value, onChange }: GenderPickerProps) {
  const { t } = useI18n();
  return <>
    <AppText variant="label">{t("children.gender")}</AppText>
    <View accessibilityRole="radiogroup" accessibilityLabel={t("children.gender")} style={styles.options}>{childGenders.map((gender) => {
      const selected = value === gender;
      const label = t(gender === "MALE" ? "children.genderMale" : "children.genderFemale");
      return <Pressable key={gender} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ selected }} onPress={() => onChange(gender)} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}>
        <View style={[styles.indicator, selected && styles.indicatorSelected]}>{selected && <View style={styles.indicatorDot} />}</View>
        <AppText>{label}</AppText>
      </Pressable>;
    })}</View>
  </>;
}

const styles = StyleSheet.create({
  options: { flexDirection: "row", gap: spacing.sm },
  option: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.surfaceTint },
  indicator: { width: 20, height: 20, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.muted, borderRadius: radius.pill },
  indicatorSelected: { borderColor: colors.primary },
  indicatorDot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.primary },
  pressed: { opacity: 0.7 },
});
