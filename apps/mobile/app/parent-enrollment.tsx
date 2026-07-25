import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AppText, Button, NavigationCard, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import type { ParentEnrollment } from "@daycare/api-client";

export default function ParentEnrollmentScreen() {
  const router = useRouter();
  const { api, profile, organizationId, refreshProfile, selectOrganization } = useAuth();
  const { t, formatCurrency } = useI18n();
  const enrollments = useQuery({ queryKey: ["parent-enrollments"], queryFn: () => api.parentEnrollments(), refetchInterval: 15_000 });
  const activatedEnrollmentId = useRef<string | null>(null);
  const approvedUnboundEnrollment = enrollments.data?.find((item) => item.status === "APPROVED" && !profile?.memberships.some((membership) => membership.organizationId === item.organizationId));

  useEffect(() => {
    if (!approvedUnboundEnrollment || activatedEnrollmentId.current === approvedUnboundEnrollment.id) return;
    activatedEnrollmentId.current = approvedUnboundEnrollment.id;
    void refreshProfile().then(() => selectOrganization(approvedUnboundEnrollment.organizationId)).catch(() => { activatedEnrollmentId.current = null; });
  }, [approvedUnboundEnrollment, refreshProfile, selectOrganization]);

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
        <EnrollmentAction enrollment={item} onApply={() => router.push("/parent-enrollment-form")} onPay={() => item.invoiceId && router.push({ pathname: "/parent-payment", params: { invoiceId: item.invoiceId } })} t={t} />
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
  if (enrollment.status === "PENDING_APPROVAL") return <AppText tone="muted">{t("parentEnrollment.pendingApproval")}</AppText>;
  if (enrollment.status === "REJECTED") return <><AppText tone="danger">{t("parentEnrollment.rejected")}</AppText><Button variant="secondary" onPress={onApply}>{t("parentEnrollment.retry")}</Button></>;
  if (enrollment.status === "CANCELLED" || enrollment.status === "EXPIRED" || enrollment.invoiceStatus === "OVERDUE") return <><AppText tone="muted">{t("parentEnrollment.expired")}</AppText><Button variant="secondary" onPress={onApply}>{t("parentEnrollment.retry")}</Button></>;
  if (enrollment.invoiceStatus === "PENDING") return <><AppText tone="muted">{t("parentEnrollment.approvedPayment")}</AppText><Button onPress={onPay}>{t("parentEnrollment.pay")}</Button></>;
  if (enrollment.invoiceStatus === "PAYMENT_SUBMITTED") return <AppText tone="muted">{t("paymentProof.awaitingReview")}</AppText>;
  if (enrollment.invoiceStatus === "PAID") return <AppText tone="muted">{t("parentEnrollment.paid")}</AppText>;
  return <AppText tone="muted">{t("parentEnrollment.approvedPayment")}</AppText>;
}

const styles = StyleSheet.create({ content: { gap: spacing.md }, section: { gap: spacing.sm }, card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border } });
