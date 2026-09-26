import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, Badge, Banner, Button, EmptyState, ErrorState, InfoRow, MultiStepFormWizard, SearchField, ShimmerList, TextField, colors, radius, spacing, type MultiStepFormWizardStep } from "@daycare/ui";
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

type EnrollmentStep = number;

export default function ParentEnrollmentFormScreen() {
  const router = useRouter();
  const { transferChildId: rawTransferChildId, transferChildName: rawTransferChildName } = useLocalSearchParams<{ transferChildId?: string; transferChildName?: string }>();
  const transferChildId = typeof rawTransferChildId === "string" ? rawTransferChildId : null;
  const transferChildName = typeof rawTransferChildName === "string" ? rawTransferChildName : null;
  const isTransfer = Boolean(transferChildId);
  const { api, profile, user } = useAuth();
  const { t, formatCurrency } = useI18n();
  const client = useQueryClient();
  const today = useMemo(() => formatIsoDate(new Date()), []);
  const [step, setStep] = useState<EnrollmentStep>(0);
  const planStep = isTransfer ? 1 : 2;
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
  const wizardSteps: MultiStepFormWizardStep[] = isTransfer
    ? [{ id: "branch", label: t("parentEnrollment.stepBranch") }, { id: "plan", label: t("parentEnrollment.stepPlan") }]
    : [{ id: "branch", label: t("parentEnrollment.stepBranch") }, { id: "children", label: t("parentEnrollment.stepChildren") }, { id: "plan", label: t("parentEnrollment.stepPlan") }];

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
      if (!tenant || !branch || !plan) throw new Error(t("parentEnrollment.formIncomplete"));
      if (isTransfer) return api.transferChildEnrollment({ childId: transferChildId!, organizationId: tenant.organizationId, branchId: branch.id, planId: plan.id }).then((result) => [result]);
      if (!childrenComplete) throw new Error(t("parentEnrollment.formIncomplete"));
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
    title={isTransfer ? t("parentEnrollment.transferTitle") : t("parentEnrollment.newTenant")}
    header={<BackButton accessibilityLabel={t("common.back")} onPress={goBack} />}
  >
    <View style={styles.hero}>
      <AppText variant="title">{isTransfer ? t("parentEnrollment.transferFormTitle", { name: transferChildName ?? "" }) : t("parentEnrollment.newTenant")}</AppText>
      <AppText tone="muted">{isTransfer ? t("parentEnrollment.transferWizardDescription") : t("parentEnrollment.wizardDescription")}</AppText>
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
      <SearchField
        accessibilityLabel={t("parentEnrollment.searchTenant")}
        autoCapitalize="none"
        placeholder={t("parentEnrollment.searchTenant")}
        clearAccessibilityLabel={t("common.clearSearch")}
        value={search}
        onChangeText={setSearch}
      />
      {catalog.isLoading && <ShimmerList variant="row" />}
      {catalog.isError && !catalog.isFetching && <ErrorState compact title={t("parentEnrollment.catalogLoadFailed")} description={t("common.loadFailedDescription")} retryLabel={t("common.retry")} onRetry={() => void catalog.refetch()} />}
      {!catalog.isLoading && !catalog.isError && availableTenants.length === 0 && <EmptyState compact icon={debouncedSearch ? "search-outline" : "business-outline"} title={debouncedSearch ? t("common.noResults") : t("common.noData")} description={debouncedSearch ? t("parentEnrollment.searchHint") : undefined} />}
      {!catalog.isLoading && !catalog.isError && availableTenants.map((item) => {
        const missingBranch = item.branches.length === 0;
        const missingPlan = item.plans.length === 0;
        const tenantAvailable = !missingBranch && !missingPlan;
        const unavailableReason = missingBranch ? t("parentEnrollment.unavailableBranch") : t("parentEnrollment.unavailablePlan");
        const startingPrice = !missingPlan ? Math.min(...item.plans.map((itemPlan) => itemPlan.price)) : null;
        return <View key={item.organizationId} style={styles.tenantGroup}>
          <View style={styles.tenantHeading}>
            <AppText variant="h5">{item.organizationName}</AppText>
            {!tenantAvailable && <Badge tone="neutral" icon="information-circle-outline" label={unavailableReason} />}
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
                  <Ionicons name="business-outline" size={20} color={colors.primary} />
                  <AppText variant="label" style={styles.grow}>{branchItem.name}</AppText>
                  <View style={styles.chooseRow}><AppText variant="caption" style={styles.chooseLabel}>{t("parentEnrollment.chooseBranch")}</AppText><Ionicons name="chevron-forward" size={16} color={colors.primary} /></View>
                </View>
                {branchItem.fullAddress && <AppText variant="bodySmall" tone="muted">{branchItem.fullAddress}</AppText>}
                <AppText variant="label" style={styles.chooseLabel}>{t("parentEnrollment.startingFrom", { price: formatCurrency(startingPrice!) })}</AppText>
              </Pressable>
              {branchItem.googleMapsUrl && <Button variant="ghost" leadingIcon={<Ionicons name="map-outline" size={18} color={colors.primary} />} onPress={() => void openMaps(branchItem.googleMapsUrl!)}>{t("branch.openGoogleMaps")}</Button>}
            </View>;
          })}
        </View>;
      })}
      </View>}

      {step === 1 && !isTransfer && tenant && branch && <View style={styles.section}>
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
          <TextField
            label={t("parentEnrollment.firstNameLabel")}
            required
            error={errors.firstName ? t("parentEnrollment.firstNameRequired") : undefined}
            autoCapitalize="words"
            maxLength={100}
            placeholder={t("children.firstName")}
            value={child.firstName}
            onChangeText={(value) => updateChild(index, { firstName: capitalizeWords(value) })}
          />
          <TextField
            label={t("parentEnrollment.lastNameLabel")}
            autoCapitalize="words"
            maxLength={100}
            placeholder={t("children.lastName")}
            value={child.lastName ?? ""}
            onChangeText={(value) => updateChild(index, { lastName: capitalizeWords(value) })}
          />
          <View style={styles.field}>
            <GenderPicker value={child.gender} onChange={(gender) => updateChild(index, { gender })} />
            {errors.gender && <FieldError message={t("parentEnrollment.genderRequired")} />}
          </View>
          <View style={styles.field}>
            <AppText variant="label">{t("parentEnrollment.birthDateLabel")}</AppText>
            <DatePicker
              placeholder={t("children.birthDate")}
              value={child.dateOfBirth}
              onChange={(dateOfBirth) => updateChild(index, { dateOfBirth })}
              maximumDate={today}
            />
            {errors.dateOfBirth && <FieldError message={t(errors.dateOfBirth === "REQUIRED" ? "parentEnrollment.birthDateRequired" : "parentEnrollment.birthDateInvalid")} />}
          </View>
        </View>;
      })}
      {children.length < MAX_ENROLLMENT_CHILDREN
        ? <Button variant="secondary" leadingIcon={<Ionicons name="person-add-outline" size={18} color={colors.primary} />} onPress={() => setChildren((current) => [...current, emptyEnrollmentChild()])}>{t("parentEnrollment.addChild")}</Button>
        : <AppText variant="caption" tone="muted">{t("parentEnrollment.maxChildren", { count: MAX_ENROLLMENT_CHILDREN })}</AppText>}
      <View style={styles.actions}>
        <Button style={styles.actionButton} variant="secondary" onPress={goBack}>{t("common.back")}</Button>
        <Button style={styles.actionButton} onPress={continueToPlan}>{t("tenant.next")}</Button>
      </View>
      </View>}

      {step === planStep && tenant && branch && <View style={styles.section}>
      {isTransfer && <SelectedBranchSummary organizationName={tenant.organizationName} branchName={branch.name} address={branch.fullAddress} />}
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
        <InfoRow icon="business-outline" label={t("parentEnrollment.reviewInstitution")} value={tenant.organizationName} />
        <InfoRow icon="location-outline" label={t("parentEnrollment.reviewBranch")} value={branch.name} />
        {isTransfer
          ? <InfoRow icon="happy-outline" label={t("parentEnrollment.reviewChild")} value={transferChildName ?? ""} />
          : <View style={styles.reviewGroup}>
            <AppText variant="caption" tone="muted">{t("parentEnrollment.childrenCount", { count: children.length })}</AppText>
            {children.map((child, index) => <AppText key={`${child.firstName}-${index}`} variant="label">{index + 1}. {child.firstName.trim()} {child.lastName?.trim()}</AppText>)}
          </View>}
        <InfoRow icon="pricetags-outline" label={t("parentEnrollment.reviewPlan")} value={`${plan.name} · ${formatCurrency(plan.price)}`} />
        <Banner tone="info" title={t("parentEnrollment.pendingApprovalTitle")} message={t(isTransfer ? "parentEnrollment.transferPendingApprovalNotice" : "parentEnrollment.pendingApprovalNotice")} />
      </View>}

      {error && <Banner tone="danger" title={t("parentEnrollment.failed")} message={error !== t("parentEnrollment.failed") ? error : undefined} />}
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

