import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AppText,
  BackButton,
  Button,
  MultiStepFormWizard,
  PasswordInput,
  ShimmerList,
  colors,
  radius,
  spacing,
  type MultiStepFormWizardStep,
} from "@daycare/ui";
import { isApiNetworkError, type InstitutionTypeDefinition } from "@daycare/api-client";
import { tenantSubscriptionPlans } from "@daycare/core";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useI18n } from "@/i18n/I18nProvider";
import { tenantSubscriptionPlanKey } from "@/i18n/translations";
import { notify } from "@/notify/notify";
import { capitalizeWords } from "@/text/capitalizeWords";
import {
  tenantCreationPayload,
  tenantCreationReview,
  tenantDetailsErrors,
  tenantStaffAdminErrors,
  tenantSubscriptionErrors,
  type TenantCreationDraft,
} from "@/tenant-creation/form";

const trialMonthOptions = Array.from({ length: 12 }, (_, index) => index + 1);
type TenantCreationStep = 0 | 1 | 2 | 3;

const initialDraft: TenantCreationDraft = {
  tenantName: "",
  branchName: "",
  institutionTypes: [],
  staffAdminName: "",
  staffAdminUsername: "",
  staffAdminEmail: "",
  staffAdminPassword: "",
  subscriptionPlan: "STARTER",
  hasTrial: true,
  trialMonths: 1,
  monthlyFee: "",
};

