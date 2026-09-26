import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, Banner, BackButton, BottomSheet, Button, EmptyState, FloatingActionButton, ShimmerList, TextField, colors, radius, spacing } from "@daycare/ui";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import type { LearningLevel } from "@daycare/api-client";

function parseOptionalNonNegativeInteger(value: string): number | undefined | null {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export default function GlobalLearningLevelsScreen() {
  const router = useRouter();
  const { api, profile } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const levels = useQuery({ queryKey: ["global-learning-levels"], queryFn: () => api.globalLearningLevels(), enabled: Boolean(profile?.isPlatformAdmin) });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["global-learning-levels"] });
  const createLevel = useMutation({ mutationFn: api.createGlobalLearningLevel.bind(api), onSuccess: refresh });
  const updateLevel = useMutation({ mutationFn: ({ id, input }: { id: string; input: Parameters<typeof api.updateGlobalLearningLevel>[1] }) => api.updateGlobalLearningLevel(id, input), onSuccess: refresh });
  const deleteLevel = useMutation({ mutationFn: api.deleteGlobalLearningLevel.bind(api), onSuccess: refresh });

  const [visible, setVisible] = useState(false);
  const [editingLevelId, setEditingLevelId] = useState<string>();
  const [deletingLevel, setDeletingLevel] = useState<LearningLevel | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");

  if (!profile) return null;
  if (!profile.isPlatformAdmin) return <Redirect href="/home" />;

  const resetForm = () => { setName(""); setMinAge(""); setMaxAge(""); setDisplayOrder("0"); setFormError(null); };
  const openCreate = () => { setEditingLevelId(undefined); resetForm(); setDisplayOrder((levels.data?.length ?? 0).toString()); setVisible(true); };
  const openEdit = (level: LearningLevel) => { setEditingLevelId(level.id); setName(level.name); setMinAge(level.minAgeMonths?.toString() ?? ""); setMaxAge(level.maxAgeMonths?.toString() ?? ""); setDisplayOrder(level.displayOrder.toString()); setFormError(null); setVisible(true); };
  const close = () => { setVisible(false); setEditingLevelId(undefined); resetForm(); };
  const save = async () => {
    const minimum = parseOptionalNonNegativeInteger(minAge);
    const maximum = parseOptionalNonNegativeInteger(maxAge);
    const order = parseOptionalNonNegativeInteger(displayOrder);
    if (!name.trim()) return setFormError(t("learning.levelRequired"));
    if (minimum === null || maximum === null || (minimum != null && maximum != null && minimum > maximum)) return setFormError(t("learning.invalidAgeRange"));
    if (order == null) return setFormError(t("learning.invalidOrder"));
    const input = { name: name.trim(), minAgeMonths: minimum, maxAgeMonths: maximum, displayOrder: order };
    try {
      if (editingLevelId) await updateLevel.mutateAsync({ id: editingLevelId, input }); else await createLevel.mutateAsync(input);
      close();
    } catch (error) { setFormError(error instanceof Error ? error.message : t("learning.saveFailed")); }
  };
  const closeDeleteSheet = () => { setDeletingLevel(null); setDeleteError(null); };
  const performDelete = async () => {
    if (!deletingLevel) return;
    try { await deleteLevel.mutateAsync(deletingLevel.id); closeDeleteSheet(); }
    catch (error) { setDeleteError(error instanceof Error ? error.message : t("globalLearningLevels.deleteFailed")); }
  };

  return <AppScreen showBottomNavigation={false} title={t("globalLearningLevels.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={<FloatingActionButton icon="add" accessibilityLabel={t("globalLearningLevels.addLevel")} onPress={openCreate}>{t("globalLearningLevels.addLevel")}</FloatingActionButton>}>
    <AppText tone="muted">{t("globalLearningLevels.subtitle")}</AppText>
    {levels.isFetching && <ShimmerList />}
    {levels.isError && !levels.isFetching && <View style={styles.feedback}><Banner tone="danger" title={t("learning.loadFailed")} /><Button variant="secondary" onPress={() => void levels.refetch()}>{t("common.retry")}</Button></View>}
    {!levels.isFetching && levels.data?.map((level) => <View key={level.id} style={styles.card}>
      <AppText variant="label">{level.name}</AppText>
      <AppText tone="muted">{t("learning.ageMonths", { min: level.minAgeMonths ?? "–", max: level.maxAgeMonths ?? "–" })}</AppText>
      <AppText variant="caption" tone="muted">{t("learning.order")}: {level.displayOrder}</AppText>
      <View style={styles.actions}>
        <IconButton icon="pencil-outline" tone="secondary" accessibilityLabel={`${t("common.edit")}: ${level.name}`} onPress={() => openEdit(level)} />
        <IconButton icon="trash-outline" tone="danger" accessibilityLabel={`${t("common.delete")}: ${level.name}`} disabled={deleteLevel.isPending} onPress={() => { setDeleteError(null); setDeletingLevel(level); }} />
      </View>
    </View>)}
    {!levels.isFetching && !levels.isError && levels.data?.length === 0 && <EmptyState compact icon="layers-outline" title={t("globalLearningLevels.empty")} action={{ label: t("globalLearningLevels.addLevel"), onPress: openCreate }} />}

    <BottomSheet
      visible={visible}
      onClose={close}
      closeAccessibilityLabel={t("common.close")}
      title={t(editingLevelId ? "globalLearningLevels.editLevel" : "globalLearningLevels.addLevel")}
      negativeAction={{ label: t("common.cancel"), onPress: close }}
      positiveAction={{ label: t("common.save"), loading: createLevel.isPending || updateLevel.isPending, onPress: () => void save() }}
    >
      {formError && <Banner tone="danger" title={formError} />}
      <TextField label={t("learning.levelName")} value={name} onChangeText={(value) => { setName(value); setFormError(null); }} />
      <TextField label={t("learning.minAge")} inputMode="numeric" value={minAge} onChangeText={(value) => { setMinAge(value); setFormError(null); }} />
      <TextField label={t("learning.maxAge")} inputMode="numeric" value={maxAge} onChangeText={(value) => { setMaxAge(value); setFormError(null); }} />
      <TextField label={t("learning.order")} inputMode="numeric" value={displayOrder} onChangeText={(value) => { setDisplayOrder(value); setFormError(null); }} />
    </BottomSheet>

    <BottomSheet
      visible={deletingLevel !== null}
      onClose={closeDeleteSheet}
      closeAccessibilityLabel={t("common.close")}
      title={t("globalLearningLevels.deleteLevel")}
      negativeAction={{ label: t("common.back"), onPress: closeDeleteSheet }}
      positiveAction={{ label: t("common.delete"), variant: "danger", loading: deleteLevel.isPending, onPress: () => void performDelete() }}
    >
      {deleteError ? <Banner tone="danger" title={deleteError} /> : deletingLevel && <Banner tone="warning" title={t("globalLearningLevels.deleteLevelConfirm", { name: deletingLevel.name })} />}
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
  feedback: { gap: spacing.sm },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  iconButtonDanger: { borderColor: colors.danger },
  iconButtonPressed: { opacity: 0.82, backgroundColor: colors.surfaceTint },
  iconButtonDisabled: { opacity: 0.5 },
});
