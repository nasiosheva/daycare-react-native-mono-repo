import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AppText, Button, NavigationCard, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { parentEnrollmentQueryKey } from "@/parent-enrollment/queryKeys";
import type { ParentEnrollment } from "@daycare/api-client";

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
    <NavigationCard accessibilityLabel={t("parentEnrollment.newTenant")} onPress={() => router.push("/parent-enrollment-form")}>
      <AppText variant="h5">{t("parentEnrollment.newTenant")}</AppText>
      <AppText tone="muted">{t("parentEnrollment.startDescription")}</AppText>
    </NavigationCard>
    <View style={styles.section}>
      <AppText variant="heading">{t("parentEnrollment.status")}</AppText>
      {enrollments.isFetching && <ShimmerList />}
      {!enrollments.isFetching && enrollments.data?.map((item) => <View key={item.id} style={styles.card}>
        <AppText variant="heading">{item.childName}</AppText>
        <AppText>{item.planName} · {formatCurrency(item.totalAmount)}</AppText>
        <EnrollmentAction enrollment={item} onApply={() => router.push("/parent-enrollment-form")} onPay={() => item.invoiceId && router.push({ pathname: "/parent-payment", params: { invoiceId: item.invoiceId, organizationId: item.organizationId } })} t={t} />
      </View>)}
      {!enrollments.isFetching && enrollments.data?.length === 0 && <AppText tone="muted">{t("parentEnrollment.noApplication")}</AppText>}
    </View>
    {profile?.memberships.filter((membership) => membership.role === "PARENT").length ? <View style={styles.section}>
      <AppText variant="heading">{t("parentEnrollment.activeTenants")}</AppText>
      {profile.memberships.filter((membership) => membership.role === "PARENT").map((membership) => <Button key={membership.organizationId} variant={membership.organizationId === organizationId ? "primary" : "secondary"} onPress={() => { selectOrganization(membership.organizationId); router.replace("/home"); }}>{membership.organizationName}</Button>)}
    </View> : null}
  </View></AppScreen>;
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

const styles = StyleSheet.create({ content: { gap: spacing.md }, section: { gap: spacing.sm }, card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border } });
