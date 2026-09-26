import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tenantFeedbackCategories, type TenantFeedbackCategory } from "@daycare/core";
import type { TenantFeedback } from "@daycare/api-client";
import { AppText, Badge, BackButton, Banner, BottomSheet, Card, Chip, ChipGroup, EmptyState, ErrorState, FloatingActionButton, ShimmerList, TextField, spacing } from "@daycare/ui";
import { statusTone } from "@/ui/statusTone";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";

type FormState = { category: TenantFeedbackCategory; message: string };
const defaultForm = (): FormState => ({ category: "SUGGESTION", message: "" });

export default function TenantFeedbackScreen() {
  const router = useRouter();
  const { api, profile, organizationId, selectOrganization } = useAuth();
  const { t, formatDateTime } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canCreate = membership?.role === "PARENT" && membership.active;
  const parentMemberships = (profile?.memberships ?? []).filter((item) => item.role === "PARENT" && item.active);
  const showsTenantPicker = parentMemberships.length > 1;
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

  return <AppScreen showBottomNavigation={false} title={t("tenantFeedback.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={canCreate ? <FloatingActionButton accessibilityLabel={t("tenantFeedback.add")} icon="add" onPress={() => { setForm(defaultForm()); setFormError(null); }}>{t("tenantFeedback.add")}</FloatingActionButton> : undefined}>
    {showsTenantPicker && <View style={styles.field}>
      <AppText variant="label">{t("parentEnrollment.tenant")}</AppText>
      <ChipGroup accessibilityLabel={t("parentEnrollment.tenant")}>{parentMemberships.map((item) => <Chip key={item.organizationId} label={item.organizationName} selected={item.organizationId === organizationId} onPress={() => selectOrganization(item.organizationId)} />)}</ChipGroup>
    </View>}
    <AppText tone="muted">{t("tenantFeedback.description")}</AppText>
    {items.isLoading && <ShimmerList />}
    {items.isError && !items.isFetching && <ErrorState title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void items.refetch()} />}
    {!items.isLoading && !items.isError && items.data?.map((item) => <Card key={item.id} title={t(categoryKey(item.category))} subtitle={formatDateTime(item.createdAt)} trailing={<Badge tone={statusTone(item.status)} label={t(statusKey(item.status))} />}>
      <AppText>{item.message}</AppText>
    </Card>)}
    {!items.isLoading && !items.isError && items.data?.length === 0 && <EmptyState icon="chatbox-ellipses-outline" title={t("tenantFeedback.empty")} action={canCreate ? { label: t("tenantFeedback.add"), onPress: () => { setForm(defaultForm()); setFormError(null); } } : undefined} />}

    <BottomSheet visible={form !== null} onClose={() => setForm(null)} closeAccessibilityLabel={t("common.close")} title={t("tenantFeedback.add")} negativeAction={{ label: t("common.cancel"), onPress: () => setForm(null) }} positiveAction={{ label: t("tenantFeedback.submit"), loading: create.isPending, onPress: () => void submit() }}>
      {formError && <Banner tone="danger" title={formError} />}
      <View style={styles.field}><AppText variant="label">{t("tenantFeedback.category")}</AppText><ChipGroup accessibilityLabel={t("tenantFeedback.category")}>{tenantFeedbackCategories.map((category) => <Chip key={category} label={t(categoryKey(category))} selected={form?.category === category} onPress={() => setForm((current) => current ? { ...current, category } : current)} />)}</ChipGroup></View>
      <TextField label={t("tenantFeedback.message")} required hint={t("common.characterCount", { count: form?.message.length ?? 0, max: 2000 })} multiline maxLength={2_000} value={form?.message ?? ""} onChangeText={(message) => setForm((current) => current ? { ...current, message } : current)} />
    </BottomSheet>
  </AppScreen>;
}

function categoryKey(category: TenantFeedbackCategory): TranslationKey { return `tenantFeedback.category.${category}` as TranslationKey; }
function statusKey(status: TenantFeedback["status"]): TranslationKey { return `tenantFeedback.status.${status}` as TranslationKey; }

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
});
