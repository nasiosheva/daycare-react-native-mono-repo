import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, Button, colors, radius, spacing } from "@daycare/ui";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { DatePicker } from "@/date-picker/DatePicker";
import type { ServicePlanDiscountKind, ServicePlanDiscountType } from "@daycare/core";

const discountKinds: ServicePlanDiscountKind[] = ["AUTOMATIC", "PROMO_CODE"];
const discountTypes: ServicePlanDiscountType[] = ["PERCENTAGE", "FIXED_AMOUNT"];

export default function BillingDiscountEditorScreen() {
  const router = useRouter();
  const { planId } = useLocalSearchParams<{ planId?: string }>();
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const [discount, setDiscount] = useState({ name: "", kind: "AUTOMATIC" as ServicePlanDiscountKind, promoCode: "", type: "PERCENTAGE" as ServicePlanDiscountType, value: "", startsOn: "", endsOn: "", usageLimit: "" });
  const createDiscount = useMutation({ mutationFn: ({ targetPlanId, input }: { targetPlanId: string; input: Parameters<typeof api.createServicePlanDiscount>[1] }) => api.createServicePlanDiscount(targetPlanId, input), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["service-plan-discounts", organizationId, planId] }); router.back(); } });

  if (!profile) return null;
  if (membership?.role !== "STAFF_ADMIN" || !membership.active || typeof planId !== "string") return <Redirect href="/billing-admin" />;

  const save = async () => {
    const value = Number(discount.value);
    const usageLimit = discount.usageLimit.trim() ? Number(discount.usageLimit) : undefined;
    if (!discount.name.trim() || !Number.isFinite(value) || value <= 0 || (discount.type === "PERCENTAGE" && value >= 100) || (discount.kind === "PROMO_CODE" && !discount.promoCode.trim()) || (usageLimit !== undefined && (!Number.isInteger(usageLimit) || usageLimit < 1))) return Alert.alert(t("billing.invalidDiscount"));
    try { await createDiscount.mutateAsync({ targetPlanId: planId, input: { kind: discount.kind, name: discount.name.trim(), promoCode: discount.kind === "PROMO_CODE" ? discount.promoCode.trim() : undefined, type: discount.type, value, startsOn: discount.startsOn.trim() || undefined, endsOn: discount.endsOn.trim() || undefined, usageLimit: discount.kind === "PROMO_CODE" ? usageLimit : undefined } }); } catch (error) { Alert.alert(t("billing.discountFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };

  return <AppScreen showBottomNavigation={false} title={t("billing.createDiscount")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <TextInput style={styles.input} placeholder={t("billing.discountName")} value={discount.name} onChangeText={(name) => setDiscount((current) => ({ ...current, name }))} />
    <Choice values={discountKinds} value={discount.kind} onChange={(kind) => setDiscount((current) => ({ ...current, kind }))} labels={{ AUTOMATIC: t("billing.automatic"), PROMO_CODE: t("billing.promo") }} />
    {discount.kind === "PROMO_CODE" && <TextInput style={styles.input} autoCapitalize="characters" placeholder={t("billing.promoCode")} value={discount.promoCode} onChangeText={(promoCode) => setDiscount((current) => ({ ...current, promoCode }))} />}
    <Choice values={discountTypes} value={discount.type} onChange={(type) => setDiscount((current) => ({ ...current, type }))} labels={{ PERCENTAGE: t("billing.percentage"), FIXED_AMOUNT: t("billing.fixedAmount") }} />
    <TextInput style={styles.input} placeholder={t("billing.discountValue")} keyboardType="numeric" value={discount.value} onChangeText={(value) => setDiscount((current) => ({ ...current, value }))} />
    <DatePicker placeholder={t("billing.startsOn")} value={discount.startsOn} onChange={(startsOn) => setDiscount((current) => ({ ...current, startsOn }))} maximumDate={discount.endsOn || undefined} onClear={() => setDiscount((current) => ({ ...current, startsOn: "" }))} clearAccessibilityLabel={t("common.clear")} />
    <DatePicker placeholder={t("billing.endsOn")} value={discount.endsOn} onChange={(endsOn) => setDiscount((current) => ({ ...current, endsOn }))} minimumDate={discount.startsOn || undefined} onClear={() => setDiscount((current) => ({ ...current, endsOn: "" }))} clearAccessibilityLabel={t("common.clear")} />
    {discount.kind === "PROMO_CODE" && <TextInput style={styles.input} placeholder={t("billing.usageLimit")} keyboardType="numeric" value={discount.usageLimit} onChangeText={(usageLimit) => setDiscount((current) => ({ ...current, usageLimit }))} />}
    <Button loading={createDiscount.isPending} onPress={() => void save()}>{t("billing.saveDiscount")}</Button>
  </AppScreen>;
}

function Choice<T extends string>({ values, value, onChange, labels }: { values: readonly T[]; value: T; onChange: (value: T) => void; labels: Record<T, string> }) { return <View style={styles.options}>{values.map((item) => <Button key={item} variant={item === value ? "primary" : "secondary"} onPress={() => onChange(item)}>{labels[item]}</Button>)}</View>; }

const styles = StyleSheet.create({ input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.surface }, options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm } });
