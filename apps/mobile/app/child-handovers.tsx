import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, Badge, BottomSheet, Button, Card, Chip, ChipGroup, EmptyState, ErrorState, FloatingActionButton, ShimmerList, TextField, spacing } from "@daycare/ui";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { notify } from "@/notify/notify";

export default function ChildHandoversScreen() {
  const router = useRouter();
  const { childId: rawChildId, organizationId: routeOrganizationId } = useLocalSearchParams<{ childId?: string; organizationId?: string }>();
  const childId = typeof rawChildId === "string" ? rawChildId : null;
  const { api, profile, organizationId: activeOrganizationId } = useAuth();
  const organizationId = (typeof routeOrganizationId === "string" ? routeOrganizationId : undefined) ?? activeOrganizationId ?? undefined;
  const { t, formatDateTime } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canUse = Boolean(membership?.active && (membership.role === "STAFF" || membership.role === "STAFF_ADMIN"));
  const handovers = useQuery({ queryKey: ["child-handovers", organizationId, childId], queryFn: () => api.childHandovers(childId!, organizationId), enabled: Boolean(childId && organizationId && canUse) });
  const recipients = useQuery({ queryKey: ["child-handover-recipients", organizationId, childId], queryFn: () => api.childHandoverRecipients(childId!, organizationId), enabled: Boolean(childId && organizationId && canUse) });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["child-handovers", organizationId, childId] });
  const [recipientUserId, setRecipientUserId] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const create = useMutation({ mutationFn: () => api.createChildHandover(childId!, { recipientUserId: recipientUserId!, summary: summary.trim() }, organizationId), onSuccess: () => { refresh(); setEditorOpen(false); setRecipientUserId(null); setSummary(""); notify(t("operations.handoverSaved"), undefined, "success"); } });
  const acknowledge = useMutation({ mutationFn: (handoverId: string) => api.acknowledgeChildHandover(childId!, handoverId, organizationId), onSuccess: refresh });

  if (!profile) return null;
  if (!childId || !canUse) return <Redirect href="/home" />;
  const openEditor = () => { setRecipientUserId(recipients.data?.[0]?.userId ?? null); setSummary(""); setEditorOpen(true); };
  const save = () => {
    if (!recipientUserId || !summary.trim()) return;
    void create.mutateAsync().catch((error: unknown) => notify(t("operations.handoverSaveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"));
  };

  return <AppScreen showBottomNavigation={false} title={t("operations.handovers")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={<FloatingActionButton icon="swap-horizontal" accessibilityLabel={t("operations.addHandover")} onPress={openEditor}>{t("operations.addHandover")}</FloatingActionButton>}>
    <AppText tone="muted">{t("operations.handoversDescription")}</AppText>
    {handovers.isLoading && <ShimmerList />}
    {handovers.isError && !handovers.isFetching && <ErrorState title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void handovers.refetch()} />}
    {!handovers.isLoading && !handovers.isError && handovers.data?.map((handover) => <Card key={handover.id} icon="swap-horizontal-outline" title={handover.recipientName} subtitle={formatDateTime(handover.createdAt)} trailing={<Badge tone={handover.status === "ACKNOWLEDGED" ? "success" : "warning"} label={t(handover.status === "ACKNOWLEDGED" ? "operations.acknowledged" : "operations.open")} />}><AppText>{handover.summary}</AppText>{handover.status === "OPEN" && handover.recipientUserId === profile.id && <Button loading={acknowledge.isPending} onPress={() => void acknowledge.mutateAsync(handover.id).catch((error: unknown) => notify(t("operations.handoverSaveFailed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"))}>{t("operations.acknowledge")}</Button>}</Card>)}
    {!handovers.isLoading && !handovers.isError && handovers.data?.length === 0 && <EmptyState icon="swap-horizontal-outline" title={t("operations.handoverEmpty")} action={{ label: t("operations.addHandover"), onPress: openEditor }} />}
    <BottomSheet visible={editorOpen} onClose={() => setEditorOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("operations.addHandover")} negativeAction={{ label: t("common.cancel"), onPress: () => setEditorOpen(false) }} positiveAction={{ label: t("common.save"), disabled: !recipientUserId || !summary.trim(), loading: create.isPending, onPress: save }}>
      {recipients.isFetching && <ShimmerList variant="row" count={2} />}
      {!recipients.isFetching && recipients.data?.length === 0 && <EmptyState compact icon="people-outline" title={t("operations.noRecipients")} />}
      {!recipients.isFetching && Boolean(recipients.data?.length) && <View style={styles.field}><AppText variant="label">{t("operations.recipient")}</AppText><ChipGroup accessibilityLabel={t("operations.recipient")}>{recipients.data?.map((recipient) => <Chip key={recipient.userId} label={recipient.displayName} selected={recipient.userId === recipientUserId} onPress={() => setRecipientUserId(recipient.userId)} />)}</ChipGroup></View>}
      <TextField label={t("operations.summary")} required value={summary} onChangeText={setSummary} multiline maxLength={2_000} />
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({ field: { gap: spacing.xs } });
