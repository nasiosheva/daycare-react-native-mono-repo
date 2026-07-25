import { useEffect, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, BottomSheet, Button, NavigationCard, colors, radius, spacing } from "@daycare/ui";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";

export default function GlobalCurriculumScreen() {
  const router = useRouter();
  const { openAdd: openAddParam } = useLocalSearchParams<{ openAdd?: string }>();
  const { api, profile } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const programs = useQuery({ queryKey: ["global-curriculum-programs"], queryFn: () => api.globalCurriculumPrograms(), enabled: Boolean(profile?.isPlatformAdmin) });
  const createProgram = useMutation({ mutationFn: api.createGlobalCurriculumProgram.bind(api), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["global-curriculum-programs"] }) });
  const [listOpen, setListOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => { if (openAddParam === "1") setSheetOpen(true); }, [openAddParam]);

  if (!profile) return null;
  if (!profile.isPlatformAdmin) return <Redirect href="/home" />;
  const closeSheet = () => { setSheetOpen(false); setName(""); setDescription(""); };
  const openAdd = () => { setListOpen(false); setSheetOpen(true); };
  const save = async () => {
    if (!name.trim()) return Alert.alert(t("globalCurriculum.required"));
    try {
      await createProgram.mutateAsync({ name: name.trim(), description: description.trim() });
      closeSheet();
    } catch (error) {
      Alert.alert(t("globalCurriculum.failed"), error instanceof Error ? error.message : t("auth.tryAgain"));
    }
  };

  return <AppScreen showBottomNavigation={false} title={t("globalCurriculum.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <AppText tone="muted">{t("globalCurriculum.subtitle")}</AppText>
    <NavigationCard accessibilityLabel={t("globalCurriculum.title")} onPress={() => setListOpen(true)}>
      <AppText variant="h5">{t("globalCurriculum.title")}</AppText>
      <AppText tone={programs.data?.length ? "default" : "muted"}>{programs.isLoading ? t("common.loading") : programs.data?.length ? t("globalCurriculum.programsSummary", { count: programs.data.length }) : t("globalCurriculum.empty")}</AppText>
    </NavigationCard>
    <BottomSheet visible={listOpen} onClose={() => setListOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("globalCurriculum.title")}>
      <Button onPress={openAdd}>{t("globalCurriculum.add")}</Button>
      {programs.isLoading && <AppText>{t("common.loading")}</AppText>}
      {programs.data?.map((program) => <View key={program.id} style={styles.card}><AppText variant="label">{program.name}</AppText>{program.description && <AppText tone="muted">{program.description}</AppText>}</View>)}
      {!programs.isLoading && programs.data?.length === 0 && <AppText tone="muted">{t("globalCurriculum.empty")}</AppText>}
    </BottomSheet>
    <BottomSheet visible={sheetOpen} onClose={closeSheet} closeAccessibilityLabel={t("common.close")} title={t("globalCurriculum.add")} negativeAction={{ label: t("common.cancel"), onPress: closeSheet }} positiveAction={{ label: t("common.save"), loading: createProgram.isPending, disabled: !name.trim(), onPress: () => void save() }}>
      <TextInput style={styles.input} placeholder={t("academic.programName")} value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder={t("academic.description")} value={description} onChangeText={setDescription} multiline />
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
});
