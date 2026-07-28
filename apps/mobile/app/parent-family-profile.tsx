import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import type { ParentFamilyProfileInput, ParentIncomeRange, ParentOccupation } from "@daycare/core";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppText, BackButton, Button, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { DatePicker } from "@/date-picker/DatePicker";
import { formatIsoDate } from "@/date-picker/date";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { OptionSelectField } from "@/profile/OptionSelectField";

type FamilyProfileDraft = Required<Pick<ParentFamilyProfileInput, "husbandDateOfBirth" | "wifeDateOfBirth">> & Omit<ParentFamilyProfileInput, "husbandDateOfBirth" | "wifeDateOfBirth">;

const occupationKeys: Record<ParentOccupation, "parentFamily.occupation.PNS" | "parentFamily.occupation.PEGAWAI_SWASTA" | "parentFamily.occupation.PEGAWAI_BUMN" | "parentFamily.occupation.PENGUSAHA" | "parentFamily.occupation.WIRASWASTA" | "parentFamily.occupation.PROFESIONAL" | "parentFamily.occupation.FREELANCER" | "parentFamily.occupation.IBU_RUMAH_TANGGA" | "parentFamily.occupation.TIDAK_BEKERJA" | "parentFamily.occupation.LAINNYA"> = {
  PNS: "parentFamily.occupation.PNS", PEGAWAI_SWASTA: "parentFamily.occupation.PEGAWAI_SWASTA", PEGAWAI_BUMN: "parentFamily.occupation.PEGAWAI_BUMN", PENGUSAHA: "parentFamily.occupation.PENGUSAHA", WIRASWASTA: "parentFamily.occupation.WIRASWASTA", PROFESIONAL: "parentFamily.occupation.PROFESIONAL", FREELANCER: "parentFamily.occupation.FREELANCER", IBU_RUMAH_TANGGA: "parentFamily.occupation.IBU_RUMAH_TANGGA", TIDAK_BEKERJA: "parentFamily.occupation.TIDAK_BEKERJA", LAINNYA: "parentFamily.occupation.LAINNYA",
};
const incomeKeys: Record<ParentIncomeRange, "parentFamily.income.NO_INCOME" | "parentFamily.income.UNDER_3_MILLION" | "parentFamily.income.THREE_TO_FIVE_MILLION" | "parentFamily.income.FIVE_TO_TEN_MILLION" | "parentFamily.income.TEN_TO_TWENTY_MILLION" | "parentFamily.income.OVER_TWENTY_MILLION"> = {
  NO_INCOME: "parentFamily.income.NO_INCOME", UNDER_3_MILLION: "parentFamily.income.UNDER_3_MILLION", THREE_TO_FIVE_MILLION: "parentFamily.income.THREE_TO_FIVE_MILLION", FIVE_TO_TEN_MILLION: "parentFamily.income.FIVE_TO_TEN_MILLION", TEN_TO_TWENTY_MILLION: "parentFamily.income.TEN_TO_TWENTY_MILLION", OVER_TWENTY_MILLION: "parentFamily.income.OVER_TWENTY_MILLION",
};
const occupations = Object.keys(occupationKeys) as ParentOccupation[];
const incomeRanges = Object.keys(incomeKeys) as ParentIncomeRange[];
const emptyDraft = (): FamilyProfileDraft => ({ husbandDateOfBirth: null, husbandOccupation: null, husbandIncomeRange: null, wifeDateOfBirth: null, wifeOccupation: null, wifeIncomeRange: null });

