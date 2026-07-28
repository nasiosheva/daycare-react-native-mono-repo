import { useState } from "react";
import { Image, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { StaffLeaveRequest } from "@daycare/api-client";
import { AppText, BackButton, BottomSheet, Button, NavigationCard, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";

export default function StaffLeaveApprovalsScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t, formatDate } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const [selected, setSelected] = useState<StaffLeaveRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const requests = useQuery({ queryKey: ["staff-leave-approvals", organizationId], queryFn: () => api.pendingStaffLeaveRequests(), enabled: membership?.role === "STAFF_ADMIN" && Boolean(organizationId) });
  const evidence = useQuery({ queryKey: ["staff-leave-evidence", organizationId, selected?.id], queryFn: () => api.staffLeaveRequestEvidence(selected!.id), enabled: Boolean(selected?.hasEvidence) });
  const invalidate = () => { void queryClient.invalidateQueries({ queryKey: ["staff-leave-approvals", organizationId] }); void queryClient.invalidateQueries({ queryKey: ["staff-leave-requests", organizationId] }); };
  const decide = useMutation({ mutationFn: ({ request, approved, reason }: { request: StaffLeaveRequest; approved: boolean; reason: string }) => api.decideStaffLeaveRequest(request.id, { approved, rejectionReason: reason.trim() || undefined }), onSuccess: () => { invalidate(); setSelected(null); } });

  if (!profile) return null;
  if (membership?.role !== "STAFF_ADMIN") return <Redirect href="/home" />;
  const submitDecision = async (approved: boolean) => {
    if (!selected) return;
    if (!approved && !rejectionReason.trim()) { setDecisionError(t("staffLeave.rejectionRequired")); return; }
    setDecisionError(null);
    try { await decide.mutateAsync({ request: selected, approved, reason: rejectionReason }); }
    catch (error) { setDecisionError(error instanceof Error ? error.message : t("staffLeave.decisionFailed")); }
  };
  const openRequest = (request: StaffLeaveRequest) => { setSelected(request); setRejectionReason(""); setDecisionError(null); };

  return <AppScreen showBottomNavigation={false} title={t("staffLeave.approvalsTitle")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <AppText tone="muted">{t("staffLeave.approvalsDescription")}</AppText>
    {membership.active === false && <AppText tone="muted">{t("staffOperations.readOnly")}</AppText>}
    {requests.isLoading && <ShimmerList />}
    {requests.isError && <Button variant="secondary" onPress={() => requests.refetch()}>{t("common.retry")}</Button>}
    {!requests.isLoading && !requests.isError && requests.data?.map((request) => <NavigationCard key={request.id} accessibilityLabel={t("staffLeave.review")} onPress={() => openRequest(request)}><AppText variant="h5">{request.requesterName}</AppText><AppText>{t(typeKey(request.type))}</AppText><AppText tone="muted">{formatDate(request.startsOn)} – {formatDate(request.endsOn)}</AppText><AppText numberOfLines={2} tone="muted">{request.reason}</AppText></NavigationCard>)}
    {!requests.isLoading && !requests.isError && requests.data?.length === 0 && <AppText tone="muted">{t("staffLeave.noPending")}</AppText>}

    <BottomSheet visible={selected !== null} onClose={() => setSelected(null)} closeAccessibilityLabel={t("common.close")} title={t("staffLeave.review")}>
      {decisionError && <AppText accessibilityRole="alert" tone="danger">{decisionError}</AppText>}
      {selected && <View style={styles.summary}><AppText variant="heading">{selected.requesterName}</AppText><AppText>{t(typeKey(selected.type))}</AppText><AppText tone="muted">{formatDate(selected.startsOn)} – {formatDate(selected.endsOn)}</AppText><AppText>{selected.reason}</AppText></View>}
      {selected?.hasEvidence && <View style={styles.field}>{evidence.isLoading && <AppText tone="muted">{t("staffLeave.evidenceLoading")}</AppText>}{evidence.isError && <AppText accessibilityRole="alert" tone="danger">{t("staffLeave.evidenceLoadFailed")}</AppText>}{evidence.data && <Image source={{ uri: `data:${evidence.data.contentType};base64,${evidence.data.dataBase64}` }} style={styles.preview} resizeMode="contain" />}</View>}
      {membership.active !== false && <><View style={styles.field}><AppText variant="label">{t("staffLeave.rejectReason")}</AppText><TextInput style={styles.input} multiline maxLength={2_000} placeholder={t("staffLeave.rejectReason")} value={rejectionReason} onChangeText={setRejectionReason} /></View><View style={styles.actions}><Button style={styles.action} loading={decide.isPending} onPress={() => void submitDecision(true)}>{t("staffLeave.approve")}</Button><Button style={styles.action} variant="danger" loading={decide.isPending} onPress={() => void submitDecision(false)}>{t("staffLeave.reject")}</Button></View></>}
    </BottomSheet>
  </AppScreen>;
}

function typeKey(type: StaffLeaveRequest["type"]): TranslationKey { return `staffLeave.type.${type}` as TranslationKey; }

const styles = StyleSheet.create({
  summary: { gap: spacing.xs }, field: { gap: spacing.xs }, actions: { flexDirection: "row", gap: spacing.sm }, action: { flex: 1 },
  input: { minHeight: 96, padding: spacing.sm, textAlignVertical: "top", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  preview: { width: "100%", height: 240, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
});
