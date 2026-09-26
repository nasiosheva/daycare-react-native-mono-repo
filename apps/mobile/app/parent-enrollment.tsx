import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AppText, Badge, Button, Card, EmptyState, ErrorState, MenuItem, SectionHeader, ShimmerList, spacing, type Tone } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { parentEnrollmentQueryKey } from "@/parent-enrollment/queryKeys";
import type { ParentEnrollment } from "@daycare/api-client";
import type { TranslationKey } from "@/i18n/translations";

export default function ParentEnrollmentScreen() {
  const router = useRouter();
  const { api, profile, organizationId, refreshProfile, selectOrganization, user } = useAuth();
  const { t, formatCurrency } = useI18n();
  const enrollments = useQuery({ queryKey: parentEnrollmentQueryKey(user?.uid), queryFn: () => api.parentEnrollments(), enabled: Boolean(user), refetchInterval: 15_000 });
  const activatedEnrollmentId = useRef<string | null>(null);
  const approvedUnboundEnrollment = enrollments.data?.find((item) => item.status === "APPROVED" && !profile?.memberships.some((membership) => membership.organizationId === item.organizationId));

  useEffect(() => {
    if (!approvedUnboundEnrollment || activatedEnrollmentId.current === approvedUnboundEnrollment.id) return;
    activatedEnrollmentId.current = approvedUnboundEnrollment.id;
    void refreshProfile().then((nextProfile) => {
      const memberships = nextProfile.memberships;
      if (memberships.length > 1) {
        router.replace("/context-selection");
        return;
      }
      if (memberships.length === 1 && memberships[0].organizationId === approvedUnboundEnrollment.organizationId && selectOrganization(approvedUnboundEnrollment.organizationId)) {
        router.replace("/home");
        return;
      }
    }).catch(() => { activatedEnrollmentId.current = null; });
  }, [approvedUnboundEnrollment, refreshProfile, router, selectOrganization]);

  return <AppScreen><View style={styles.content}>
    <AppText variant="title">{t("parentEnrollment.title")}</AppText>
    <AppText tone="muted">{t("parentEnrollment.subtitle")}</AppText>
    <MenuItem icon="add-circle-outline" title={t("parentEnrollment.newTenant")} description={t("parentEnrollment.startDescription")} onPress={() => router.push("/parent-enrollment-form")} />
    <View style={styles.section}>
      <SectionHeader title={t("parentEnrollment.status")} />
      {enrollments.isLoading && <ShimmerList />}
      {enrollments.isError && !enrollments.isFetching && <ErrorState compact title={t("common.loadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void enrollments.refetch()} />}
      {!enrollments.isLoading && enrollments.data?.map((item) => {
        const badge = enrollmentBadge(item);
        return <Card key={item.id} title={item.childName} subtitle={`${item.planName} · ${formatCurrency(item.totalAmount)}`} trailing={<Badge tone={badge.tone} label={t(badge.labelKey)} />}>
          {item.transferredFromOrganizationName && <Badge tone="info" icon="swap-horizontal" label={t("parentEnrollment.transferBadge", { organization: item.transferredFromOrganizationName })} />}
          <EnrollmentAction enrollment={item} onApply={() => router.push("/parent-enrollment-form")} onPay={() => item.invoiceId && router.push({ pathname: "/parent-payment", params: { invoiceId: item.invoiceId, organizationId: item.organizationId } })} t={t} />
        </Card>;
      })}
      {!enrollments.isLoading && !enrollments.isError && enrollments.data?.length === 0 && <EmptyState icon="document-text-outline" title={t("parentEnrollment.noApplication")} description={t("parentEnrollment.startDescription")} action={{ label: t("parentEnrollment.newTenant"), onPress: () => router.push("/parent-enrollment-form") }} />}
    </View>
    {profile?.memberships.filter((membership) => membership.role === "PARENT").length ? <View style={styles.section}>
      <SectionHeader title={t("parentEnrollment.activeTenants")} />
      {profile.memberships.filter((membership) => membership.role === "PARENT").map((membership) => <MenuItem key={membership.organizationId} icon="business-outline" title={membership.organizationName} badge={membership.organizationId === organizationId ? <Badge tone="success" icon="checkmark-circle" label={t("parentEnrollment.currentTenant")} /> : undefined} onPress={() => { selectOrganization(membership.organizationId); router.replace("/home"); }} />)}
    </View> : null}
  </View></AppScreen>;
}

function enrollmentBadge(enrollment: ParentEnrollment): { tone: Tone; labelKey: TranslationKey } {
  switch (enrollment.accessState) {
    case "PENDING_APPROVAL": return { tone: "info", labelKey: "status.PENDING_APPROVAL" };
    case "PAYMENT_DUE": return { tone: "warning", labelKey: "parentEnrollment.needsPayment" };
    case "PAYMENT_REVIEW": return { tone: "info", labelKey: "status.PAYMENT_SUBMITTED" };
    case "ACTIVE": return { tone: "success", labelKey: "status.ACTIVE" };
    case "CLOSED": return enrollment.status === "REJECTED" ? { tone: "danger", labelKey: "status.REJECTED" } : { tone: "neutral", labelKey: "status.EXPIRED" };
    case "BILLING_LIMITED": return { tone: "neutral", labelKey: "status.EXPIRED" };
    default: return { tone: "info", labelKey: "status.PENDING_APPROVAL" };
  }
}

function EnrollmentAction({ enrollment, onApply, onPay, t }: { enrollment: ParentEnrollment; onApply: () => void; onPay: () => void; t: ReturnType<typeof useI18n>["t"] }) {
  if (enrollment.accessState === "PENDING_APPROVAL") return <AppText tone="muted">{t("parentEnrollment.pendingApproval")}</AppText>;
  if (enrollment.accessState === "CLOSED") return <><AppText tone={enrollment.status === "REJECTED" ? "danger" : "muted"}>{enrollment.status === "REJECTED" ? t("parentEnrollment.rejected") : t("parentEnrollment.expired")}</AppText>{enrollment.allowedActions.includes("REAPPLY") && <Button variant="secondary" onPress={onApply}>{t("parentEnrollment.retry")}</Button>}</>;
  if (enrollment.accessState === "BILLING_LIMITED") return <><AppText tone="muted">{t("parentEnrollment.expired")}</AppText>{enrollment.allowedActions.includes("REAPPLY") && <Button variant="secondary" onPress={onApply}>{t("parentEnrollment.retry")}</Button>}</>;
  if (enrollment.accessState === "PAYMENT_DUE") return <><AppText tone="muted">{t("parentEnrollment.approvedPayment")}</AppText>{enrollment.allowedActions.includes("UPLOAD_PAYMENT_PROOF") && <Button onPress={onPay}>{t("parentEnrollment.pay")}</Button>}</>;
  if (enrollment.accessState === "PAYMENT_REVIEW") return <AppText tone="muted">{t("paymentProof.awaitingReview")}</AppText>;
  if (enrollment.accessState === "ACTIVE") return <AppText tone="muted">{t("parentEnrollment.paid")}</AppText>;
  return <AppText tone="muted">{t("parentEnrollment.approvedPayment")}</AppText>;
}

const styles = StyleSheet.create({ content: { gap: spacing.md }, section: { gap: spacing.sm } });
