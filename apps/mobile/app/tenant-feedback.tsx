import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tenantFeedbackCategories, type TenantFeedbackCategory } from "@daycare/core";
import type { TenantFeedback } from "@daycare/api-client";
import { AppText, BackButton, BottomSheet, Button, FloatingActionButton, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";

type FormState = { category: TenantFeedbackCategory; message: string };
const defaultForm = (): FormState => ({ category: "SUGGESTION", message: "" });

export default function TenantFeedbackScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t, formatDateTime } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canCreate = membership?.role === "PARENT" && membership.active;
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const items = useQuery({ queryKey: ["tenant-feedback-mine", organizationId], queryFn: () => api.myTenantFeedback(), enabled: membership?.role === "PARENT" && Boolean(organizationId) });
  const create = useMutation({ mutationFn: (input: FormState) => api.createTenantFeedback({ category: input.category, message: input.message.trim() }), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["tenant-feedback-mine", organizationId] }); setForm(null); } });

  if (!profile) return null;
  if (membership?.role !== "PARENT") return <Redirect href="/home" />;

  const submit = async () => {
    if (!form) return;
    if (!form.message.trim()) { setFormError(t("tenantFeedback.messageRequired")); return; }
    setFormError(null);
    try { await create.mutateAsync(form); }
    catch (error) { setFormError(error instanceof Error ? error.message : t("tenantFeedback.submitFailed")); }
  };

  return <AppScreen showBottomNavigation={false} title={t("tenantFeedback.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={canCreate ? <FloatingActionButton accessibilityLabel={t("tenantFeedback.add")} onPress={() => { setForm(defaultForm()); setFormError(null); }}>+ {t("tenantFeedback.add")}</FloatingActionButton> : undefined}>
    <AppText tone="muted">{t("tenantFeedback.description")}</AppText>
    {items.isLoading && <ShimmerList />}
    {items.isError && <Button variant="secondary" onPress={() => items.refetch()}>{t("common.retry")}</Button>}
    {!items.isLoading && !items.isError && items.data?.map((item) => <View key={item.id} style={styles.card}>
      <View style={styles.row}><AppText variant="label">{t(categoryKey(item.category))}</AppText><AppText variant="caption" tone="muted">{t(statusKey(item.status))}</AppText></View>
      <AppText>{item.message}</AppText>
      <AppText variant="caption" tone="muted">{formatDateTime(item.createdAt)}</AppText>
    </View>)}
    {!items.isLoading && !items.isError && items.data?.length === 0 && <AppText tone="muted">{t("tenantFeedback.empty")}</AppText>}

    <BottomSheet visible={form !== null} onClose={() => setForm(null)} closeAccessibilityLabel={t("common.close")} title={t("tenantFeedback.add")} negativeAction={{ label: t("common.cancel"), onPress: () => setForm(null) }} positiveAction={{ label: t("tenantFeedback.submit"), loading: create.isPending, onPress: () => void submit() }}>
      {formError && <AppText accessibilityRole="alert" tone="danger">{formError}</AppText>}
      <View style={styles.field}><AppText variant="label">{t("tenantFeedback.category")}</AppText><View style={styles.options}>{tenantFeedbackCategories.map((category) => <Button key={category} variant={form?.category === category ? "primary" : "secondary"} onPress={() => setForm((current) => current ? { ...current, category } : current)}>{t(categoryKey(category))}</Button>)}</View></View>
      <View style={styles.field}><AppText variant="label">{t("tenantFeedback.message")}</AppText><TextInput style={styles.input} multiline maxLength={2_000} placeholder={t("tenantFeedback.message")} value={form?.message ?? ""} onChangeText={(message) => setForm((current) => current ? { ...current, message } : current)} /></View>
    </BottomSheet>
  </AppScreen>;
}

function categoryKey(category: TenantFeedbackCategory): TranslationKey { return `tenantFeedback.category.${category}` as TranslationKey; }
function statusKey(status: TenantFeedback["status"]): TranslationKey { return `tenantFeedback.status.${status}` as TranslationKey; }

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  field: { gap: spacing.xs },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  input: { minHeight: 96, padding: spacing.sm, textAlignVertical: "top", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
});
