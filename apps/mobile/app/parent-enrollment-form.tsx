import { useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChildGender } from "@daycare/core";
import type { ParentEnrollmentCheckoutInput } from "@daycare/api-client";
import { AppText, BackButton, BottomSheet, Button, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { GenderPicker } from "@/children/GenderPicker";
import { DatePicker } from "@/date-picker/DatePicker";
import { capitalizeWords } from "@/text/capitalizeWords";
import { formatIsoDate, isIsoDate } from "@/date-picker/date";
import { parentEnrollmentCatalogQueryKey, parentEnrollmentQueryKey } from "@/parent-enrollment/queryKeys";

type ChildDraft = Omit<ParentEnrollmentCheckoutInput["children"][number], "gender"> & { gender?: ChildGender };
const emptyChild = (): ChildDraft => ({ firstName: "", lastName: "", dateOfBirth: "" });

export default function ParentEnrollmentFormScreen() {
  const router = useRouter(); const { api, profile, user } = useAuth(); const { t, formatCurrency } = useI18n(); const client = useQueryClient();
  const catalog = useQuery({ queryKey: parentEnrollmentCatalogQueryKey(user?.uid), queryFn: () => api.parentEnrollmentCatalog(), enabled: Boolean(user) });
  const parentMemberships = profile?.memberships.filter((membership) => membership.role === "PARENT" && membership.active) ?? [];
  const availableTenants = useMemo(() => catalog.data?.filter((item) => !parentMemberships.some((membership) => membership.organizationId === item.organizationId)) ?? [], [catalog.data, parentMemberships]);
  const [tenantId, setTenantId] = useState<string>(); const tenant = useMemo(() => availableTenants.find((item) => item.organizationId === tenantId), [availableTenants, tenantId]);
  const [branchId, setBranchId] = useState<string>(); const branch = tenant?.branches.find((item) => item.id === branchId);
  const [planId, setPlanId] = useState<string>(); const plan = tenant?.plans.find((item) => item.id === planId);
  const [children, setChildren] = useState<ChildDraft[]>([emptyChild()]);
  const [error, setError] = useState<string | null>(null);
  const checkout = useMutation({ mutationFn: () => {
    if (!tenant || !branch || !plan || children.some((child) => !child.firstName.trim() || !child.gender || !isIsoDate(child.dateOfBirth))) throw new Error(t("children.required"));
    return api.checkoutParentEnrollment({ organizationId: tenant.organizationId, branchId: branch.id, planId: plan.id, bookingDates: [], children: children.map((child) => ({ firstName: child.firstName.trim(), lastName: child.lastName?.trim() || undefined, gender: child.gender!, dateOfBirth: child.dateOfBirth })) });
  }, onSuccess: async () => { await client.invalidateQueries({ queryKey: parentEnrollmentQueryKey(user?.uid) }); router.replace("/parent-enrollment"); }, onError: (value) => setError(value instanceof Error ? value.message : t("parentEnrollment.failed")) });
  const closeTenantSheet = () => { setTenantId(undefined); setBranchId(undefined); setPlanId(undefined); setChildren([emptyChild()]); setError(null); };
  return <AppScreen showBottomNavigation={false} title={t("parentEnrollment.newTenant")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}><View style={styles.content}>
    <AppText variant="title">{t("parentEnrollment.newTenant")}</AppText>
    <AppText tone="muted">{t("parentEnrollment.wizardDescription")}</AppText>
    <AppText variant="heading">{t("parentEnrollment.tenant")}</AppText>
    {catalog.isLoading && <ShimmerList variant="row" />}
    {!catalog.isLoading && availableTenants.map((item) => {
      const missingBranch = item.branches.length === 0;
      const missingPlan = item.plans.length === 0;
      const available = !missingBranch && !missingPlan;
      const unavailableReason = missingBranch ? t("parentEnrollment.unavailableBranch") : t("parentEnrollment.unavailablePlan");
      return <View key={item.organizationId} style={styles.tenantOption}>
        <Button disabled={!available} variant={tenantId === item.organizationId ? "primary" : "secondary"} onPress={() => { setTenantId(item.organizationId); setBranchId(undefined); setPlanId(undefined); }}>{item.organizationName}</Button>
        {!available && <AppText variant="caption" tone="muted">{unavailableReason}</AppText>}
      </View>;
    })}
  </View>

    <BottomSheet
      visible={Boolean(tenant)}
      onClose={closeTenantSheet}
      closeAccessibilityLabel={t("common.close")}
      title={tenant?.organizationName}
      negativeAction={{ label: t("common.cancel"), onPress: closeTenantSheet }}
      positiveAction={{ label: t("parentEnrollment.submitApplication"), loading: checkout.isPending, disabled: !tenant || !branch || !plan, onPress: () => checkout.mutate() }}
    >
      {error && <AppText tone="danger">{error}</AppText>}
      {tenant && <>
        <AppText variant="heading">{t("parentEnrollment.branch")}</AppText>{tenant.branches.map((item) => <Button key={item.id} variant={branch?.id === item.id ? "primary" : "secondary"} onPress={() => setBranchId(item.id)}>{item.name}</Button>)}
        <AppText variant="heading">{t("parentEnrollment.children")}</AppText>{children.map((child, index) => <View key={index} style={styles.childForm}><AppText variant="label">{t("parentEnrollment.childNumber", { number: index + 1 })}</AppText><TextInput style={styles.input} autoCapitalize="words" placeholder={t("children.firstName")} value={child.firstName} onChangeText={(value) => setChildren((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, firstName: capitalizeWords(value) } : item))} /><TextInput style={styles.input} autoCapitalize="words" placeholder={t("children.lastName")} value={child.lastName ?? ""} onChangeText={(value) => setChildren((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, lastName: capitalizeWords(value) } : item))} /><GenderPicker value={child.gender} onChange={(gender) => setChildren((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, gender } : item))} /><DatePicker placeholder={t("children.birthDate")} value={child.dateOfBirth} onChange={(dateOfBirth) => setChildren((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, dateOfBirth } : item))} maximumDate={formatIsoDate(new Date())} />{children.length > 1 && <Button variant="danger" onPress={() => setChildren((current) => current.filter((_, itemIndex) => itemIndex !== index))}>{t("parentEnrollment.removeChild")}</Button>}</View>)}<Button variant="secondary" onPress={() => setChildren((current) => [...current, emptyChild()])}>{t("parentEnrollment.addChild")}</Button>
        <AppText variant="heading">{t("parentEnrollment.plan")}</AppText>{tenant.plans.map((item) => <Button key={item.id} variant={plan?.id === item.id ? "primary" : "secondary"} onPress={() => setPlanId(item.id)}>{item.name} · {formatCurrency(item.price)}</Button>)}
      </>}
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.sm }, tenantOption: { gap: spacing.xs }, childForm: { gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.surface } });
