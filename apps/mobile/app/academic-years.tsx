import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, BottomSheet, Button, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { DatePicker } from "@/date-picker/DatePicker";

export default function AcademicYearsScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.role === "STAFF_ADMIN" && membership.active;
  const periods = useQuery({ queryKey: ["learning-periods", organizationId], queryFn: () => api.academicYears(), enabled: Boolean(membership) });
  const createPeriod = useMutation({ mutationFn: api.createAcademicYear.bind(api), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["learning-periods", organizationId] }) });
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState(""); const [start, setStart] = useState(""); const [end, setEnd] = useState("");

  if (!profile) return null;
  if (!membership || !["STAFF_ADMIN", "STAFF"].includes(membership.role)) return <Redirect href="/home" />;

  const close = () => { setVisible(false); setName(""); setStart(""); setEnd(""); };
  const save = async () => {
    if (!name.trim() || !start || !end) return Alert.alert(t("academic.yearRequired"));
    try {
      await createPeriod.mutateAsync({ name: name.trim(), startsOn: start, endsOn: end });
      close();
    } catch (error) { Alert.alert(t("learning.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };

  return <AppScreen showBottomNavigation={false} title={t("academic.year")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    {canManage && <Button onPress={() => setVisible(true)}>{t("academic.addYear")}</Button>}
    {periods.data?.map((period) => <View key={period.id} style={styles.card}>
      <AppText variant="label">{period.name}</AppText>
      <AppText tone="muted">{t("academic.range", { start: period.startsOn, end: period.endsOn })}</AppText>
    </View>)}
    {periods.data?.length === 0 && <AppText tone="muted">{t("academic.noYears")}</AppText>}

    <BottomSheet visible={visible} onClose={close} closeAccessibilityLabel={t("common.close")} title={t("academic.addYear")} negativeAction={{ label: t("common.cancel"), onPress: close }} positiveAction={{ label: t("academic.addYear"), loading: createPeriod.isPending, onPress: () => void save() }}>
      <TextInput style={styles.input} placeholder={t("academic.yearExample")} value={name} onChangeText={setName} />
      <DatePicker placeholder={t("academic.start")} value={start} onChange={setStart} maximumDate={end || undefined} />
      <DatePicker placeholder={t("academic.end")} value={end} onChange={setEnd} minimumDate={start || undefined} />
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTint },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
});
