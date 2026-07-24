import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, BottomSheet, Button, colors, radius, spacing } from "@daycare/ui";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useDevelopmentCategories } from "@/development/useDevelopment";
import { useI18n } from "@/i18n/I18nProvider";
import { developmentCategoryKey } from "@/i18n/translations";
import { notify } from "@/notify/notify";
import type { DevelopmentCategoryOption } from "@daycare/api-client";

export default function DevelopmentCategoriesScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canAdd = Boolean(membership?.active && (membership.role === "STAFF_ADMIN" || (membership.role === "STAFF" && membership.canManageDevelopmentCategories)));
  const canManage = canAdd;
  const queryClient = useQueryClient();
  const categories = useDevelopmentCategories();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["development-categories", organizationId] });
  const createCategory = useMutation({ mutationFn: api.createDevelopmentCategory.bind(api), onSuccess: refresh });
  const renameCategory = useMutation({ mutationFn: ({ id, name }: { id: string; name: string }) => api.updateDevelopmentCategory(id, { name }), onSuccess: refresh });
  const updateCategory = useMutation({ mutationFn: ({ id, active }: { id: string; active: boolean }) => api.updateDevelopmentCategory(id, { active }), onSuccess: refresh });
  const deleteCategory = useMutation({ mutationFn: api.deleteDevelopmentCategory.bind(api), onSuccess: refresh });
  const [name, setName] = useState("");
  const [addVisible, setAddVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<DevelopmentCategoryOption | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<DevelopmentCategoryOption | null>(null);
  if (!profile) return null;
  if (!canAdd) return <Redirect href="/development" />;
  const create = async () => { try { await createCategory.mutateAsync({ name: name.trim() }); setName(""); setAddVisible(false); } catch (error) { notify(t("development.categorySaveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); } };
  const openEdit = (category: DevelopmentCategoryOption) => { setEditingCategory(category); setName(category.name); };
  const closeEdit = () => { setEditingCategory(null); setName(""); };
  const saveEdit = async () => {
    if (!editingCategory || !name.trim()) return;
    try { await renameCategory.mutateAsync({ id: editingCategory.id, name: name.trim() }); closeEdit(); }
    catch (error) { notify(t("development.categorySaveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  const setActive = async (id: string, active: boolean) => { try { await updateCategory.mutateAsync({ id, active }); } catch (error) { notify(t("development.categorySaveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); } };
  const closeDeleteSheet = () => setDeletingCategory(null);
  const performDelete = async () => {
    if (!deletingCategory) return;
    try { await deleteCategory.mutateAsync(deletingCategory.id); closeDeleteSheet(); }
    catch (error) { notify(t("development.deleteCategoryFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  return <AppScreen showBottomNavigation={false} title={t("development.categories")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <AppText tone="muted">{t("development.categoriesSubtitle")}</AppText>
    <Button onPress={() => setAddVisible(true)}>{t("development.addCategory")}</Button>
    {categories.isLoading && <AppText>{t("development.loading")}</AppText>}
    {categories.isError && <Button variant="secondary" onPress={() => categories.refetch()}>{t("common.retry")}</Button>}
    {categories.data?.map((item) => <View key={item.id} style={styles.item}>
      <AppText variant="label">{item.system ? t(developmentCategoryKey(item.id as "ACTIVITY" | "MEAL" | "NAP" | "OBSERVATION")) : item.name}</AppText>
      <AppText tone="muted">{item.system ? t("development.categoryBuiltIn") : item.active ? t("development.categoryActive") : t("development.categoryInactive")}</AppText>
      {canManage && !item.system && <View style={styles.actions}>
        <IconButton icon="pencil-outline" tone="secondary" accessibilityLabel={t("development.editCategory")} onPress={() => openEdit(item)} />
        <IconButton icon={item.active ? "eye-off-outline" : "eye-outline"} tone="secondary" accessibilityLabel={t(item.active ? "development.deactivateCategory" : "development.activateCategory")} disabled={updateCategory.isPending} onPress={() => void setActive(item.id, !item.active)} />
        <IconButton icon="trash-outline" tone="danger" accessibilityLabel={t("development.deleteCategory")} disabled={deleteCategory.isPending} onPress={() => setDeletingCategory(item)} />
      </View>}
    </View>)}
    <BottomSheet visible={addVisible} onClose={() => setAddVisible(false)} closeAccessibilityLabel={t("common.close")} title={t("development.addCategory")} negativeAction={{ label: t("common.cancel"), onPress: () => setAddVisible(false) }} positiveAction={{ label: t("common.save"), loading: createCategory.isPending, disabled: !name.trim(), onPress: () => void create() }}><TextInput style={styles.input} value={name} onChangeText={setName} maxLength={120} placeholder={t("development.categoryName")} /></BottomSheet>
    <BottomSheet visible={Boolean(editingCategory)} onClose={closeEdit} closeAccessibilityLabel={t("common.close")} title={t("development.editCategory")} negativeAction={{ label: t("common.cancel"), onPress: closeEdit }} positiveAction={{ label: t("common.save"), loading: renameCategory.isPending, disabled: !name.trim(), onPress: () => void saveEdit() }}><TextInput style={styles.input} value={name} onChangeText={setName} maxLength={120} placeholder={t("development.categoryName")} /></BottomSheet>
    <BottomSheet visible={Boolean(deletingCategory)} onClose={closeDeleteSheet} closeAccessibilityLabel={t("common.close")} title={t("development.deleteCategory")} negativeAction={{ label: t("common.cancel"), onPress: closeDeleteSheet }} positiveAction={{ label: t("development.deleteCategory"), variant: "danger", loading: deleteCategory.isPending, onPress: () => void performDelete() }}><AppText tone="muted">{t("development.deleteCategoryConfirm")}</AppText></BottomSheet>
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
  item: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.surface },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  iconButtonDanger: { borderColor: colors.danger },
  iconButtonPressed: { opacity: 0.82, backgroundColor: colors.surfaceTint },
  iconButtonDisabled: { opacity: 0.5 },
});
