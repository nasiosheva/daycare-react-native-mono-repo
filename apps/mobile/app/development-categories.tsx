import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, BottomSheet, Button, colors, radius, spacing } from "@daycare/ui";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useDevelopmentCategories } from "@/development/useDevelopment";
import { useI18n } from "@/i18n/I18nProvider";
import { developmentCategoryKey } from "@/i18n/translations";

export default function DevelopmentCategoriesScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canAdd = Boolean(membership?.active && (membership.role === "STAFF_ADMIN" || (membership.role === "STAFF" && membership.canManageDevelopmentCategories)));
  const canManage = membership?.role === "STAFF_ADMIN" && membership.active;
  const queryClient = useQueryClient();
  const categories = useDevelopmentCategories();
  const createCategory = useMutation({ mutationFn: api.createDevelopmentCategory.bind(api), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["development-categories", organizationId] }) });
  const updateCategory = useMutation({ mutationFn: ({ id, active }: { id: string; active: boolean }) => api.updateDevelopmentCategory(id, { active }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["development-categories", organizationId] }) });
  const [name, setName] = useState("");
  const [sheetVisible, setSheetVisible] = useState(false);
  if (!profile) return null;
  if (!canAdd) return <Redirect href="/development" />;
  const create = async () => { try { await createCategory.mutateAsync({ name: name.trim() }); setName(""); setSheetVisible(false); } catch (error) { Alert.alert(t("development.categorySaveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); } };
  const setActive = async (id: string, active: boolean) => { try { await updateCategory.mutateAsync({ id, active }); } catch (error) { Alert.alert(t("development.categorySaveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); } };
  return <AppScreen showBottomNavigation={false} title={t("development.categories")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <AppText tone="muted">{t("development.categoriesSubtitle")}</AppText>
    <Button onPress={() => setSheetVisible(true)}>{t("development.addCategory")}</Button>
    {categories.isLoading && <AppText>{t("development.loading")}</AppText>}
    {categories.isError && <Button variant="secondary" onPress={() => categories.refetch()}>{t("common.retry")}</Button>}
    {categories.data?.map((item) => <View key={item.id} style={styles.item}><AppText variant="label">{item.system ? t(developmentCategoryKey(item.id as "ACTIVITY" | "MEAL" | "NAP" | "OBSERVATION")) : item.name}</AppText><AppText tone="muted">{item.system ? t("development.categoryBuiltIn") : item.active ? t("development.categoryActive") : t("development.categoryInactive")}</AppText>{canManage && !item.system && <Button variant="secondary" loading={updateCategory.isPending} onPress={() => void setActive(item.id, !item.active)}>{item.active ? t("development.deactivateCategory") : t("development.activateCategory")}</Button>}</View>)}
    <BottomSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} closeAccessibilityLabel={t("common.close")} title={t("development.addCategory")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheetVisible(false) }} positiveAction={{ label: t("common.save"), loading: createCategory.isPending, disabled: !name.trim(), onPress: () => void create() }}><TextInput style={styles.input} value={name} onChangeText={setName} maxLength={120} placeholder={t("development.categoryName")} /></BottomSheet>
  </AppScreen>;
}
const styles = StyleSheet.create({ item: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTint }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.surface } });
