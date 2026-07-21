import { useMemo, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, Button, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";

export default function ParentEnrollmentScreen() {
  const { api, refreshProfile, profile, organizationId, selectOrganization } = useAuth(); const { t, formatCurrency } = useI18n(); const client = useQueryClient();
  const catalog = useQuery({ queryKey: ["parent-enrollment-catalog"], queryFn: () => api.parentEnrollmentCatalog() });
  const enrollments = useQuery({ queryKey: ["parent-enrollments"], queryFn: () => api.parentEnrollments() });
  const [tenantId, setTenantId] = useState<string>(); const tenant = useMemo(() => catalog.data?.find((item) => item.organizationId === tenantId) ?? catalog.data?.[0], [catalog.data, tenantId]);
  const [branchId, setBranchId] = useState<string>(); const branch = tenant?.branches.find((item) => item.id === branchId) ?? tenant?.branches[0];
  const [planId, setPlanId] = useState<string>(); const plan = tenant?.plans.find((item) => item.id === planId) ?? tenant?.plans[0];
  const [firstName, setFirstName] = useState(""); const [lastName, setLastName] = useState(""); const [dateOfBirth, setDateOfBirth] = useState(""); const [dates, setDates] = useState("");
  const parentMemberships = profile?.memberships.filter((membership) => membership.role === "PARENT") ?? [];
  const checkout = useMutation({ mutationFn: () => {
    if (!tenant || !branch || !plan || !firstName.trim() || !dateOfBirth.trim()) throw new Error(t("children.required"));
    const bookingDates = plan.type === "MONTHLY" ? [] : dates.split(",").map((item) => item.trim()).filter(Boolean);
    return api.checkoutParentEnrollment({ organizationId: tenant.organizationId, branchId: branch.id, planId: plan.id, bookingDates, child: { firstName: firstName.trim(), lastName: lastName.trim() || undefined, dateOfBirth: dateOfBirth.trim() } });
  }, onSuccess: async () => { await client.invalidateQueries({ queryKey: ["parent-enrollments"] }); await refreshProfile(); Alert.alert(t("parentEnrollment.created")); }, onError: (error) => Alert.alert(t("parentEnrollment.failed"), error instanceof Error ? error.message : t("auth.tryAgain")) });
  const retry = useMutation({ mutationFn: (enrollmentId: string) => api.retryParentEnrollment(enrollmentId, dates.split(",").map((item) => item.trim()).filter(Boolean)), onSuccess: () => void client.invalidateQueries({ queryKey: ["parent-enrollments"] }), onError: (error) => Alert.alert(t("parentEnrollment.failed"), error instanceof Error ? error.message : t("auth.tryAgain")) });
  return <AppScreen><View style={styles.content}>
    <AppText variant="title">{t("parentEnrollment.title")}</AppText><AppText tone="muted">{t("parentEnrollment.subtitle")}</AppText>
    {parentMemberships.length > 0 && <View style={styles.section}><AppText variant="heading">{t("parentEnrollment.activeTenants")}</AppText>{parentMemberships.map((membership) => <Button key={membership.organizationId} variant={membership.organizationId === organizationId ? "primary" : "secondary"} onPress={() => { selectOrganization(membership.organizationId); router.replace("/home"); }}>{membership.organizationName}</Button>)}</View>}
    <AppText variant="heading">{t("parentEnrollment.newTenant")}</AppText>
    {catalog.isLoading && <AppText>{t("common.loading")}</AppText>}{!catalog.isLoading && !tenant && <AppText tone="muted">{t("parentEnrollment.noTenant")}</AppText>}
    {catalog.data?.map((item) => <Button key={item.organizationId} variant={tenant?.organizationId === item.organizationId ? "primary" : "secondary"} onPress={() => { setTenantId(item.organizationId); setBranchId(undefined); setPlanId(undefined); }}>{item.organizationName}</Button>)}
    {tenant && <><AppText variant="heading">{t("parentEnrollment.branch")}</AppText>{tenant.branches.map((item) => <Button key={item.id} variant={branch?.id === item.id ? "primary" : "secondary"} onPress={() => setBranchId(item.id)}>{item.name}{item.dailyCapacity ? ` · ${t("parentEnrollment.quota", { count: item.dailyCapacity })}` : ""}</Button>)}
      <AppText variant="heading">{t("parentEnrollment.plan")}</AppText>{tenant.plans.map((item) => <Button key={item.id} variant={plan?.id === item.id ? "primary" : "secondary"} onPress={() => setPlanId(item.id)}>{item.name} · {formatCurrency(item.price)}</Button>)}
      <AppText variant="heading">{t("booking.child")}</AppText><TextInput style={styles.input} placeholder={t("children.firstName")} value={firstName} onChangeText={setFirstName} /><TextInput style={styles.input} placeholder={t("children.lastName")} value={lastName} onChangeText={setLastName} /><TextInput style={styles.input} placeholder={t("children.birthDate")} value={dateOfBirth} onChangeText={setDateOfBirth} />
      {plan?.type !== "MONTHLY" && <TextInput style={styles.input} placeholder={t("parentEnrollment.dates")} value={dates} onChangeText={setDates} />}
      <Button loading={checkout.isPending} onPress={() => checkout.mutate()}>{t("parentEnrollment.checkout")}</Button>
    </>}
    {enrollments.data && enrollments.data.length > 0 && <View style={styles.section}><AppText variant="heading">{t("parentEnrollment.status")}</AppText>{enrollments.data.map((item) => <View key={item.id} style={styles.card}><AppText variant="label">{item.childName}</AppText><AppText>{t((item.status === "APPROVED" ? "status.CONFIRMED" : `status.${item.status}`) as never)}</AppText><AppText tone="muted">{item.status === "PENDING_PAYMENT" ? t("parentEnrollment.pendingPayment") : item.status === "PENDING_APPROVAL" ? t("parentEnrollment.pendingApproval") : item.status === "REJECTED" ? t("parentEnrollment.rejected") : ""}</AppText>{item.status === "REJECTED" && <Button loading={retry.isPending} onPress={() => retry.mutate(item.id)}>{t("parentEnrollment.retry")}</Button>}</View>)}</View>}
  </View></AppScreen>;
}
const styles = StyleSheet.create({ content: { gap: spacing.sm }, section: { gap: spacing.sm, marginTop: spacing.md }, card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.surface } });
