// Mories Deo Hutapea,S.E.,S.Kom
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PickupExceptionRequest, PickupExceptionVerificationMethod } from "@daycare/api-client";
import { AppText, BackButton, Banner, BottomSheet, Button, Card, Chip, ChipGroup, EmptyState, ErrorState, ShimmerList, TextField, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { hasLegacyDaycareRouteAccess, legacyDaycareRoutePolicies } from "@/navigation/legacyDaycareRouteAccess";
import { hasOfferingCapability, useUiAccessContext } from "@/education/useUiAccessContext";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";

const verificationMethods: PickupExceptionVerificationMethod[] = ["CALL_REGISTERED_GUARDIAN", "VERIFIED_WRITTEN_INSTRUCTION", "IN_PERSON_GUARDIAN", "OTHER"];

export default function PickupExceptionApprovalsScreen() {
  const router = useRouter();
  const { api, profile, organizationId } = useAuth();
  const { t, formatDateTime } = useI18n();
  const client = useQueryClient();
  const access = useUiAccessContext(Boolean(organizationId));
  const hasDaycare = hasOfferingCapability(access.data, "DAYCARE_OPERATIONS");
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const allowed = Boolean(profile && hasLegacyDaycareRouteAccess(profile, organizationId, legacyDaycareRoutePolicies.pickupExceptionApprovals, hasDaycare));
  const [selected, setSelected] = useState<PickupExceptionRequest | null>(null);
  const [verificationMethod, setVerificationMethod] = useState<PickupExceptionVerificationMethod | null>(null);
  const [verificationNote, setVerificationNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const requests = useQuery({ queryKey: ["pickup-exception-approvals", organizationId], queryFn: () => api.pendingPickupExceptionRequests(), enabled: allowed, refetchInterval: 5_000 });
  const approve = useMutation({
    mutationFn: (request: PickupExceptionRequest) => api.approvePickupExceptionRequest(request.id, { verificationMethod: verificationMethod!, verificationNote: verificationNote.trim() }),
    onSuccess: async (request) => { await Promise.all([client.invalidateQueries({ queryKey: ["pickup-exception-approvals", organizationId] }), client.invalidateQueries({ queryKey: ["pickup-exception-requests", organizationId, request.childId] })]); closeDecision(); },
    onError: (error) => setDecisionError(error instanceof Error ? error.message : t("auth.tryAgain")),
  });
  const reject = useMutation({
    mutationFn: (request: PickupExceptionRequest) => api.rejectPickupExceptionRequest(request.id, { reason: rejectionReason.trim() }),
    onSuccess: async (request) => { await Promise.all([client.invalidateQueries({ queryKey: ["pickup-exception-approvals", organizationId] }), client.invalidateQueries({ queryKey: ["pickup-exception-requests", organizationId, request.childId] })]); closeDecision(); },
    onError: (error) => setDecisionError(error instanceof Error ? error.message : t("auth.tryAgain")),
  });

  const closeDecision = () => { setSelected(null); setVerificationMethod(null); setVerificationNote(""); setRejectionReason(""); setRejecting(false); setDecisionError(null); };
  const openDecision = (request: PickupExceptionRequest) => { setSelected(request); setVerificationMethod(null); setVerificationNote(""); setRejectionReason(""); setRejecting(false); setDecisionError(null); };
  if (!allowed) return <Redirect href="/home" />;

  return <AppScreen showBottomNavigation={false} title={t("pickupException.approvalsTitle")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <AppText tone="muted">{t("pickupException.approvalsDescription")}</AppText>
    {membership?.active === false && <Banner tone="warning" title={t("staffOperations.readOnly")} />}
    {requests.isLoading && <ShimmerList />}
    {requests.isError && !requests.isFetching && <ErrorState title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void requests.refetch()} />}
    {!requests.isLoading && !requests.isError && requests.data?.map((request) => <Card key={request.id}>
      <View style={styles.card}>
        <AppText variant="h6">{request.childName}</AppText>
        <AppText>{t("pickupException.pickupPerson", { name: request.pickupPersonName, relationship: request.relationship })}</AppText>
        <AppText>{t("pickupException.staffReason", { reason: request.reason })}</AppText>
        <AppText variant="caption" tone="muted">{t("pickupException.requestedAt", { date: formatDateTime(request.requestedAt) })}</AppText>
        <AppText variant="caption" tone="muted">{t("pickupException.requestExpires", { date: formatDateTime(request.requestExpiresAt) })}</AppText>
        <View style={styles.actions}>
          <Button style={styles.action} disabled={membership?.active === false} onPress={() => openDecision(request)}>{t("pickupException.review")}</Button>
        </View>
      </View>
    </Card>)}
    {!requests.isLoading && !requests.isError && requests.data?.length === 0 && <EmptyState compact icon="shield-checkmark-outline" title={t("pickupException.noPending")} />}

    <BottomSheet visible={selected !== null} onClose={closeDecision} closeAccessibilityLabel={t("common.close")} title={t(rejecting ? "pickupException.reject" : "pickupException.review")} negativeAction={{ label: t("common.cancel"), onPress: closeDecision }} positiveAction={{ label: t(rejecting ? "pickupException.reject" : "pickupException.approveOnce"), loading: rejecting ? reject.isPending : approve.isPending, disabled: membership?.active === false || (rejecting ? !rejectionReason.trim() : !verificationMethod || !verificationNote.trim()), onPress: () => { if (!selected) return; if (rejecting) void reject.mutateAsync(selected); else void approve.mutateAsync(selected); } }}>
      {decisionError && <Banner tone="danger" title={decisionError} />}
      {selected && <View style={styles.form}>
        <AppText variant="h6">{selected.childName}</AppText>
        <AppText>{t("pickupException.pickupPerson", { name: selected.pickupPersonName, relationship: selected.relationship })}</AppText>
        <AppText>{t("pickupException.staffReason", { reason: selected.reason })}</AppText>
        {!rejecting && <>
          <Banner tone="warning" title={t("pickupException.verifyGuardianWarning")} message={t("pickupException.verifyGuardianDescription")} />
          <AppText variant="label">{t("pickupException.verificationMethod")}</AppText>
          <ChipGroup accessibilityLabel={t("pickupException.verificationMethod")}>
            {verificationMethods.map((method) => <Chip key={method} label={t(`pickupException.method.${method}`)} selected={verificationMethod === method} onPress={() => setVerificationMethod(method)} />)}
          </ChipGroup>
          <TextField label={t("pickupException.verificationNote")} required multiline maxLength={500} value={verificationNote} onChangeText={setVerificationNote} />
          <Button variant="danger" onPress={() => { setDecisionError(null); setRejectionReason(""); setRejecting(true); }}>{t("pickupException.reject")}</Button>
        </>}
        {rejecting && <TextField label={t("pickupException.rejectionReason")} required multiline maxLength={500} value={rejectionReason} onChangeText={setRejectionReason} />}
      </View>}
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({ card: { gap: spacing.sm }, actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }, action: { flex: 1 }, form: { gap: spacing.md } });
