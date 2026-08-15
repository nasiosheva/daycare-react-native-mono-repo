import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, Button, MultiStepFormWizard, ShimmerList, colors, radius, spacing, type MultiStepFormWizardStep } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { servicePlanTypeKey } from "@/i18n/translations";
import { GenderPicker } from "@/children/GenderPicker";
import { DatePicker } from "@/date-picker/DatePicker";
import { capitalizeWords } from "@/text/capitalizeWords";
import { formatIsoDate } from "@/date-picker/date";
import { parentEnrollmentCatalogQueryKey, parentEnrollmentQueryKey } from "@/parent-enrollment/queryKeys";
import {
  MAX_ENROLLMENT_CHILDREN,
  emptyEnrollmentChild,
  enrollmentChildDraftErrors,
  isEnrollmentChildrenStepComplete,
  planAfterOrganizationChange,
  type EnrollmentChildDraft,
} from "@/parent-enrollment/form";

type EnrollmentStep = 0 | 1 | 2;

export default function ParentEnrollmentFormScreen() {
  const router = useRouter();
  const { api, profile, user } = useAuth();
  const { t, formatCurrency } = useI18n();
  const client = useQueryClient();
  const today = useMemo(() => formatIsoDate(new Date()), []);
  const [step, setStep] = useState<EnrollmentStep>(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tenantId, setTenantId] = useState<string>();
  const [branchId, setBranchId] = useState<string>();
  const [planId, setPlanId] = useState<string>();
  const [children, setChildren] = useState<EnrollmentChildDraft[]>([emptyEnrollmentChild()]);
  const [showChildErrors, setShowChildErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const catalog = useQuery({
    queryKey: [...parentEnrollmentCatalogQueryKey(user?.uid), debouncedSearch],
    queryFn: () => api.parentEnrollmentCatalog(debouncedSearch || undefined),
    enabled: Boolean(user),
  });
  const parentMemberships = profile?.memberships.filter((membership) => membership.role === "PARENT" && membership.active) ?? [];
  const availableTenants = useMemo(
    () => catalog.data?.filter((item) => !parentMemberships.some((membership) => membership.organizationId === item.organizationId)) ?? [],
    [catalog.data, parentMemberships],
  );
  const tenant = useMemo(() => availableTenants.find((item) => item.organizationId === tenantId), [availableTenants, tenantId]);
  const branch = tenant?.branches.find((item) => item.id === branchId);
  const plan = tenant?.plans.find((item) => item.id === planId);
  const childErrors = useMemo(() => children.map((child) => enrollmentChildDraftErrors(child, today)), [children, today]);
  const childrenComplete = useMemo(() => isEnrollmentChildrenStepComplete(children, today), [children, today]);
  const wizardSteps: MultiStepFormWizardStep[] = [
    { id: "branch", label: t("parentEnrollment.stepBranch") },
    { id: "children", label: t("parentEnrollment.stepChildren") },
    { id: "plan", label: t("parentEnrollment.stepPlan") },
  ];

  useEffect(() => {
    if (step > 0 && (!tenant || !branch)) {
      setStep(0);
      setTenantId(undefined);
      setBranchId(undefined);
      setPlanId(undefined);
    }
  }, [branch, step, tenant]);

  const checkout = useMutation({
    mutationFn: () => {
      if (!tenant || !branch || !plan || !childrenComplete) throw new Error(t("parentEnrollment.formIncomplete"));
      return api.checkoutParentEnrollment({
        organizationId: tenant.organizationId,
        branchId: branch.id,
        planId: plan.id,
        bookingDates: [],
        children: children.map((child) => ({
          firstName: child.firstName.trim(),
          lastName: child.lastName?.trim() || undefined,
          gender: child.gender!,
          dateOfBirth: child.dateOfBirth,
        })),
      });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: parentEnrollmentQueryKey(user?.uid) });
      router.replace("/parent-enrollment");
    },
    onError: (value) => setError(value instanceof Error ? value.message : t("parentEnrollment.failed")),
  });

  const goBack = () => {
    setError(null);
    if (step === 0) router.back();
    else setStep((current) => (current - 1) as EnrollmentStep);
  };
  const selectBranch = (organizationId: string, selectedBranchId: string) => {
    setPlanId((current) => planAfterOrganizationChange(tenantId, organizationId, current));
    setTenantId(organizationId);
    setBranchId(selectedBranchId);
    setError(null);
    setStep(1);
  };
  const updateChild = (index: number, value: Partial<EnrollmentChildDraft>) => {
    setChildren((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...value } : item));
    setError(null);
  };
  const continueToPlan = () => {
    setShowChildErrors(true);
    if (childrenComplete) {
      setError(null);
      setStep(2);
    }
  };
  const openMaps = async (url: string) => {
    try { await Linking.openURL(url); }
    catch { Alert.alert(t("branch.mapsOpenFailed")); }
  };

  return <AppScreen
    showBottomNavigation={false}
    title={t("parentEnrollment.newTenant")}
    header={<BackButton accessibilityLabel={t("common.back")} onPress={goBack} />}
  >
    <View style={styles.hero}>
      <AppText variant="title">{t("parentEnrollment.newTenant")}</AppText>
      <AppText tone="muted">{t("parentEnrollment.wizardDescription")}</AppText>
    </View>

    <MultiStepFormWizard
      steps={wizardSteps}
      currentStep={step}
      accessibilityLabel={t("parentEnrollment.stepProgress", { current: step + 1, total: wizardSteps.length })}
      progressLabel={t("parentEnrollment.stepProgress", { current: step + 1, total: wizardSteps.length })}
    >
      {step === 0 && <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <AppText variant="heading">{t("parentEnrollment.stepBranch")}</AppText>
        <AppText tone="muted">{t("parentEnrollment.selectBranchDescription")}</AppText>
      </View>
      <TextInput
        accessibilityLabel={t("parentEnrollment.searchTenant")}
        style={styles.input}
        autoCapitalize="none"
        placeholder={t("parentEnrollment.searchTenant")}
        value={search}
        onChangeText={setSearch}
      />
      {catalog.isLoading && <ShimmerList variant="row" />}
      {catalog.isError && <View accessibilityRole="alert" style={styles.errorCard}>
        <AppText tone="danger">{t("parentEnrollment.catalogLoadFailed")}</AppText>
        <Button variant="secondary" onPress={() => void catalog.refetch()}>{t("common.retry")}</Button>
      </View>}
      {!catalog.isLoading && !catalog.isError && availableTenants.length === 0 && <View style={styles.emptyCard}>
        <AppText tone="muted">{debouncedSearch ? t("common.noResults") : t("common.noData")}</AppText>
      </View>}
      {!catalog.isLoading && !catalog.isError && availableTenants.map((item) => {
        const missingBranch = item.branches.length === 0;
        const missingPlan = item.plans.length === 0;
        const tenantAvailable = !missingBranch && !missingPlan;
        const unavailableReason = missingBranch ? t("parentEnrollment.unavailableBranch") : t("parentEnrollment.unavailablePlan");
        const startingPrice = !missingPlan ? Math.min(...item.plans.map((itemPlan) => itemPlan.price)) : null;
        return <View key={item.organizationId} style={styles.tenantGroup}>
          <View style={styles.tenantHeading}>
            <AppText variant="h5">{item.organizationName}</AppText>
            {!tenantAvailable && <AppText variant="caption" tone="muted">{unavailableReason}</AppText>}
          </View>
          {tenantAvailable && item.branches.map((branchItem) => {
            const selected = tenantId === item.organizationId && branchId === branchItem.id;
            return <View key={branchItem.id} style={[styles.branchCard, selected && styles.selectedCard]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.organizationName} · ${branchItem.name}`}
                accessibilityState={{ selected }}
                onPress={() => selectBranch(item.organizationId, branchItem.id)}
                style={({ pressed }) => [styles.cardTap, pressed && styles.pressed]}
              >
                <View style={styles.cardTitleRow}>
                  <AppText variant="label" style={styles.grow}>{branchItem.name}</AppText>
                  <AppText variant="caption" style={styles.chooseLabel}>{t("parentEnrollment.chooseBranch")}</AppText>
                </View>
                {branchItem.fullAddress && <AppText tone="muted">{branchItem.fullAddress}</AppText>}
                <AppText variant="caption" tone="muted">{t("parentEnrollment.startingFrom", { price: formatCurrency(startingPrice!) })}</AppText>
              </Pressable>
              {branchItem.googleMapsUrl && <Button variant="ghost" onPress={() => void openMaps(branchItem.googleMapsUrl!)}>{t("branch.openGoogleMaps")}</Button>}
            </View>;
          })}
        </View>;
      })}
      </View>}

      {step === 1 && tenant && branch && <View style={styles.section}>
      <SelectedBranchSummary organizationName={tenant.organizationName} branchName={branch.name} address={branch.fullAddress} />
      <View style={styles.sectionHeading}>
        <AppText variant="heading">{t("parentEnrollment.stepChildren")}</AppText>
        <AppText tone="muted">{t("parentEnrollment.childFormDescription")}</AppText>
      </View>
      {children.map((child, index) => {
        const errors = showChildErrors ? childErrors[index] : {};
        return <View key={index} style={styles.childCard}>
          <View style={styles.cardTitleRow}>
            <AppText variant="h5" style={styles.grow}>{t("parentEnrollment.childNumber", { number: index + 1 })}</AppText>
            {children.length > 1 && <Button variant="ghost" onPress={() => setChildren((current) => current.filter((_, itemIndex) => itemIndex !== index))}>{t("parentEnrollment.removeChild")}</Button>}
          </View>
          <View style={styles.field}>
            <AppText variant="label">{t("parentEnrollment.firstNameLabel")}</AppText>
            <TextInput
              accessibilityLabel={t("parentEnrollment.firstNameLabel")}
              style={[styles.input, errors.firstName && styles.inputError]}
              autoCapitalize="words"
              maxLength={100}
              placeholder={t("children.firstName")}
              value={child.firstName}
              onChangeText={(value) => updateChild(index, { firstName: capitalizeWords(value) })}
            />
            {errors.firstName && <AppText variant="caption" tone="danger">{t("parentEnrollment.firstNameRequired")}</AppText>}
          </View>
          <View style={styles.field}>
            <AppText variant="label">{t("parentEnrollment.lastNameLabel")}</AppText>
            <TextInput
              accessibilityLabel={t("parentEnrollment.lastNameLabel")}
              style={styles.input}
              autoCapitalize="words"
              maxLength={100}
              placeholder={t("children.lastName")}
              value={child.lastName ?? ""}
              onChangeText={(value) => updateChild(index, { lastName: capitalizeWords(value) })}
            />
          </View>
          <View style={styles.field}>
            <GenderPicker value={child.gender} onChange={(gender) => updateChild(index, { gender })} />
            {errors.gender && <AppText variant="caption" tone="danger">{t("parentEnrollment.genderRequired")}</AppText>}
          </View>
          <View style={styles.field}>
            <AppText variant="label">{t("parentEnrollment.birthDateLabel")}</AppText>
            <DatePicker
              placeholder={t("children.birthDate")}
              value={child.dateOfBirth}
              onChange={(dateOfBirth) => updateChild(index, { dateOfBirth })}
              maximumDate={today}
            />
            {errors.dateOfBirth && <AppText variant="caption" tone="danger">{t(errors.dateOfBirth === "REQUIRED" ? "parentEnrollment.birthDateRequired" : "parentEnrollment.birthDateInvalid")}</AppText>}
          </View>
        </View>;
      })}
      {children.length < MAX_ENROLLMENT_CHILDREN
        ? <Button variant="secondary" onPress={() => setChildren((current) => [...current, emptyEnrollmentChild()])}>{t("parentEnrollment.addChild")}</Button>
        : <AppText variant="caption" tone="muted">{t("parentEnrollment.maxChildren", { count: MAX_ENROLLMENT_CHILDREN })}</AppText>}
      <View style={styles.actions}>
        <Button style={styles.actionButton} variant="secondary" onPress={goBack}>{t("common.back")}</Button>
        <Button style={styles.actionButton} onPress={continueToPlan}>{t("tenant.next")}</Button>
      </View>
      </View>}

      {step === 2 && tenant && branch && <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <AppText variant="heading">{t("parentEnrollment.stepPlan")}</AppText>
        <AppText tone="muted">{t("parentEnrollment.planDescription")}</AppText>
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel={t("parentEnrollment.plan")} style={styles.planList}>
        {tenant.plans.map((item) => {
          const selected = planId === item.id;
          return <Pressable
            key={item.id}
            accessibilityRole="radio"
            accessibilityLabel={`${item.name} · ${formatCurrency(item.price)}`}
            accessibilityState={{ selected }}
            onPress={() => { setPlanId(item.id); setError(null); }}
            style={({ pressed }) => [styles.planCard, selected && styles.selectedCard, pressed && styles.pressed]}
          >
            <View style={styles.cardTitleRow}>
              <AppText variant="h5" style={styles.grow}>{item.name}</AppText>
              <View style={[styles.radio, selected && styles.radioSelected]}>{selected && <View style={styles.radioDot} />}</View>
            </View>
            <AppText>{t("parentEnrollment.pricePerChild", { price: formatCurrency(item.price) })}</AppText>
            <AppText variant="caption" tone="muted">{t(servicePlanTypeKey(item.type))}</AppText>
            {item.creditCount != null && <AppText variant="caption" tone="muted">{t("parentEnrollment.planCredits", { count: item.creditCount })}</AppText>}
            {item.dailyCapacity != null && <AppText variant="caption" tone="muted">{t("parentEnrollment.quota", { count: item.dailyCapacity })}</AppText>}
          </Pressable>;
        })}
      </View>

      {plan && <View style={styles.reviewCard}>
        <View style={styles.sectionHeading}>
          <AppText variant="heading">{t("parentEnrollment.reviewTitle")}</AppText>
          <AppText tone="muted">{t("parentEnrollment.reviewDescription")}</AppText>
        </View>
        <ReviewRow label={t("parentEnrollment.reviewInstitution")} value={tenant.organizationName} />
        <ReviewRow label={t("parentEnrollment.reviewBranch")} value={branch.name} />
        <View style={styles.reviewGroup}>
          <AppText variant="caption" tone="muted">{t("parentEnrollment.childrenCount", { count: children.length })}</AppText>
          {children.map((child, index) => <AppText key={`${child.firstName}-${index}`} variant="label">{index + 1}. {child.firstName.trim()} {child.lastName?.trim()}</AppText>)}
        </View>
        <ReviewRow label={t("parentEnrollment.reviewPlan")} value={`${plan.name} · ${formatCurrency(plan.price)}`} />
        <View style={styles.noticeCard}>
          <AppText variant="label">{t("parentEnrollment.pendingApprovalTitle")}</AppText>
          <AppText tone="muted">{t("parentEnrollment.pendingApprovalNotice")}</AppText>
        </View>
      </View>}

      {error && <View accessibilityRole="alert" style={styles.errorCard}><AppText tone="danger">{error}</AppText></View>}
      <View style={styles.actions}>
        <Button style={styles.actionButton} variant="secondary" onPress={goBack}>{t("common.back")}</Button>
        <Button style={styles.actionButton} loading={checkout.isPending} disabled={!plan} onPress={() => checkout.mutate()}>{t("parentEnrollment.submitApplication")}</Button>
      </View>
      </View>}
    </MultiStepFormWizard>
  </AppScreen>;
}

function SelectedBranchSummary({ organizationName, branchName, address }: { organizationName: string; branchName: string; address?: string | null }) {
  return <View style={styles.selectionSummary}>
    <AppText variant="label">{organizationName}</AppText>
    <AppText>{branchName}</AppText>
    {address && <AppText variant="caption" tone="muted">{address}</AppText>}
  </View>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.reviewRow}>
    <AppText variant="caption" tone="muted">{label}</AppText>
    <AppText variant="label">{value}</AppText>
  </View>;
}

const styles = StyleSheet.create({
  hero: { gap: spacing.xs },
  section: { gap: spacing.md },
  sectionHeading: { gap: spacing.xs },
  field: { gap: spacing.xs },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.surface, color: colors.text },
  inputError: { borderColor: colors.danger },
  tenantGroup: { gap: spacing.sm },
  tenantHeading: { gap: spacing.xs, paddingHorizontal: spacing.xs },
  branchCard: { overflow: "hidden", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cardTap: { gap: spacing.xs, padding: spacing.md },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  grow: { flex: 1 },
  chooseLabel: { color: colors.primary },
  selectedCard: { borderColor: colors.primary, backgroundColor: colors.surfaceTint },
  pressed: { opacity: 0.76 },
  emptyCard: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface },
  errorCard: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, backgroundColor: colors.dangerSoft },
  selectionSummary: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.accentSoft },
  childCard: { gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  planList: { gap: spacing.sm },
  planCard: { gap: spacing.xs, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  radio: { width: 22, height: 22, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.muted, borderRadius: radius.pill },
  radioSelected: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.primary },
  reviewCard: { gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  reviewRow: { gap: spacing.xs, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  reviewGroup: { gap: spacing.xs },
  noticeCard: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.accentSoft },
  actions: { flexDirection: "row", gap: spacing.sm },
  actionButton: { flex: 1 },
});
