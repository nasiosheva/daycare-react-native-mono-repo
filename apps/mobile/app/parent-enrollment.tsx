import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChildGender } from "@daycare/core";
import { AppText, Button, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import type { ParentEnrollmentCheckoutInput } from "@daycare/api-client";
import { GenderPicker } from "@/children/GenderPicker";
import { DatePicker } from "@/date-picker/DatePicker";
import { formatIsoDate, isIsoDate } from "@/date-picker/date";

type ChildDraft = Omit<ParentEnrollmentCheckoutInput["children"][number], "gender"> & { gender?: ChildGender };
const emptyChild = (): ChildDraft => ({ firstName: "", lastName: "", dateOfBirth: "" });

export default function ParentEnrollmentScreen() {
  const router = useRouter();
  const { api, refreshProfile, profile, organizationId, selectOrganization } = useAuth(); const { t, formatCurrency } = useI18n(); const client = useQueryClient();
  const catalog = useQuery({ queryKey: ["parent-enrollment-catalog"], queryFn: () => api.parentEnrollmentCatalog() });
  const enrollments = useQuery({ queryKey: ["parent-enrollments"], queryFn: () => api.parentEnrollments(), refetchInterval: 15_000 });
  const parentMemberships = profile?.memberships.filter((membership) => membership.role === "PARENT") ?? [];
  const availableTenants = useMemo(() => catalog.data?.filter((item) => !parentMemberships.some((membership) => membership.organizationId === item.organizationId)) ?? [], [catalog.data, parentMemberships]);
  const [tenantId, setTenantId] = useState<string>(); const tenant = useMemo(() => availableTenants.find((item) => item.organizationId === tenantId) ?? availableTenants[0], [availableTenants, tenantId]);
  const [branchId, setBranchId] = useState<string>(); const branch = tenant?.branches.find((item) => item.id === branchId) ?? tenant?.branches[0];
  const [planId, setPlanId] = useState<string>(); const plan = tenant?.plans.find((item) => item.id === planId) ?? tenant?.plans[0];
  const [children, setChildren] = useState<ChildDraft[]>([emptyChild()]);
  const activatedEnrollmentId = useRef<string | null>(null);
  const approvedUnboundEnrollment = enrollments.data?.find((item) => item.status === "APPROVED" && !profile?.memberships.some((membership) => membership.organizationId === item.organizationId));
  useEffect(() => {
    if (!approvedUnboundEnrollment || activatedEnrollmentId.current === approvedUnboundEnrollment.id) return;
    activatedEnrollmentId.current = approvedUnboundEnrollment.id;
    void refreshProfile().then(() => { selectOrganization(approvedUnboundEnrollment.organizationId); router.replace("/home"); }).catch(() => { activatedEnrollmentId.current = null; });
  }, [approvedUnboundEnrollment, refreshProfile, selectOrganization]);
  const checkout = useMutation({ mutationFn: () => {
    if (!tenant || !branch || !plan || children.some((child) => !child.firstName.trim() || !child.gender || !isIsoDate(child.dateOfBirth))) throw new Error(t("children.required"));
    return api.checkoutParentEnrollment({ organizationId: tenant.organizationId, branchId: branch.id, planId: plan.id, bookingDates: [], children: children.map((child) => ({ firstName: child.firstName.trim(), lastName: child.lastName?.trim() || undefined, gender: child.gender!, dateOfBirth: child.dateOfBirth.trim() })) });
  }, onSuccess: async () => { await client.invalidateQueries({ queryKey: ["parent-enrollments"] }); await refreshProfile(); Alert.alert(t("parentEnrollment.created")); }, onError: (error) => Alert.alert(t("parentEnrollment.failed"), error instanceof Error ? error.message : t("auth.tryAgain")) });
  const retry = useMutation({ mutationFn: (enrollmentId: string) => api.retryParentEnrollment(enrollmentId, []), onSuccess: () => void client.invalidateQueries({ queryKey: ["parent-enrollments"] }), onError: (error) => Alert.alert(t("parentEnrollment.failed"), error instanceof Error ? error.message : t("auth.tryAgain")) });
  const cancel = useMutation({ mutationFn: api.cancelParentEnrollment.bind(api), onSuccess: () => void client.invalidateQueries({ queryKey: ["parent-enrollments"] }), onError: (error) => Alert.alert(t("parentEnrollment.failed"), error instanceof Error ? error.message : t("auth.tryAgain")) });
  const cancelEnrollment = (enrollmentId: string) => Alert.alert(t("parentEnrollment.cancel"), t("parentEnrollment.cancelConfirm"), [
    { text: t("common.cancel"), style: "cancel" },
    { text: t("parentEnrollment.cancel"), style: "destructive", onPress: () => void cancel.mutateAsync(enrollmentId) },
  ]);
  return <AppScreen><View style={styles.content}>
    <AppText variant="title">{t("parentEnrollment.title")}</AppText><AppText tone="muted">{t("parentEnrollment.subtitle")}</AppText>
    {parentMemberships.length > 0 && <View style={styles.section}><AppText variant="heading">{t("parentEnrollment.activeTenants")}</AppText>{parentMemberships.map((membership) => <Button key={membership.organizationId} variant={membership.organizationId === organizationId ? "primary" : "secondary"} onPress={() => { selectOrganization(membership.organizationId); router.replace("/home"); }}>{membership.organizationName}</Button>)}</View>}
    <AppText variant="heading">{t("parentEnrollment.newTenant")}</AppText>
    {catalog.isLoading && <AppText>{t("common.loading")}</AppText>}{!catalog.isLoading && !tenant && <AppText tone="muted">{t("parentEnrollment.noTenant")}</AppText>}
    {availableTenants.map((item) => <Button key={item.organizationId} variant={tenant?.organizationId === item.organizationId ? "primary" : "secondary"} onPress={() => { setTenantId(item.organizationId); setBranchId(undefined); setPlanId(undefined); }}>{item.organizationName}</Button>)}
    {tenant && <><AppText variant="heading">{t("parentEnrollment.branch")}</AppText>{tenant.branches.map((item) => <Button key={item.id} variant={branch?.id === item.id ? "primary" : "secondary"} onPress={() => setBranchId(item.id)}>{item.name}{item.dailyCapacity ? ` · ${t("parentEnrollment.quota", { count: item.dailyCapacity })}` : ""}</Button>)}
      <AppText variant="heading">{t("parentEnrollment.plan")}</AppText>{tenant.plans.map((item) => <Button key={item.id} variant={plan?.id === item.id ? "primary" : "secondary"} onPress={() => setPlanId(item.id)}>{item.name} · {formatCurrency(item.price)}</Button>)}
      <AppText variant="heading">{t("parentEnrollment.children")}</AppText>{children.map((child, index) => <View key={index} style={styles.childForm}><AppText variant="label">{t("parentEnrollment.childNumber", { number: index + 1 })}</AppText><TextInput style={styles.input} placeholder={t("children.firstName")} value={child.firstName} onChangeText={(firstName) => setChildren((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, firstName } : item))} /><TextInput style={styles.input} placeholder={t("children.lastName")} value={child.lastName ?? ""} onChangeText={(lastName) => setChildren((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, lastName } : item))} /><GenderPicker value={child.gender} onChange={(gender) => setChildren((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, gender } : item))} /><DatePicker placeholder={t("children.birthDate")} value={child.dateOfBirth} onChange={(dateOfBirth) => setChildren((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, dateOfBirth } : item))} maximumDate={formatIsoDate(new Date())} />{children.length > 1 && <Button variant="danger" onPress={() => setChildren((current) => current.filter((_, itemIndex) => itemIndex !== index))}>{t("parentEnrollment.removeChild")}</Button>}</View>)}<Button variant="secondary" onPress={() => setChildren((current) => [...current, emptyChild()])}>{t("parentEnrollment.addChild")}</Button>
      <AppText tone="muted">{t("parentEnrollment.bookingAfterApproval")}</AppText><Button loading={checkout.isPending} onPress={() => checkout.mutate()}>{t("parentEnrollment.checkout")}</Button>
    </>}
    {enrollments.data && enrollments.data.length > 0 && <View style={styles.section}><AppText variant="heading">{t("parentEnrollment.status")}</AppText>{enrollments.data.map((item) => <View key={item.id} style={styles.card}><AppText variant="label">{item.childName}</AppText><AppText>{t((item.status === "APPROVED" ? "status.CONFIRMED" : `status.${item.status}`) as never)}</AppText><AppText tone="muted">{item.status === "PENDING_PAYMENT" ? item.invoiceStatus === "PAYMENT_SUBMITTED" ? t("paymentProof.awaitingReview") : t("parentEnrollment.pendingPayment") : item.status === "PENDING_APPROVAL" ? t("parentEnrollment.pendingApproval") : item.status === "REJECTED" ? t("parentEnrollment.rejected") : item.status === "EXPIRED" ? t("parentEnrollment.expired") : item.status === "CANCELLED" ? t("parentEnrollment.cancelled") : ""}</AppText>{item.status === "PENDING_PAYMENT" && item.invoiceStatus === "PENDING" && <><Button variant="secondary" onPress={() => router.push({ pathname: "/payment-proof", params: { invoiceId: item.invoiceId } })}>{t("paymentProof.submit")}</Button><Button variant="danger" loading={cancel.isPending} onPress={() => cancelEnrollment(item.id)}>{t("parentEnrollment.cancel")}</Button></>}{item.status === "REJECTED" && <Button loading={retry.isPending} onPress={() => retry.mutate(item.id)}>{t("parentEnrollment.retry")}</Button>}</View>)}</View>}
  </View></AppScreen>;
}
const styles = StyleSheet.create({ content: { gap: spacing.sm }, section: { gap: spacing.sm, marginTop: spacing.md }, card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, childForm: { gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.surface } });
