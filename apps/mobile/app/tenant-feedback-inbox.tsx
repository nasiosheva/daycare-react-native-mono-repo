import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TenantFeedback } from "@daycare/api-client";
import type { TenantFeedbackStatus } from "@daycare/core";
import { AppText, BackButton, Badge, Banner, BottomSheet, Button, EmptyState, ErrorState, NavigationCard, ShimmerList, spacing } from "@daycare/ui";
import { statusTone } from "@/ui/statusTone";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";

export default function TenantFeedbackInboxScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t, formatDateTime } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const [selected, setSelected] = useState<TenantFeedback | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const items = useQuery({ queryKey: ["tenant-feedback-inbox", organizationId], queryFn: () => api.tenantFeedbackInbox(), enabled: membership?.role === "STAFF_ADMIN" && Boolean(organizationId) });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["tenant-feedback-inbox", organizationId] });
  const updateStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: TenantFeedbackStatus }) => api.updateTenantFeedbackStatus(id, status), onSuccess: (updated) => { invalidate(); setSelected(updated); }, onError: (error) => setDecisionError(error instanceof Error ? error.message : t("tenantFeedback.updateFailed")) });

  if (!profile) return null;
  if (membership?.role !== "STAFF_ADMIN") return <Redirect href="/home" />;

  const open = (item: TenantFeedback) => { setSelected(item); setDecisionError(null); };

  return <AppScreen showBottomNavigation={false} title={t("tenantFeedback.inboxTitle")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <AppText tone="muted">{t("tenantFeedback.inboxDescription")}</AppText>
    {items.isLoading && <ShimmerList />}
    {items.isError && !items.isFetching && <ErrorState compact title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void items.refetch()} />}
    {!items.isLoading && !items.isError && items.data?.map((item) => <NavigationCard key={item.id} accessibilityLabel={t("tenantFeedback.review")} onPress={() => open(item)}>
      <View style={styles.row}><AppText variant="h5">{item.submittedByName}</AppText><Badge tone={statusTone(item.status)} label={t(statusKey(item.status))} /></View>
      <AppText tone="muted">{t(categoryKey(item.category))}</AppText>
      <AppText numberOfLines={2} tone="muted">{item.message}</AppText>
    </NavigationCard>)}
    {!items.isLoading && !items.isError && items.data?.length === 0 && <EmptyState compact title={t("tenantFeedback.noItems")} />}

    <BottomSheet visible={selected !== null} onClose={() => setSelected(null)} closeAccessibilityLabel={t("common.close")} title={t("tenantFeedback.review")}>
      {decisionError && <Banner tone="danger" title={decisionError} />}
      {selected && <View style={styles.summary}>
        <AppText variant="heading">{selected.submittedByName}</AppText>
        <AppText tone="muted">{t(categoryKey(selected.category))} · {formatDateTime(selected.createdAt)}</AppText>
        <AppText>{selected.message}</AppText>
        <Badge tone={statusTone(selected.status)} label={t(statusKey(selected.status))} />
      </View>}
      {selected && selected.status !== "RESOLVED" && <View style={styles.actions}>
        {selected.status === "NEW" && <Button style={styles.action} loading={updateStatus.isPending} onPress={() => updateStatus.mutate({ id: selected.id, status: "READ" })}>{t("tenantFeedback.markRead")}</Button>}
        <Button style={styles.action} variant="secondary" loading={updateStatus.isPending} onPress={() => updateStatus.mutate({ id: selected.id, status: "RESOLVED" })}>{t("tenantFeedback.markResolved")}</Button>
      </View>}
    </BottomSheet>
  </AppScreen>;
}

function categoryKey(category: TenantFeedback["category"]): TranslationKey { return `tenantFeedback.category.${category}` as TranslationKey; }
function statusKey(status: TenantFeedback["status"]): TranslationKey { return `tenantFeedback.status.${status}` as TranslationKey; }

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  summary: { gap: spacing.xs },
  actions: { flexDirection: "row", gap: spacing.sm },
  action: { flex: 1 },
});
