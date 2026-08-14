import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, TextInput, View } from "react-native";
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
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);
  const catalog = useQuery({ queryKey: [...parentEnrollmentCatalogQueryKey(user?.uid), debouncedSearch], queryFn: () => api.parentEnrollmentCatalog(debouncedSearch || undefined), enabled: Boolean(user) });
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
  const openMaps = async (url: string) => { try { await Linking.openURL(url); } catch { Alert.alert(t("branch.mapsOpenFailed")); } };
  return <AppScreen showBottomNavigation={false} title={t("parentEnrollment.newTenant")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}><View style={styles.content}>
    <AppText variant="title">{t("parentEnrollment.newTenant")}</AppText>
    <AppText tone="muted">{t("parentEnrollment.wizardDescription")}</AppText>
    <AppText variant="heading">{t("parentEnrollment.tenant")}</AppText>
    <TextInput style={styles.input} placeholder={t("parentEnrollment.searchTenant")} value={search} onChangeText={setSearch} />
    {catalog.isLoading && <ShimmerList variant="row" />}
    {!catalog.isLoading && !availableTenants.length && <AppText tone="muted">{debouncedSearch ? t("common.noResults") : t("common.noData")}</AppText>}
    {!catalog.isLoading && availableTenants.map((item) => {
      const missingBranch = item.branches.length === 0;
      const missingPlan = item.plans.length === 0;
      const tenantAvailable = !missingBranch && !missingPlan;
      const unavailableReason = missingBranch ? t("parentEnrollment.unavailableBranch") : t("parentEnrollment.unavailablePlan");
      const startingPrice = !missingPlan ? Math.min(...item.plans.map((plan) => plan.price)) : null;
      return <View key={item.organizationId} style={styles.tenantGroup}>
        <AppText variant="label">{item.organizationName}</AppText>
        {!tenantAvailable && <AppText variant="caption" tone="muted">{unavailableReason}</AppText>}
        {tenantAvailable && item.branches.map((branchItem) => {
          const selected = tenantId === item.organizationId && branchId === branchItem.id;
          return <View key={branchItem.id} style={[styles.tenantCard, styles.branchIndent, selected && styles.tenantCardSelected]}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${item.organizationName} · ${branchItem.name}`} onPress={() => { setTenantId(item.organizationId); setBranchId(branchItem.id); setPlanId(undefined); }} style={({ pressed }) => [styles.tenantCardTap, pressed && styles.tenantCardPressed]}>
              <AppText variant="label">{branchItem.name}</AppText>
              <AppText variant="caption" tone="muted">{t("parentEnrollment.startingFrom", { price: formatCurrency(startingPrice!) })}</AppText>
              {branchItem.fullAddress && <AppText variant="caption" tone="muted">{branchItem.fullAddress}</AppText>}
            </Pressable>
            {branchItem.googleMapsUrl && <Button variant="secondary" onPress={() => void openMaps(branchItem.googleMapsUrl!)}>{t("branch.openGoogleMaps")}</Button>}
          </View>;
        })}
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
        <AppText variant="caption" tone="muted">{t("parentEnrollment.branch")}: {branch?.name}</AppText>
        <AppText variant="heading">{t("parentEnrollment.children")}</AppText>{children.map((child, index) => <View key={index} style={styles.childForm}><AppText variant="label">{t("parentEnrollment.childNumber", { number: index + 1 })}</AppText><TextInput style={styles.input} autoCapitalize="words" placeholder={t("children.firstName")} value={child.firstName} onChangeText={(value) => setChildren((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, firstName: capitalizeWords(value) } : item))} /><TextInput style={styles.input} autoCapitalize="words" placeholder={t("children.lastName")} value={child.lastName ?? ""} onChangeText={(value) => setChildren((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, lastName: capitalizeWords(value) } : item))} /><GenderPicker value={child.gender} onChange={(gender) => setChildren((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, gender } : item))} /><DatePicker placeholder={t("children.birthDate")} value={child.dateOfBirth} onChange={(dateOfBirth) => setChildren((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, dateOfBirth } : item))} maximumDate={formatIsoDate(new Date())} />{children.length > 1 && <Button variant="danger" onPress={() => setChildren((current) => current.filter((_, itemIndex) => itemIndex !== index))}>{t("parentEnrollment.removeChild")}</Button>}</View>)}<Button variant="secondary" onPress={() => setChildren((current) => [...current, emptyChild()])}>{t("parentEnrollment.addChild")}</Button>
        <AppText variant="heading">{t("parentEnrollment.plan")}</AppText>{tenant.plans.map((item) => <Button key={item.id} variant={plan?.id === item.id ? "primary" : "secondary"} onPress={() => setPlanId(item.id)}>{item.name} · {formatCurrency(item.price)}</Button>)}
      </>}
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.sm }, tenantGroup: { gap: spacing.xs }, tenantCard: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, branchIndent: { marginLeft: spacing.md }, tenantCardTap: { gap: spacing.xs }, tenantCardSelected: { borderColor: colors.primary }, tenantCardPressed: { opacity: 0.76 }, childForm: { gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.surface } });
