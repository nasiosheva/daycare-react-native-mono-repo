import { useEffect, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, BottomSheet, Button, FloatingActionButton, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";

export default function CurriculumProgramsScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.role === "STAFF_ADMIN" && membership.active;
  const periods = useQuery({ queryKey: ["learning-periods", organizationId], queryFn: () => api.academicYears(), enabled: Boolean(membership) });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);
  const programs = useQuery({ queryKey: ["curriculum-programs", organizationId, debouncedSearch], queryFn: () => api.curriculumPrograms(debouncedSearch || undefined), enabled: Boolean(membership) });
  const createProgram = useMutation({ mutationFn: api.createCurriculumProgram.bind(api), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["curriculum-programs", organizationId] }) });
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [periodId, setPeriodId] = useState<string | undefined>();

  if (!profile) return null;
  if (!membership || !["STAFF_ADMIN", "STAFF"].includes(membership.role)) return <Redirect href="/home" />;

  const close = () => { setVisible(false); setName(""); setDescription(""); setPeriodId(undefined); };
  const openAdd = () => setVisible(true);
  const save = async () => {
    if (!name.trim()) return Alert.alert(t("academic.programRequired"));
    try {
      await createProgram.mutateAsync({ academicYearId: periodId, name: name.trim(), description: description.trim() });
      close();
    } catch (error) { Alert.alert(t("learning.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };

  return <AppScreen showBottomNavigation={false} title={t("academic.program")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={canManage ? <FloatingActionButton accessibilityLabel={t("academic.addProgram")} onPress={openAdd}>+ {t("academic.addProgram")}</FloatingActionButton> : undefined}>
    <AppText variant="h5">{t("academic.program")}</AppText>
    <AppText variant="bodySmall" tone="muted">{t("academic.addProgramDescription")}</AppText>
    <TextInput style={styles.input} placeholder={t("academic.searchPrograms")} value={search} onChangeText={setSearch} />
    {programs.isFetching && <ShimmerList />}
    {programs.isError && <Button variant="secondary" onPress={() => programs.refetch()}>{t("common.retry")}</Button>}
    {!programs.isFetching && programs.data?.map((program) => <View key={program.id} style={styles.card}>
      <AppText variant="label">{program.name}</AppText>
      {program.description ? <AppText tone="muted">{program.description}</AppText> : null}
      <AppText variant="caption" tone="muted">{periods.data?.find((period) => period.id === program.academicYearId)?.name ?? t("common.noData")}{program.source === "GLOBAL" ? ` · ${t("globalCurriculum.global")}` : ""}</AppText>
    </View>)}
    {!programs.isFetching && !programs.isError && programs.data?.length === 0 && <AppText tone="muted">{t("academic.noPrograms")}</AppText>}

    <BottomSheet visible={visible} onClose={close} closeAccessibilityLabel={t("common.close")} title={t("academic.addProgram")} negativeAction={{ label: t("common.cancel"), onPress: close }} positiveAction={{ label: t("academic.addProgram"), loading: createProgram.isPending, onPress: () => void save() }}>
      <View style={styles.options}>{periods.data?.map((period) => <Button key={period.id} variant={periodId === period.id ? "primary" : "secondary"} onPress={() => setPeriodId(period.id)}>{period.name}</Button>)}</View>
      <TextInput style={styles.input} placeholder={t("academic.programName")} value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder={t("academic.description")} value={description} onChangeText={setDescription} />
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTint },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
