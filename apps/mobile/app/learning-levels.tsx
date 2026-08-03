import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, BottomSheet, Button, FloatingActionButton, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";
import type { LearningLevel } from "@daycare/api-client";
import { hasLegacyLearningAccess, hasOfferingCapability, useUiAccessContext } from "@/education/useUiAccessContext";

export default function LearningLevelsScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.role === "STAFF_ADMIN" && membership.active;
  const access = useUiAccessContext(Boolean(membership));
  const canAccessLegacyClasses = hasLegacyLearningAccess(membership?.capabilities, access.data);
  const hasAcademicOffering = hasOfferingCapability(access.data, "ACADEMIC_CURRICULUM");
  const levelTitle = t(hasAcademicOffering ? "learning.level" : "learning.legacyLevel");
  const addLevelTitle = t(hasAcademicOffering ? "learning.addLevel" : "learning.addLegacyLevel");
  const editLevelTitle = t(hasAcademicOffering ? "learning.editLevel" : "learning.editLegacyLevel");
  const templates = useQuery({ queryKey: ["learning-level-templates", organizationId], queryFn: () => api.learningLevelTemplates(), enabled: canAccessLegacyClasses });
  const programs = useQuery({ queryKey: ["curriculum-programs", organizationId], queryFn: () => api.curriculumPrograms(), enabled: canAccessLegacyClasses && hasAcademicOffering });
  const levels = useQuery({ queryKey: ["learning-levels", organizationId], queryFn: () => api.learningLevels(), enabled: canAccessLegacyClasses });
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["learning-levels", organizationId] }); void queryClient.invalidateQueries({ queryKey: ["classrooms", organizationId] }); };
  const createLevel = useMutation({ mutationFn: api.createLearningLevel.bind(api), onSuccess: refresh });
  const updateLevel = useMutation({ mutationFn: ({ id, input }: { id: string; input: Parameters<typeof api.updateLearningLevel>[1] }) => api.updateLearningLevel(id, input), onSuccess: refresh });
  const [visible, setVisible] = useState(false);
  const [editingLevelId, setEditingLevelId] = useState<string>();
  const [pendingArchive, setPendingArchive] = useState<LearningLevel | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [name, setName] = useState(""); const [minAge, setMinAge] = useState(""); const [maxAge, setMaxAge] = useState(""); const [displayOrder, setDisplayOrder] = useState("0"); const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const archiveLevel = useMutation({
    mutationFn: api.archiveLearningLevel.bind(api),
    onSuccess: () => { refresh(); setPendingArchive(null); },
    onError: (error: unknown) => setArchiveError(error instanceof Error ? error.message : t("learning.archiveFailed")),
  });

  if (!profile) return null;
  if (!membership || !["STAFF_ADMIN", "STAFF"].includes(membership.role)) return <Redirect href="/home" />;
  if (!access.isLoading && !canAccessLegacyClasses) return <Redirect href="/academic" />;

  const failure = (error: unknown) => setFormError(error instanceof Error ? error.message : t("learning.saveFailed"));
  const useTemplate = (templateName: string, minimum?: number | null, maximum?: number | null) => { setName(templateName); setMinAge(minimum?.toString() ?? ""); setMaxAge(maximum?.toString() ?? ""); setFormError(null); };
  const editLevel = (level: LearningLevel) => { setEditingLevelId(level.id); setName(level.name); setMinAge(level.minAgeMonths?.toString() ?? ""); setMaxAge(level.maxAgeMonths?.toString() ?? ""); setDisplayOrder(level.displayOrder.toString()); setSelectedPrograms(level.curriculumProgramIds); setFormError(null); };
  const cancelEdit = () => { setEditingLevelId(undefined); setName(""); setMinAge(""); setMaxAge(""); setDisplayOrder("0"); setSelectedPrograms([]); setFormError(null); };
  const openCreate = () => { cancelEdit(); setDisplayOrder((levels.data?.length ?? 0).toString()); setVisible(true); };
  const openEdit = (level: LearningLevel) => { editLevel(level); setVisible(true); };
  const close = () => { cancelEdit(); setVisible(false); };
  const save = async () => {
    const minimum = parseOptionalNonNegativeInteger(minAge);
    const maximum = parseOptionalNonNegativeInteger(maxAge);
    const order = parseOptionalNonNegativeInteger(displayOrder);
    if (!name.trim()) return setFormError(t(hasAcademicOffering ? "learning.levelRequired" : "learning.legacyLevelRequired"));
    if (minimum === null || maximum === null || (minimum != null && maximum != null && minimum > maximum)) return setFormError(t("learning.invalidAgeRange"));
    if (order == null) return setFormError(t("learning.invalidOrder"));
    const input = { name: name.trim(), minAgeMonths: minimum, maxAgeMonths: maximum, displayOrder: order, curriculumProgramIds: selectedPrograms };
    try {
      if (editingLevelId) await updateLevel.mutateAsync({ id: editingLevelId, input }); else await createLevel.mutateAsync(input);
      close();
    } catch (error) { failure(error); }
  };
  const toggleProgram = (id: string) => setSelectedPrograms((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return <AppScreen showBottomNavigation={false} title={levelTitle} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={canManage ? <FloatingActionButton accessibilityLabel={addLevelTitle} onPress={openCreate}>+ {addLevelTitle}</FloatingActionButton> : undefined}>
    {archiveError && <AppText accessibilityRole="alert" tone="danger">{archiveError}</AppText>}
    {levels.isFetching && <ShimmerList />}
    {levels.isError && <View style={styles.feedback}><AppText accessibilityRole="alert" tone="danger">{t("learning.loadFailed")}</AppText><Button variant="secondary" onPress={() => void levels.refetch()}>{t("common.retry")}</Button></View>}
    {!levels.isFetching && levels.data?.map((level) => <View key={level.id} style={styles.card}>
      <AppText variant="label">{level.name}</AppText>
      <AppText tone="muted">{t("learning.ageMonths", { min: level.minAgeMonths ?? "–", max: level.maxAgeMonths ?? "–" })}</AppText>
      <AppText variant="caption" tone="muted">{t("learning.order")}: {level.displayOrder}</AppText>
      {!level.active && <AppText tone="muted">{t("learning.archived")}</AppText>}
      {canManage && level.active && <View style={styles.options}>
        <IconButton icon="pencil-outline" tone="secondary" accessibilityLabel={t("learning.edit")} onPress={() => openEdit(level)} />
        <IconButton icon="trash-outline" tone="danger" accessibilityLabel={t("learning.archive")} disabled={archiveLevel.isPending} onPress={() => { setArchiveError(null); setPendingArchive(level); }} />
      </View>}
    </View>)}
    {!levels.isFetching && !levels.isError && levels.data?.length === 0 && <AppText tone="muted">{t(hasAcademicOffering ? "learning.noLevels" : "learning.noLegacyLevels")}</AppText>}

    <BottomSheet visible={visible} onClose={close} closeAccessibilityLabel={t("common.close")} title={editingLevelId ? editLevelTitle : addLevelTitle} negativeAction={{ label: t("common.cancel"), onPress: close }} positiveAction={{ label: editingLevelId ? t("common.save") : addLevelTitle, loading: createLevel.isPending || updateLevel.isPending, onPress: () => void save() }}>
      {formError && <AppText accessibilityRole="alert" tone="danger">{formError}</AppText>}
      <AppText variant="label">{t("learning.templates")}</AppText>
      {templates.isLoading && <ShimmerList variant="tile" />}
      {templates.isError && <View style={styles.feedback}><AppText accessibilityRole="alert" tone="danger">{t("learning.loadFailed")}</AppText><Button variant="secondary" onPress={() => void templates.refetch()}>{t("common.retry")}</Button></View>}
      {!templates.isLoading && <View style={styles.options}>{templates.data?.map((template) => <Button key={template.code} variant="secondary" onPress={() => useTemplate(template.name, template.minAgeMonths, template.maxAgeMonths)}>{template.name}</Button>)}</View>}
      <TextInput style={styles.input} placeholder={t(hasAcademicOffering ? "learning.levelName" : "learning.legacyLevelName")} value={name} onChangeText={(value) => { setName(value); setFormError(null); }} />
      <TextInput style={styles.input} inputMode="numeric" placeholder={t("learning.minAge")} value={minAge} onChangeText={(value) => { setMinAge(value); setFormError(null); }} />
      <TextInput style={styles.input} inputMode="numeric" placeholder={t("learning.maxAge")} value={maxAge} onChangeText={(value) => { setMaxAge(value); setFormError(null); }} />
      <TextInput style={styles.input} inputMode="numeric" placeholder={t("learning.order")} value={displayOrder} onChangeText={(value) => { setDisplayOrder(value); setFormError(null); }} />
      {hasAcademicOffering && <><AppText variant="label">{t("academic.program")}</AppText>
        {programs.isLoading && <ShimmerList variant="tile" />}
        {programs.isError && <View style={styles.feedback}><AppText accessibilityRole="alert" tone="danger">{t("learning.loadFailed")}</AppText><Button variant="secondary" onPress={() => void programs.refetch()}>{t("common.retry")}</Button></View>}
        {!programs.isLoading && <View style={styles.options}>{programs.data?.map((program) => <Button key={program.id} variant={selectedPrograms.includes(program.id) ? "primary" : "secondary"} onPress={() => toggleProgram(program.id)}>{program.name}{program.source === "GLOBAL" ? ` · ${t("globalCurriculum.global")}` : ""}</Button>)}</View>}
      </>}
    </BottomSheet>

    <BottomSheet visible={pendingArchive !== null} onClose={() => setPendingArchive(null)} closeAccessibilityLabel={t("common.close")} title={t("learning.archive")} negativeAction={{ label: t("common.cancel"), onPress: () => setPendingArchive(null) }} positiveAction={{ label: t("learning.archive"), variant: "danger", loading: archiveLevel.isPending, onPress: () => pendingArchive && archiveLevel.mutate(pendingArchive.id) }}>
      <AppText tone="muted">{t("learning.archiveConfirmation", { name: pendingArchive?.name ?? "" })}</AppText>
    </BottomSheet>
  </AppScreen>;
}

function parseOptionalNonNegativeInteger(value: string): number | undefined | null {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function IconButton({ icon, tone = "secondary", onPress, accessibilityLabel, disabled }: { icon: keyof typeof Ionicons.glyphMap; tone?: "secondary" | "danger"; onPress: () => void; accessibilityLabel: string; disabled?: boolean }) {
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    accessibilityState={{ disabled: Boolean(disabled) }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.iconButton, tone === "danger" && styles.iconButtonDanger, pressed && !disabled && styles.iconButtonPressed, disabled && styles.iconButtonDisabled]}
  >
    <Ionicons name={icon} size={18} color={tone === "danger" ? colors.danger : colors.primary} />
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTint },
  feedback: { gap: spacing.sm },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  iconButtonDanger: { borderColor: colors.danger },
  iconButtonPressed: { opacity: 0.82, backgroundColor: colors.surfaceTint },
  iconButtonDisabled: { opacity: 0.5 },
});