function FieldError({ message }: { message: string }) {
  return <View style={styles.fieldError}><Ionicons name="alert-circle" size={14} color={colors.danger} /><AppText variant="caption" tone="danger">{message}</AppText></View>;
}

const styles = StyleSheet.create({
  hero: { gap: spacing.xs },
  section: { gap: spacing.md },
  sectionHeading: { gap: spacing.xs },
  field: { gap: spacing.xs },
  fieldError: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  chooseRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  tenantGroup: { gap: spacing.sm },
  tenantHeading: { gap: spacing.xs, paddingHorizontal: spacing.xs },
  branchCard: { overflow: "hidden", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cardTap: { gap: spacing.xs, padding: spacing.md },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  grow: { flex: 1 },
  chooseLabel: { color: colors.primary },
  selectedCard: { borderColor: colors.primary, backgroundColor: colors.surfaceTint },
  pressed: { opacity: 0.76 },
  selectionSummary: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.accentSoft },
  childCard: { gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  planList: { gap: spacing.sm },
  planCard: { gap: spacing.xs, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  radio: { width: 22, height: 22, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.muted, borderRadius: radius.pill },
  radioSelected: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.primary },
  reviewCard: { gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  reviewGroup: { gap: spacing.xs },
  actions: { flexDirection: "row", gap: spacing.sm },
  actionButton: { flex: 1 },
});
