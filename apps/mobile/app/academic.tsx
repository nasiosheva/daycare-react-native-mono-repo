import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, Button, colors, radius, spacing } from "@daycare/ui";
import { hasInstitutionCapability } from "@daycare/core";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { institutionTypeKey } from "@/i18n/translations";
import { AppScreen } from "@/navigation/AppScreen";

export default function AcademicScreen() {
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const hasAcademicCurriculum = hasInstitutionCapability(membership?.capabilities, "ACADEMIC_CURRICULUM");
  const academicYears = useQuery({ queryKey: ["academic-years", organizationId], queryFn: () => api.academicYears(), enabled: Boolean(hasAcademicCurriculum) });
  const curriculumPrograms = useQuery({ queryKey: ["curriculum-programs", organizationId], queryFn: () => api.curriculumPrograms(), enabled: Boolean(hasAcademicCurriculum) });
  const createAcademicYear = useMutation({ mutationFn: api.createAcademicYear.bind(api), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["academic-years", organizationId] }) });
  const createCurriculumProgram = useMutation({ mutationFn: api.createCurriculumProgram.bind(api), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["curriculum-programs", organizationId] }) });
  const [yearName, setYearName] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [programYearId, setProgramYearId] = useState<string | null>(null);
  const [programName, setProgramName] = useState("");
  const [programDescription, setProgramDescription] = useState("");
  if (!membership || !hasAcademicCurriculum || !["STAFF_ADMIN", "STAFF"].includes(membership.role)) return <Redirect href="/home" />;
  const canManage = membership.role === "STAFF_ADMIN";

  const addAcademicYear = async () => {
    if (!yearName.trim() || !startsOn || !endsOn) return Alert.alert(t("academic.yearRequired"));
    try {
      await createAcademicYear.mutateAsync({ name: yearName.trim(), startsOn, endsOn });
      setYearName(""); setStartsOn(""); setEndsOn("");
    } catch (error) { Alert.alert(t("academic.createYearFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const addCurriculumProgram = async () => {
    if (!programYearId || !programName.trim()) return Alert.alert(t("academic.programRequired"));
    try {
      await createCurriculumProgram.mutateAsync({ academicYearId: programYearId, name: programName.trim(), description: programDescription.trim() });
      setProgramName(""); setProgramDescription("");
    } catch (error) { Alert.alert(t("academic.createProgramFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };

  return <AppScreen><AppText variant="title">{t("academic.title")}</AppText>
    <AppText tone="muted">{t("academic.subtitle", { types: membership.institutionTypes.map((type) => t(institutionTypeKey(type))).join(" + ") })}</AppText>
    {canManage && <View style={styles.form}>
      <AppText variant="heading">{t("academic.year")}</AppText>
      <TextInput style={styles.input} placeholder={t("academic.yearExample")} value={yearName} onChangeText={setYearName} />
      <TextInput style={styles.input} placeholder={t("academic.start")} value={startsOn} onChangeText={setStartsOn} />
      <TextInput style={styles.input} placeholder={t("academic.end")} value={endsOn} onChangeText={setEndsOn} />
      <Button loading={createAcademicYear.isPending} onPress={() => void addAcademicYear()}>{t("academic.addYear")}</Button>
    </View>}
    <AppText variant="heading">{t("academic.activeYears")}</AppText>
    {academicYears.data?.map((year) => <View key={year.id} style={styles.card}><AppText variant="label">{year.name}</AppText><AppText tone="muted">{t("academic.range", { start: year.startsOn, end: year.endsOn })}</AppText></View>)}
    {academicYears.data?.length === 0 && <AppText tone="muted">{t("academic.noYears")}</AppText>}
    {canManage && <View style={styles.form}>
      <AppText variant="heading">{t("academic.program")}</AppText>
      <View style={styles.options}>{academicYears.data?.map((year) => <Button key={year.id} variant={programYearId === year.id ? "primary" : "secondary"} onPress={() => setProgramYearId(year.id)}>{year.name}</Button>)}</View>
      <TextInput style={styles.input} placeholder={t("academic.programName")} value={programName} onChangeText={setProgramName} />
      <TextInput style={styles.input} multiline placeholder={t("academic.description")} value={programDescription} onChangeText={setProgramDescription} />
      <Button loading={createCurriculumProgram.isPending} disabled={!academicYears.data?.length} onPress={() => void addCurriculumProgram()}>{t("academic.addProgram")}</Button>
    </View>}
    <AppText variant="heading">{t("academic.program")}</AppText>
    {curriculumPrograms.data?.map((program) => <View key={program.id} style={styles.card}><AppText variant="label">{program.name}</AppText>{program.description && <AppText tone="muted">{program.description}</AppText>}</View>)}
    {curriculumPrograms.data?.length === 0 && <AppText tone="muted">{t("academic.noPrograms")}</AppText>}
  </AppScreen>;
}

const styles = StyleSheet.create({
  form: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
});
