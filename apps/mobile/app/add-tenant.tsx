import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, Button, ShimmerList, colors, PasswordInput, radius, spacing } from "@daycare/ui";
import { isApiNetworkError, type InstitutionTypeDefinition } from "@daycare/api-client";
import { tenantSubscriptionPlans, type TenantSubscriptionPlan } from "@daycare/core";
import { useAuth } from "@/auth/AuthProvider";
import { AppScreen } from "@/navigation/AppScreen";
import { useI18n } from "@/i18n/I18nProvider";
import { tenantSubscriptionPlanKey } from "@/i18n/translations";
import { notify } from "@/notify/notify";

const trialMonths = Array.from({ length: 12 }, (_, index) => index + 1);

export default function AddTenantScreen() {
  const router = useRouter();
  const { api, profile } = useAuth();
  const { t, formatCurrency } = useI18n();
  const queryClient = useQueryClient();
  const institutionTypes = useQuery({ queryKey: ["platform-institution-types"], queryFn: () => api.institutionTypes(), enabled: Boolean(profile?.isPlatformAdmin) });
  const createTenant = useMutation({ mutationFn: api.createTenant.bind(api), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform-tenants"] }) });
  const checkoutSteps = [t("tenant.stepData"), t("tenant.stepTrial"), t("tenant.stepCheckout")];
  const [step, setStep] = useState(0);
  const [tenantName, setTenantName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [staffAdminName, setStaffAdminName] = useState("");
  const [staffAdminUsername, setStaffAdminUsername] = useState("");
  const [staffAdminEmail, setStaffAdminEmail] = useState("");
  const [staffAdminPassword, setStaffAdminPassword] = useState("");
  const [selectedInstitutionTypes, setSelectedInstitutionTypes] = useState<string[]>([]);
  const [plan, setPlan] = useState<TenantSubscriptionPlan>("STARTER");
  const [monthlyFee, setMonthlyFee] = useState("");
  const [hasTrial, setHasTrial] = useState(true);
  const [trialMonthsCount, setTrialMonthsCount] = useState(1);

  if (!profile) return null;
  if (!profile.isPlatformAdmin) return <Redirect href="/home" />;

  const toggleInstitutionType = (type: InstitutionTypeDefinition) => {
    setSelectedInstitutionTypes((current) => current.includes(type.code) ? current.filter((item) => item !== type.code) : [...current, type.code]);
  };
  const next = () => {
    if (step === 0 && (!tenantName.trim() || !branchName.trim() || !staffAdminName.trim() || !staffAdminEmail.trim() || staffAdminPassword.length < 6 || selectedInstitutionTypes.length === 0)) return notify(t("tenant.dataRequired"));
    if (step === 1 && !hasTrial && (!Number.isFinite(Number(monthlyFee)) || Number(monthlyFee) <= 0)) return notify(t("tenant.feeRequired"));
    setStep((current) => current + 1);
  };
  const checkout = async () => {
    try {
      await createTenant.mutateAsync({ tenantName: tenantName.trim(), branchName: branchName.trim(), institutionTypes: selectedInstitutionTypes, subscriptionPlan: plan, ...(hasTrial ? { trialMonths: trialMonthsCount } : { monthlyFee: Number(monthlyFee) }), staffAdminName: staffAdminName.trim(), ...(staffAdminUsername.trim() ? { staffAdminUsername: staffAdminUsername.trim() } : {}), staffAdminEmail: staffAdminEmail.trim(), staffAdminPassword });
      notify(t("tenant.checkoutSuccess"), hasTrial ? t("tenant.checkoutTrial", { count: trialMonthsCount }) : t("tenant.checkoutPayment"));
      router.replace("/platform-tenants");
    } catch (error) {
      if (isApiNetworkError(error)) {
        notify(t("tenant.apiUnavailableTitle"), t("tenant.apiUnavailableMessage"));
        return;
      }
      notify(t("tenant.checkoutFailed"), error instanceof Error ? error.message : t("auth.tryAgain"));
    }
  };

  return <AppScreen showBottomNavigation={false} title={t("tenant.addTitle")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <View style={styles.steps}>{checkoutSteps.map((label, index) => <AppText key={label} variant="caption" style={index === step ? styles.activeStep : styles.step}>{`${index + 1}. ${label}`}</AppText>)}</View>
    {step === 0 && <View style={styles.form}>
      <AppText variant="heading">{t("tenant.stepData")}</AppText>
      <TextInput style={styles.input} placeholder={t("tenant.name")} value={tenantName} onChangeText={setTenantName} />
      <TextInput style={styles.input} placeholder={t("tenant.branch")} value={branchName} onChangeText={setBranchName} />
      <AppText variant="label">{t("tenant.institutionTypes")}</AppText>
      {institutionTypes.isLoading && <ShimmerList variant="tile" />}
      {!institutionTypes.isLoading && <View style={styles.options}>{institutionTypes.data?.map((type) => <Button key={type.code} variant={selectedInstitutionTypes.includes(type.code) ? "primary" : "secondary"} onPress={() => toggleInstitutionType(type)}>{type.name}</Button>)}</View>}
      {institutionTypes.isError && <Button variant="secondary" onPress={() => institutionTypes.refetch()}>{t("institutionCatalog.reload")}</Button>}
      <TextInput style={styles.input} placeholder={t("tenant.staffAdminName")} value={staffAdminName} onChangeText={setStaffAdminName} />
      <TextInput style={styles.input} autoCapitalize="none" placeholder={t("tenant.staffAdminUsernameOptional")} value={staffAdminUsername} onChangeText={setStaffAdminUsername} />
      <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder={t("tenant.staffAdminEmail")} value={staffAdminEmail} onChangeText={setStaffAdminEmail} />
      <PasswordInput placeholder={t("tenant.staffAdminPassword")} value={staffAdminPassword} onChangeText={setStaffAdminPassword} accessibilityLabel={t("password.accessibility")} showLabel={t("password.show")} hideLabel={t("password.hide")} showAccessibilityLabel={t("password.showAccessibility")} hideAccessibilityLabel={t("password.hideAccessibility")} />
    </View>}
    {step === 1 && <View style={styles.form}>
      <AppText variant="heading">{t("tenant.planTrial")}</AppText>
      <View style={styles.options}>{tenantSubscriptionPlans.map((item) => <Button key={item} variant={item === plan ? "primary" : "secondary"} onPress={() => setPlan(item)}>{t(tenantSubscriptionPlanKey(item))}</Button>)}</View>
      <AppText variant="label">{t("tenant.freeTrial")}</AppText>
      <View style={styles.options}>
        <Button variant={hasTrial ? "primary" : "secondary"} onPress={() => { setHasTrial(true); setMonthlyFee(""); }}>{t("tenant.useTrial")}</Button>
        <Button variant={!hasTrial ? "primary" : "secondary"} onPress={() => setHasTrial(false)}>{t("tenant.noTrial")}</Button>
      </View>
      {hasTrial && <View style={styles.options}>{trialMonths.map((month) => <Button key={month} variant={month === trialMonthsCount ? "primary" : "secondary"} onPress={() => setTrialMonthsCount(month)}>{t("tenant.monthShort", { count: month })}</Button>)}</View>}
      <TextInput editable={!hasTrial} style={[styles.input, hasTrial && styles.disabledInput]} keyboardType="numeric" placeholder={hasTrial ? t("tenant.monthlyFeeDisabled") : t("tenant.monthlyFee")} value={monthlyFee} onChangeText={setMonthlyFee} />
    </View>}
    {step === 2 && <View style={styles.form}>
      <AppText variant="heading">{t("tenant.stepCheckout")}</AppText>
      <AppText>{tenantName}</AppText>
      <AppText tone="muted">{branchName} · {staffAdminName}{staffAdminUsername.trim() ? ` · ${staffAdminUsername.trim()}` : ""} · {staffAdminEmail}</AppText>
      <AppText>{selectedInstitutionTypes.map((type) => institutionTypes.data?.find((item) => item.code === type)?.name ?? type).join(" + ")}</AppText>
      <AppText>{t(tenantSubscriptionPlanKey(plan))}</AppText>
      {hasTrial ? <><AppText>{t("tenant.checkoutTrial", { count: trialMonthsCount })}</AppText><AppText variant="caption" tone="muted">{t("tenant.accountTrial")}</AppText></> : <><AppText>{formatCurrency(Number(monthlyFee))}</AppText><AppText variant="caption" tone="muted">{t("tenant.accountPayment")}</AppText></>}
    </View>}
    <View style={styles.actions}>
      {step > 0 && <Button variant="secondary" onPress={() => setStep((current) => current - 1)}>{t("common.back")}</Button>}
      {step < checkoutSteps.length - 1 ? <Button onPress={next}>{t("tenant.next")}</Button> : <Button loading={createTenant.isPending} onPress={() => void checkout()}>{t("tenant.stepCheckout")}</Button>}
    </View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  steps: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  step: { color: colors.muted },
  activeStep: { color: colors.primary, fontWeight: "700" },
  form: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  disabledInput: { backgroundColor: colors.disabled },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