export default function AddTenantScreen() {
  const router = useRouter();
  const { api, profile } = useAuth();
  const { t, formatCurrency } = useI18n();
  const queryClient = useQueryClient();
  const institutionTypes = useQuery({ queryKey: ["platform-institution-types"], queryFn: () => api.institutionTypes(), enabled: Boolean(profile?.isPlatformAdmin) });
  const createTenant = useMutation({ mutationFn: api.createTenant.bind(api), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform-tenants"] }) });
  const [step, setStep] = useState<TenantCreationStep>(0);
  const [draft, setDraft] = useState<TenantCreationDraft>(initialDraft);
  const [showInstitutionErrors, setShowInstitutionErrors] = useState(false);
  const [showAdminErrors, setShowAdminErrors] = useState(false);
  const [showSubscriptionErrors, setShowSubscriptionErrors] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  if (!profile) return null;
  if (!profile.isPlatformAdmin) return <Redirect href="/home" />;

  const wizardSteps: MultiStepFormWizardStep[] = [
    { id: "institution", label: t("tenantCreation.stepInstitution") },
    { id: "admin", label: t("tenantCreation.stepAdmin") },
    { id: "subscription", label: t("tenantCreation.stepSubscription") },
    { id: "review", label: t("tenantCreation.stepReview") },
  ];
  const institutionErrors = tenantDetailsErrors(draft);
  const adminErrors = tenantStaffAdminErrors(draft);
  const subscriptionErrors = tenantSubscriptionErrors(draft);
  const review = tenantCreationReview(draft);
  const selectedTypeNames = review.institutionTypes.map((code) => institutionTypes.data?.find((item) => item.code === code)?.name ?? code);

  const updateDraft = <Key extends keyof TenantCreationDraft>(key: Key, value: TenantCreationDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setSubmitError(undefined);
  };
  const toggleInstitutionType = (type: InstitutionTypeDefinition) => {
    updateDraft("institutionTypes", draft.institutionTypes.includes(type.code)
      ? draft.institutionTypes.filter((item) => item !== type.code)
      : [...draft.institutionTypes, type.code]);
  };
  const goBack = () => {
    setSubmitError(undefined);
    if (step === 0) router.back();
    else setStep((current) => (current - 1) as TenantCreationStep);
  };
  const next = () => {
    setSubmitError(undefined);
    if (step === 0) {
      setShowInstitutionErrors(true);
      if (institutionTypes.isLoading || institutionTypes.isError || Object.keys(institutionErrors).length > 0) return;
      setStep(1);
      return;
    }
    if (step === 1) {
      setShowAdminErrors(true);
      if (Object.keys(adminErrors).length > 0) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      setShowSubscriptionErrors(true);
      if (Object.keys(subscriptionErrors).length > 0) return;
      setStep(3);
    }
  };
  const checkout = async () => {
    const detailValidation = tenantDetailsErrors(draft);
    const adminValidation = tenantStaffAdminErrors(draft);
    const subscriptionValidation = tenantSubscriptionErrors(draft);
    if (Object.keys(detailValidation).length > 0) { setShowInstitutionErrors(true); setStep(0); return; }
    if (Object.keys(adminValidation).length > 0) { setShowAdminErrors(true); setStep(1); return; }
    if (Object.keys(subscriptionValidation).length > 0) { setShowSubscriptionErrors(true); setStep(2); return; }
    setSubmitError(undefined);
    try {
      await createTenant.mutateAsync(tenantCreationPayload(draft));
      notify(t("tenant.checkoutSuccess"), draft.hasTrial ? t("tenant.checkoutTrial", { count: draft.trialMonths }) : t("tenant.checkoutPayment"));
      router.replace("/platform-tenants");
    } catch (error) {
      setSubmitError(isApiNetworkError(error)
        ? t("tenant.apiUnavailableMessage")
        : error instanceof Error ? error.message : t("auth.tryAgain"));
    }
  };

  return <AppScreen
    showBottomNavigation={false}
    title={t("tenant.addTitle")}
    header={<BackButton accessibilityLabel={t("common.back")} onPress={goBack} />}
  >
    <MultiStepFormWizard
      steps={wizardSteps}
      currentStep={step}
      accessibilityLabel={t("tenantCreation.stepProgress", { current: step + 1, total: wizardSteps.length })}
      progressLabel={t("tenantCreation.stepProgress", { current: step + 1, total: wizardSteps.length })}
    >
      {step === 0 && <View style={styles.section}>
        <SectionHeading title={t("tenantCreation.stepInstitution")} description={t("tenantCreation.institutionDescription")} />
        <View style={styles.field}>
          <AppText variant="label">{t("tenant.name")}</AppText>
          <TextInput
            accessibilityLabel={t("tenant.name")}
            style={[styles.input, showInstitutionErrors && institutionErrors.tenantName && styles.inputError]}
            autoCapitalize="words"
            maxLength={200}
            placeholder={t("tenant.name")}
            value={draft.tenantName}
            onChangeText={(value) => updateDraft("tenantName", capitalizeWords(value))}
          />
          {showInstitutionErrors && institutionErrors.tenantName && <FieldError>{t("tenantCreation.tenantNameRequired")}</FieldError>}
        </View>
        <View style={styles.field}>
          <AppText variant="label">{t("tenant.branch")}</AppText>
          <TextInput
            accessibilityLabel={t("tenant.branch")}
            style={[styles.input, showInstitutionErrors && institutionErrors.branchName && styles.inputError]}
            autoCapitalize="words"
            maxLength={200}
            placeholder={t("tenant.branch")}
            value={draft.branchName}
            onChangeText={(value) => updateDraft("branchName", capitalizeWords(value))}
          />
          {showInstitutionErrors && institutionErrors.branchName && <FieldError>{t("tenantCreation.branchRequired")}</FieldError>}
        </View>
        <View style={styles.field}>
          <AppText variant="label">{t("tenant.institutionTypes")}</AppText>
          <AppText variant="caption" tone="muted">{t("tenant.institutionTypesInfo")}</AppText>
          {institutionTypes.isLoading && <ShimmerList variant="tile" />}
          {institutionTypes.isError && <View accessibilityRole="alert" style={styles.errorCard}>
            <AppText tone="danger">{t("tenantCreation.catalogLoadFailed")}</AppText>
            <Button variant="secondary" onPress={() => void institutionTypes.refetch()}>{t("common.retry")}</Button>
          </View>}
          {!institutionTypes.isLoading && !institutionTypes.isError && <View style={styles.options}>
            {institutionTypes.data?.map((type) => <Button
              key={type.code}
              accessibilityLabel={type.name}
              variant={draft.institutionTypes.includes(type.code) ? "primary" : "secondary"}
              onPress={() => toggleInstitutionType(type)}
            >{type.name}</Button>)}
          </View>}
          {showInstitutionErrors && institutionErrors.institutionTypes && <FieldError>{t("tenantCreation.institutionTypeRequired")}</FieldError>}
        </View>
      </View>}

      {step === 1 && <View style={styles.section}>
        <SectionHeading title={t("tenantCreation.stepAdmin")} description={t("tenantCreation.adminDescription")} />
        <View style={styles.field}>
          <AppText variant="label">{t("tenant.staffAdminName")}</AppText>
          <TextInput
            accessibilityLabel={t("tenant.staffAdminName")}
            style={[styles.input, showAdminErrors && adminErrors.name && styles.inputError]}
            autoCapitalize="words"
            maxLength={100}
            placeholder={t("tenant.staffAdminName")}
            value={draft.staffAdminName}
            onChangeText={(value) => updateDraft("staffAdminName", capitalizeWords(value))}
          />
          {showAdminErrors && adminErrors.name && <FieldError>{t(adminErrors.name === "REQUIRED" ? "tenantCreation.adminNameRequired" : "tenantCreation.adminNameInvalid")}</FieldError>}
        </View>
        <View style={styles.field}>
          <AppText variant="label">{t("tenant.staffAdminUsernameOptional")}</AppText>
          <TextInput
            accessibilityLabel={t("tenant.staffAdminUsernameOptional")}
            style={[styles.input, showAdminErrors && adminErrors.username && styles.inputError]}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={100}
            placeholder={t("tenant.staffAdminUsernameOptional")}
            value={draft.staffAdminUsername}
            onChangeText={(value) => updateDraft("staffAdminUsername", value)}
          />
          {showAdminErrors && adminErrors.username && <FieldError>{t("tenantCreation.usernameInvalid")}</FieldError>}
        </View>
        <View style={styles.field}>
          <AppText variant="label">{t("tenant.staffAdminEmail")}</AppText>
          <TextInput
            accessibilityLabel={t("tenant.staffAdminEmail")}
            style={[styles.input, showAdminErrors && adminErrors.email && styles.inputError]}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder={t("tenant.staffAdminEmail")}
            value={draft.staffAdminEmail}
            onChangeText={(value) => updateDraft("staffAdminEmail", value)}
          />
          {showAdminErrors && adminErrors.email && <FieldError>{t(adminErrors.email === "REQUIRED" ? "tenantCreation.emailRequired" : "tenantCreation.emailInvalid")}</FieldError>}
        </View>
        <View style={styles.field}>
          <AppText variant="label">{t("tenant.staffAdminPassword")}</AppText>
          <PasswordInput
            containerStyle={showAdminErrors && adminErrors.password ? styles.inputError : undefined}
            maxLength={128}
            placeholder={t("tenant.staffAdminPassword")}
            value={draft.staffAdminPassword}
            onChangeText={(value) => updateDraft("staffAdminPassword", value)}
            accessibilityLabel={t("password.accessibility")}
            showLabel={t("password.show")}
            hideLabel={t("password.hide")}
            showAccessibilityLabel={t("password.showAccessibility")}
            hideAccessibilityLabel={t("password.hideAccessibility")}
          />
          {showAdminErrors && adminErrors.password && <FieldError>{t("tenantCreation.passwordInvalid")}</FieldError>}
        </View>
      </View>}

      {step === 2 && <View style={styles.section}>
        <SectionHeading title={t("tenant.planTrial")} description={t("tenantCreation.subscriptionDescription")} />
        <View style={styles.field}>
          <AppText variant="label">{t("tenantCreation.reviewPlan")}</AppText>
          <View style={styles.options}>{tenantSubscriptionPlans.map((item) => <Button
            key={item}
            variant={item === draft.subscriptionPlan ? "primary" : "secondary"}
            onPress={() => updateDraft("subscriptionPlan", item)}
          >{t(tenantSubscriptionPlanKey(item))}</Button>)}</View>
        </View>
        <View style={styles.field}>
          <AppText variant="label">{t("tenant.freeTrial")}</AppText>
          <View style={styles.options}>
            <Button variant={draft.hasTrial ? "primary" : "secondary"} onPress={() => { updateDraft("hasTrial", true); updateDraft("monthlyFee", ""); }}>{t("tenant.useTrial")}</Button>
            <Button variant={!draft.hasTrial ? "primary" : "secondary"} onPress={() => updateDraft("hasTrial", false)}>{t("tenant.noTrial")}</Button>
          </View>
        </View>
        {draft.hasTrial && <View style={styles.field}>
          <AppText variant="label">{t("tenant.stepTrial")}</AppText>
          <View style={styles.options}>{trialMonthOptions.map((month) => <Button
            key={month}
            variant={month === draft.trialMonths ? "primary" : "secondary"}
            onPress={() => updateDraft("trialMonths", month)}
          >{t("tenant.monthShort", { count: month })}</Button>)}</View>
        </View>}
        {!draft.hasTrial && <View style={styles.field}>
          <AppText variant="label">{t("tenant.monthlyFee")}</AppText>
          <TextInput
            accessibilityLabel={t("tenant.monthlyFee")}
            style={[styles.input, showSubscriptionErrors && subscriptionErrors.monthlyFee && styles.inputError]}
            keyboardType="numeric"
            placeholder={t("tenant.monthlyFee")}
            value={draft.monthlyFee}
            onChangeText={(value) => updateDraft("monthlyFee", value)}
          />
          {showSubscriptionErrors && subscriptionErrors.monthlyFee && <FieldError>{t("tenant.feeRequired")}</FieldError>}
        </View>}
      </View>}

      {step === 3 && <View style={styles.section}>
        <SectionHeading title={t("tenantCreation.stepReview")} description={t("tenantCreation.reviewDescription")} />
        <View style={styles.reviewCard}>
          <ReviewRow label={t("tenantCreation.reviewInstitution")} value={review.tenantName} />
          <ReviewRow label={t("tenantCreation.reviewBranch")} value={review.branchName} />
          <ReviewRow label={t("tenantCreation.reviewTypes")} value={selectedTypeNames.join(" + ")} />
          <ReviewRow label={t("tenantCreation.reviewAdmin")} value={[review.staffAdminName, review.staffAdminUsername, review.staffAdminEmail].filter(Boolean).join(" · ")} />
          <ReviewRow label={t("tenantCreation.reviewPlan")} value={t(tenantSubscriptionPlanKey(review.subscriptionPlan))} />
          <ReviewRow
            label={t("tenantCreation.reviewBilling")}
            value={review.trialMonths != null ? t("tenant.checkoutTrial", { count: review.trialMonths }) : formatCurrency(review.monthlyFee ?? 0)}
            last
          />
        </View>
        <View style={styles.noticeCard}>
          <AppText variant="label">{draft.hasTrial ? t("tenant.accountTrial") : t("tenant.accountPayment")}</AppText>
        </View>
        {submitError && <View accessibilityRole="alert" style={styles.errorCard}>
          <AppText tone="danger">{t("tenant.checkoutFailed")}</AppText>
          <AppText tone="danger">{submitError}</AppText>
        </View>}
      </View>}

      <View style={styles.actions}>
        {step > 0 && <Button style={styles.actionButton} variant="secondary" onPress={goBack}>{t("common.back")}</Button>}
        {step < wizardSteps.length - 1
          ? <Button style={styles.actionButton} disabled={step === 0 && (institutionTypes.isLoading || institutionTypes.isError)} onPress={next}>{t("tenant.next")}</Button>
          : <Button style={styles.actionButton} loading={createTenant.isPending} onPress={() => void checkout()}>{t("tenantCreation.create")}</Button>}
      </View>
    </MultiStepFormWizard>
  </AppScreen>;
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return <View style={styles.sectionHeading}>
    <AppText variant="heading">{title}</AppText>
    <AppText tone="muted">{description}</AppText>
  </View>;
}

function FieldError({ children }: { children: string }) {
  return <AppText variant="caption" tone="danger">{children}</AppText>;
}

function ReviewRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return <View style={[styles.reviewRow, last && styles.reviewRowLast]}>
    <AppText variant="caption" tone="muted">{label}</AppText>
    <AppText variant="label">{value}</AppText>
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  sectionHeading: { gap: spacing.xs },
  field: { gap: spacing.xs },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text },
  inputError: { borderColor: colors.danger },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  errorCard: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, backgroundColor: colors.dangerSoft },
  reviewCard: { padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  reviewRow: { gap: spacing.xs, paddingBottom: spacing.sm, marginBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  reviewRowLast: { paddingBottom: 0, marginBottom: 0, borderBottomWidth: 0 },
  noticeCard: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.accentSoft },
  actions: { flexDirection: "row", gap: spacing.sm },
  actionButton: { flex: 1 },
});
