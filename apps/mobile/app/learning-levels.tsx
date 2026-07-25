import { useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, BottomSheet, Button, FloatingActionButton, colors, radius, spacing } from "@daycare/ui";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { AppScreen } from "@/navigation/AppScreen";
import type { LearningLevel } from "@daycare/api-client";

export default function LearningLevelsScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.role === "STAFF_ADMIN" && membership.active;
  const templates = useQuery({ queryKey: ["learning-level-templates", organizationId], queryFn: () => api.learningLevelTemplates(), enabled: Boolean(membership) });
  const programs = useQuery({ queryKey: ["curriculum-programs", organizationId], queryFn: () => api.curriculumPrograms(), enabled: Boolean(membership) });
  const levels = useQuery({ queryKey: ["learning-levels", organizationId], queryFn: () => api.learningLevels(), enabled: Boolean(membership) });
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["learning-levels", organizationId] }); void queryClient.invalidateQueries({ queryKey: ["classrooms", organizationId] }); };
  const createLevel = useMutation({ mutationFn: api.createLearningLevel.bind(api), onSuccess: refresh });
  const updateLevel = useMutation({ mutationFn: ({ id, input }: { id: string; input: Parameters<typeof api.updateLearningLevel>[1] }) => api.updateLearningLevel(id, input), onSuccess: refresh });
  const archiveLevel = useMutation({ mutationFn: api.archiveLearningLevel.bind(api), onSuccess: refresh });
  const [visible, setVisible] = useState(false);
  const [editingLevelId, setEditingLevelId] = useState<string>();
  const [name, setName] = useState(""); const [minAge, setMinAge] = useState(""); const [maxAge, setMaxAge] = useState(""); const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);

  if (!profile) return null;
  if (!membership || !["STAFF_ADMIN", "STAFF"].includes(membership.role)) return <Redirect href="/home" />;

  const failure = (error: unknown) => Alert.alert(t("learning.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"));
  const useTemplate = (templateName: string, minimum?: number | null, maximum?: number | null) => { setName(templateName); setMinAge(minimum?.toString() ?? ""); setMaxAge(maximum?.toString() ?? ""); };
  const editLevel = (level: LearningLevel) => { setEditingLevelId(level.id); setName(level.name); setMinAge(level.minAgeMonths?.toString() ?? ""); setMaxAge(level.maxAgeMonths?.toString() ?? ""); setSelectedPrograms(level.curriculumProgramIds); };
  const cancelEdit = () => { setEditingLevelId(undefined); setName(""); setMinAge(""); setMaxAge(""); setSelectedPrograms([]); };
  const openCreate = () => { cancelEdit(); setVisible(true); };
  const openEdit = (level: LearningLevel) => { editLevel(level); setVisible(true); };
  const close = () => { cancelEdit(); setVisible(false); };
  const save = async () => {
    if (!name.trim()) return Alert.alert(t("learning.selectLevel"));
    const input = { name: name.trim(), minAgeMonths: minAge ? Number(minAge) : undefined, maxAgeMonths: maxAge ? Number(maxAge) : undefined, displayOrder: levels.data?.find((level) => level.id === editingLevelId)?.displayOrder ?? levels.data?.length ?? 0, curriculumProgramIds: selectedPrograms };
    try {
      if (editingLevelId) await updateLevel.mutateAsync({ id: editingLevelId, input }); else await createLevel.mutateAsync(input);
      close();
    } catch (error) { failure(error); }
  };
  const toggleProgram = (id: string) => setSelectedPrograms((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return <AppScreen showBottomNavigation={false} title={t("learning.level")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={canManage ? <FloatingActionButton accessibilityLabel={t("learning.addLevel")} onPress={openCreate}>+ {t("learning.addLevel")}</FloatingActionButton> : undefined}>
    {levels.data?.map((level) => <View key={level.id} style={styles.card}>
      <AppText variant="label">{level.name}</AppText>
      <AppText tone="muted">{t("learning.ageMonths", { min: level.minAgeMonths ?? "–", max: level.maxAgeMonths ?? "–" })}</AppText>
      {!level.active && <AppText tone="muted">{t("learning.archived")}</AppText>}
      {canManage && level.active && <View style={styles.options}>
        <IconButton icon="pencil-outline" tone="secondary" accessibilityLabel={t("learning.edit")} onPress={() => openEdit(level)} />
        <IconButton icon="trash-outline" tone="danger" accessibilityLabel={t("learning.archive")} onPress={() => void archiveLevel.mutateAsync(level.id)} />
      </View>}
    </View>)}
    {levels.data?.length === 0 && <AppText tone="muted">{t("learning.noLevels")}</AppText>}

    <BottomSheet visible={visible} onClose={close} closeAccessibilityLabel={t("common.close")} title={t(editingLevelId ? "learning.editLevel" : "learning.addLevel")} negativeAction={{ label: t("common.cancel"), onPress: close }} positiveAction={{ label: t(editingLevelId ? "common.save" : "learning.addLevel"), loading: createLevel.isPending || updateLevel.isPending, onPress: () => void save() }}>
      <AppText variant="label">{t("learning.templates")}</AppText>
      <View style={styles.options}>{templates.data?.map((template) => <Button key={template.code} variant="secondary" onPress={() => useTemplate(template.name, template.minAgeMonths, template.maxAgeMonths)}>{template.name}</Button>)}</View>
      <TextInput style={styles.input} placeholder={t("learning.levelName")} value={name} onChangeText={setName} />
      <TextInput style={styles.input} inputMode="numeric" placeholder={t("learning.minAge")} value={minAge} onChangeText={setMinAge} />
      <TextInput style={styles.input} inputMode="numeric" placeholder={t("learning.maxAge")} value={maxAge} onChangeText={setMaxAge} />
      <View style={styles.options}>{programs.data?.map((program) => <Button key={program.id} variant={selectedPrograms.includes(program.id) ? "primary" : "secondary"} onPress={() => toggleProgram(program.id)}>{program.name}{program.source === "GLOBAL" ? ` · ${t("globalCurriculum.global")}` : ""}</Button>)}</View>
    </BottomSheet>
  </AppScreen>;
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
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  iconButtonDanger: { borderColor: colors.danger },
  iconButtonPressed: { opacity: 0.82, backgroundColor: colors.surfaceTint },
  iconButtonDisabled: { opacity: 0.5 },
});