export default function ParentFamilyProfileScreen() {
  const router = useRouter();
  const { profile, updateParentFamilyProfile } = useAuth();
  const { t } = useI18n();
  const [draft, setDraft] = useState<FamilyProfileDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const occupationOptions = useMemo(() => occupations.map((value) => ({ value, label: t(occupationKeys[value]) })), [t]);
  const incomeOptions = useMemo(() => incomeRanges.map((value) => ({ value, label: t(incomeKeys[value]) })), [t]);

  useEffect(() => {
    const current = profile?.parentFamilyProfile;
    setDraft({ husbandDateOfBirth: current?.husbandDateOfBirth ?? null, husbandOccupation: current?.husbandOccupation ?? null, husbandIncomeRange: current?.husbandIncomeRange ?? null, wifeDateOfBirth: current?.wifeDateOfBirth ?? null, wifeOccupation: current?.wifeOccupation ?? null, wifeIncomeRange: current?.wifeIncomeRange ?? null });
  }, [profile?.parentFamilyProfile]);

  if (!profile) return null;
  if (profile.registrationRole !== "PARENT") return <Redirect href="/profile" />;

  const update = <T extends keyof FamilyProfileDraft>(key: T, value: FamilyProfileDraft[T]) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async () => {
    setError(null);
    setSaved(false);
    try { setSaving(true); await updateParentFamilyProfile(draft); setSaved(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t("parentFamily.saveFailed")); }
    finally { setSaving(false); }
  };

  return <AppScreen showBottomNavigation={false} title={t("parentFamily.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <View style={styles.notice}><AppText variant="heading">{t("parentFamily.title")}</AppText><AppText tone="muted">{t("parentFamily.description")}</AppText></View>
    {error && <AppText accessibilityRole="alert" tone="danger">{error}</AppText>}
    {saved && <AppText accessibilityRole="alert">{t("parentFamily.saved")}</AppText>}
    <View style={styles.section}>
      <AppText variant="heading">{t("parentFamily.husband")}</AppText>
      <DatePicker placeholder={t("parentFamily.dateOfBirth")} value={draft.husbandDateOfBirth ?? ""} maximumDate={formatIsoDate(new Date())} onChange={(husbandDateOfBirth) => update("husbandDateOfBirth", husbandDateOfBirth)} onClear={() => update("husbandDateOfBirth", null)} clearAccessibilityLabel={t("common.clear")} />
      <OptionSelectField label={t("parentFamily.occupation")} placeholder={t("parentFamily.selectOccupation")} emptyLabel={t("parentFamily.noSelection")} value={draft.husbandOccupation ?? undefined} options={occupationOptions} onChange={(husbandOccupation) => update("husbandOccupation", husbandOccupation ?? null)} />
      <OptionSelectField label={t("parentFamily.incomeRange")} placeholder={t("parentFamily.selectIncomeRange")} emptyLabel={t("parentFamily.noSelection")} value={draft.husbandIncomeRange ?? undefined} options={incomeOptions} onChange={(husbandIncomeRange) => update("husbandIncomeRange", husbandIncomeRange ?? null)} />
    </View>
    <View style={styles.section}>
      <AppText variant="heading">{t("parentFamily.wife")}</AppText>
      <DatePicker placeholder={t("parentFamily.dateOfBirth")} value={draft.wifeDateOfBirth ?? ""} maximumDate={formatIsoDate(new Date())} onChange={(wifeDateOfBirth) => update("wifeDateOfBirth", wifeDateOfBirth)} onClear={() => update("wifeDateOfBirth", null)} clearAccessibilityLabel={t("common.clear")} />
      <OptionSelectField label={t("parentFamily.occupation")} placeholder={t("parentFamily.selectOccupation")} emptyLabel={t("parentFamily.noSelection")} value={draft.wifeOccupation ?? undefined} options={occupationOptions} onChange={(wifeOccupation) => update("wifeOccupation", wifeOccupation ?? null)} />
      <OptionSelectField label={t("parentFamily.incomeRange")} placeholder={t("parentFamily.selectIncomeRange")} emptyLabel={t("parentFamily.noSelection")} value={draft.wifeIncomeRange ?? undefined} options={incomeOptions} onChange={(wifeIncomeRange) => update("wifeIncomeRange", wifeIncomeRange ?? null)} />
    </View>
    <Button loading={saving} onPress={() => void save()}>{t("common.save")}</Button>
  </AppScreen>;
}

const styles = StyleSheet.create({
  notice: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  section: { gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
});
