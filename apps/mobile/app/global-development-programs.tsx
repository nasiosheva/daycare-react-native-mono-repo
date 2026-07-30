import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DevelopmentProgram, UpsertDevelopmentProgramInput } from "@daycare/api-client";
import { goalDomains, type GoalDomain } from "@daycare/core";
import { AppText, BackButton, BottomSheet, Button, FloatingActionButton, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { goalDomainKey } from "@/i18n/translations";
import { AppScreen } from "@/navigation/AppScreen";

type Sheet = "form" | "delete" | null;

export default function GlobalDevelopmentProgramsScreen() {
  const router = useRouter();
  const { api, profile } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const programs = useQuery({ queryKey: ["global-development-programs"], queryFn: () => api.globalDevelopmentPrograms(), enabled: Boolean(profile?.isPlatformAdmin) });
  const levels = useQuery({ queryKey: ["global-learning-levels"], queryFn: () => api.globalLearningLevels(), enabled: Boolean(profile?.isPlatformAdmin) });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["global-development-programs"] });
  const createProgram = useMutation({ mutationFn: (input: UpsertDevelopmentProgramInput) => api.createGlobalDevelopmentProgram(input), onSuccess: refresh });
  const updateProgram = useMutation({ mutationFn: ({ id, input }: { id: string; input: UpsertDevelopmentProgramInput }) => api.updateGlobalDevelopmentProgram(id, input), onSuccess: refresh });
  const reviseProgram = useMutation({ mutationFn: ({ id, input }: { id: string; input: UpsertDevelopmentProgramInput }) => api.reviseGlobalDevelopmentProgram(id, input), onSuccess: refresh });
  const deleteProgram = useMutation({ mutationFn: (id: string) => api.deleteGlobalDevelopmentProgram(id), onSuccess: refresh });

  const [sheet, setSheet] = useState<Sheet>(null);
  const [editing, setEditing] = useState<DevelopmentProgram>();
  const [revisionOf, setRevisionOf] = useState<DevelopmentProgram>();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationDays, setDurationDays] = useState("100");
  const [minimumPercent, setMinimumPercent] = useState("90");
  const [minimumStreak, setMinimumStreak] = useState("14");
  const [learningLevelId, setLearningLevelId] = useState<string>();
  const [domain, setDomain] = useState<GoalDomain>();
  const [indicatorNames, setIndicatorNames] = useState<string[]>([""]);

  if (!profile) return null;
  if (!profile.isPlatformAdmin) return <Redirect href="/home" />;

  const closeSheet = () => {
    setSheet(null);
    setEditing(undefined);
    setRevisionOf(undefined);
    setName("");
    setDescription("");
    setDurationDays("100");
    setMinimumPercent("90");
    setMinimumStreak("14");
    setLearningLevelId(undefined);
    setDomain(undefined);
    setIndicatorNames([""]);
  };
  const openCreate = () => { closeSheet(); setSheet("form"); };
  const openEdit = (program: DevelopmentProgram) => {
    setEditing(program);
    setName(program.name);
    setDescription(program.description);
    setDurationDays(String(program.durationDays));
    setMinimumPercent(String(program.minimumYesPercent));
    setMinimumStreak(String(program.minimumYesStreak));
    setLearningLevelId(program.learningLevelId);
    setDomain(program.domain);
    setSheet("form");
  };
  const openRevision = (program: DevelopmentProgram) => {
    setRevisionOf(program);
    setName(program.name);
    setDescription(program.description);
    setDurationDays(String(program.durationDays));
    setMinimumPercent(String(program.minimumYesPercent));
    setMinimumStreak(String(program.minimumYesStreak));
    setLearningLevelId(program.learningLevelId);
    setDomain(program.domain);
    setIndicatorNames(program.indicators.map((indicator) => indicator.name));
    setSheet("form");
  };
  const openDelete = (program: DevelopmentProgram) => { setEditing(program); setSheet("delete"); };

  const updateIndicatorName = (index: number, value: string) => setIndicatorNames((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
  const addIndicatorField = () => setIndicatorNames((current) => [...current, ""]);
  const removeIndicatorField = (index: number) => setIndicatorNames((current) => current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current);

  const save = async () => {
    const duration = Number(durationDays);
    const percent = Number(minimumPercent);
    const streak = Number(minimumStreak);
    if (!name.trim() || !learningLevelId || !domain || !Number.isInteger(duration) || duration < 1 || !Number.isInteger(percent) || percent < 0 || percent > 100 || !Number.isInteger(streak) || streak < 0) {
      Alert.alert(t("globalDevelopmentPrograms.required"));
      return;
    }
    const input: UpsertDevelopmentProgramInput = { learningLevelId, name: name.trim(), description: description.trim(), durationDays: duration, minimumYesPercent: percent, minimumYesStreak: streak, domain };
    if (!editing || revisionOf) input.indicatorNames = indicatorNames.map((item) => item.trim()).filter(Boolean);
    try {
      if (revisionOf) await reviseProgram.mutateAsync({ id: revisionOf.id, input });
      else if (editing) await updateProgram.mutateAsync({ id: editing.id, input });
      else await createProgram.mutateAsync(input);
      closeSheet();
    } catch (error) {
      Alert.alert(t("globalDevelopmentPrograms.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"));
    }
  };
  const remove = async () => {
    if (!editing) return;
    try {
      await deleteProgram.mutateAsync(editing.id);
      closeSheet();
    } catch (error) {
      Alert.alert(t("globalDevelopmentPrograms.deleteFailed"), error instanceof Error ? error.message : t("auth.tryAgain"));
    }
  };

  return <AppScreen showBottomNavigation={false} title={t("globalDevelopmentPrograms.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={<FloatingActionButton accessibilityLabel={t("globalDevelopmentPrograms.add")} onPress={openCreate}>+ {t("globalDevelopmentPrograms.add")}</FloatingActionButton>}>
    <AppText tone="muted">{t("globalDevelopmentPrograms.subtitle")}</AppText>
    {programs.isFetching && <ShimmerList />}
    {programs.isError && <Button variant="secondary" onPress={() => programs.refetch()}>{t("common.retry")}</Button>}
    {!programs.isFetching && !programs.isError && programs.data?.length === 0 && <AppText tone="muted">{t("globalDevelopmentPrograms.empty")}</AppText>}
    {!programs.isFetching && programs.data?.map((program) => <View key={program.id} style={styles.card}>
      <AppText variant="label">{program.name}</AppText>
      <AppText tone="muted">{t(goalDomainKey(program.domain))}</AppText>
      {program.description ? <AppText tone="muted">{program.description}</AppText> : null}
      <AppText variant="caption" tone="muted">{t("globalDevelopmentPrograms.revision", { count: program.revisionNumber })}</AppText>
      {!program.active && <AppText variant="caption" tone="muted">{t("globalDevelopmentPrograms.superseded")}</AppText>}
      <AppText variant="caption" tone="muted">{t("goals.target", { days: program.durationDays, percent: program.minimumYesPercent, streak: program.minimumYesStreak })}</AppText>
      <View style={styles.actions}>
        <Button variant="secondary" onPress={() => openEdit(program)}>{t("common.edit")}</Button>
        {program.active && <Button variant="secondary" onPress={() => openRevision(program)}>{t("globalDevelopmentPrograms.revise")}</Button>}
        <Button variant="danger" onPress={() => openDelete(program)}>{t("common.delete")}</Button>
      </View>
    </View>)}

    <BottomSheet
      visible={sheet === "form"}
      onClose={closeSheet}
      closeAccessibilityLabel={t("common.close")}
      title={t(revisionOf ? "globalDevelopmentPrograms.revise" : editing ? "globalDevelopmentPrograms.edit" : "globalDevelopmentPrograms.add")}
      negativeAction={{ label: t("common.cancel"), onPress: closeSheet }}
      positiveAction={{ label: t("common.save"), loading: createProgram.isPending || updateProgram.isPending || reviseProgram.isPending, onPress: () => void save() }}
    >
      <TextInput style={styles.input} placeholder={t("goals.templateName")} value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder={t("goals.templateDescription")} value={description} onChangeText={setDescription} />
      <AppText variant="label">{t("goals.learningLevel")}</AppText>
      {levels.data?.length === 0 && <AppText tone="muted">{t("globalDevelopmentPrograms.noLevels")}</AppText>}
      <View style={styles.options}>{levels.data?.filter((level) => level.active).map((level) => <Button key={level.id} variant={learningLevelId === level.id ? "primary" : "secondary"} onPress={() => setLearningLevelId(level.id)}>{level.name}</Button>)}</View>
      <AppText variant="label">{t("goals.categoryOptional")}</AppText>
      <View style={styles.options}>{goalDomains.map((item) => <Button key={item} variant={domain === item ? "primary" : "secondary"} onPress={() => setDomain(item)}>{t(goalDomainKey(item))}</Button>)}</View>
      <AppText variant="label">{t("goals.durationDays")}</AppText>
      <TextInput style={styles.input} inputMode="numeric" value={durationDays} onChangeText={setDurationDays} />
      <AppText variant="label">{t("goals.minimumPercent")}</AppText>
      <TextInput style={styles.input} inputMode="numeric" value={minimumPercent} onChangeText={setMinimumPercent} />
      <AppText variant="label">{t("goals.minimumStreak")}</AppText>
      <TextInput style={styles.input} inputMode="numeric" value={minimumStreak} onChangeText={setMinimumStreak} />
      {(!editing || revisionOf) && <View style={styles.field}>
        <View style={styles.fieldHeader}><AppText variant="label">{t("goals.indicators")}</AppText><Button variant="secondary" onPress={addIndicatorField}>{t("goals.addIndicator")}</Button></View>
        <AppText variant="caption" tone="muted">{t("goals.indicatorsInfo")}</AppText>
        {indicatorNames.map((value, index) => <View key={index} style={styles.indicatorRow}>
          <TextInput style={[styles.input, styles.indicatorName]} placeholder={t("goals.indicatorName")} value={value} onChangeText={(text) => updateIndicatorName(index, text)} />
          {indicatorNames.length > 1 && <Button variant="secondary" onPress={() => removeIndicatorField(index)}>{t("common.delete")}</Button>}
        </View>)}
      </View>}
      {editing && !revisionOf && <View style={styles.field}>
        <AppText variant="label">{t("goals.indicators")}</AppText>
        <AppText variant="caption" tone="muted">{t("globalDevelopmentPrograms.indicatorsLocked")}</AppText>
        {editing.indicators.map((indicator) => <AppText key={indicator.id} tone={indicator.active ? "default" : "muted"}>{indicator.name}</AppText>)}
      </View>}
    </BottomSheet>

    <BottomSheet visible={sheet === "delete"} onClose={closeSheet} closeAccessibilityLabel={t("common.close")} title={t("common.delete")} negativeAction={{ label: t("common.cancel"), onPress: closeSheet }} positiveAction={{ label: t("common.delete"), variant: "danger", loading: deleteProgram.isPending, onPress: () => void remove() }}>
      <AppText tone="muted">{t("globalDevelopmentPrograms.deleteConfirmation", { name: editing?.name ?? "" })}</AppText>
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  field: { gap: spacing.xs },
  fieldHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  indicatorRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  indicatorName: { flex: 1 },
});
