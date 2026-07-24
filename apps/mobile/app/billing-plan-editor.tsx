import { useEffect, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, Button, colors, radius, spacing } from "@daycare/ui";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { servicePlanTypeKey } from "@/i18n/translations";
import type { ServicePlanTemplate } from "@daycare/api-client";
import type { ServicePlanType, UnusedCreditPolicy } from "@daycare/core";

const planTypes: ServicePlanType[] = ["DAILY", "WEEKLY", "MONTHLY"];
type PlanFields = { name: string; price: string; type: ServicePlanType; credits: string; policy: UnusedCreditPolicy; carryDays: string; capacity: string };
const emptyPlanFields = (): PlanFields => ({ name: "", price: "", type: "DAILY", credits: "1", policy: "EXPIRE", carryDays: "30", capacity: "" });

export default function BillingPlanEditorScreen() {
  const router = useRouter();
  const { mode, templateId } = useLocalSearchParams<{ mode?: string; templateId?: string }>();
  const { api, profile, organizationId } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const isTemplateEditor = mode === "template";
  const templates = useQuery({ queryKey: ["service-plan-templates", organizationId], queryFn: () => api.servicePlanTemplates(), enabled: membership?.role === "STAFF_ADMIN" });
  const selectedTemplate = typeof templateId === "string" ? templates.data?.find((item) => item.id === templateId) : undefined;
  const [fields, setFields] = useState<PlanFields>(emptyPlanFields());

  useEffect(() => { if (selectedTemplate) setFields(templateToFields(selectedTemplate)); }, [selectedTemplate]);

  const createPlan = useMutation({ mutationFn: api.createServicePlan.bind(api), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["service-plans", organizationId] }); router.back(); } });
  const createTemplate = useMutation({ mutationFn: api.createServicePlanTemplate.bind(api), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["service-plan-templates", organizationId] }); router.back(); } });
  const updateTemplate = useMutation({ mutationFn: ({ id, input }: { id: string; input: Parameters<typeof api.updateServicePlanTemplate>[1] }) => api.updateServicePlanTemplate(id, input), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["service-plan-templates", organizationId] }); router.back(); } });

  if (!profile) return null;
  if (membership?.role !== "STAFF_ADMIN" || !membership.active) return <Redirect href="/home" />;
  if (isTemplateEditor && typeof templateId === "string" && templates.isSuccess && !selectedTemplate) return <Redirect href="/billing-admin" />;

  const update = (patch: Partial<PlanFields>) => setFields((current) => ({ ...current, ...patch }));
  const save = async () => {
    const input = toPlanInput(fields);
    if (!input || (!isTemplateEditor && input.price === undefined)) return Alert.alert(t("billing.invalid"));
    try {
      if (isTemplateEditor) {
        const { price: suggestedPrice, ...templateInput } = input;
        if (typeof templateId === "string") await updateTemplate.mutateAsync({ id: templateId, input: { ...templateInput, suggestedPrice } });
        else await createTemplate.mutateAsync({ ...templateInput, suggestedPrice });
      } else {
        await createPlan.mutateAsync({ ...input, price: input.price! });
      }
    } catch (error) {
      Alert.alert(isTemplateEditor ? t("billing.templateFailed") : t("billing.failed"), error instanceof Error ? error.message : t("auth.tryAgain"));
    }
  };
  const title = isTemplateEditor ? t(typeof templateId === "string" ? "billing.editTemplate" : "billing.createTemplate") : t("billing.createPlan");

  return <AppScreen showBottomNavigation={false} title={title} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <TextInput style={styles.input} placeholder={t("billing.planName")} value={fields.name} onChangeText={(name) => update({ name })} />
    <View style={styles.options}>{planTypes.map((type) => <Button key={type} variant={type === fields.type ? "primary" : "secondary"} onPress={() => update({ type, credits: type === "DAILY" ? "1" : fields.credits })}>{t(servicePlanTypeKey(type))}</Button>)}</View>
    <TextInput style={styles.input} placeholder={t(isTemplateEditor ? "billing.suggestedPrice" : "billing.price")} keyboardType="numeric" value={fields.price} onChangeText={(price) => update({ price })} />
    <TextInput style={styles.input} placeholder={t("billing.dailyCapacity")} keyboardType="numeric" value={fields.capacity} onChangeText={(capacity) => update({ capacity })} />
    {fields.type !== "MONTHLY" && <TextInput style={styles.input} placeholder={t("billing.days")} keyboardType="numeric" value={fields.credits} onChangeText={(credits) => update({ credits })} />}
    {fields.type === "WEEKLY" && <><View style={styles.options}><Button variant={fields.policy === "EXPIRE" ? "primary" : "secondary"} onPress={() => update({ policy: "EXPIRE" })}>{t("billing.expire")}</Button><Button variant={fields.policy === "CARRY_FORWARD" ? "primary" : "secondary"} onPress={() => update({ policy: "CARRY_FORWARD" })}>{t("billing.carry")}</Button></View>{fields.policy === "CARRY_FORWARD" && <TextInput style={styles.input} placeholder={t("billing.carryForwardDays")} keyboardType="numeric" value={fields.carryDays} onChangeText={(carryDays) => update({ carryDays })} />}</>}
    <Button loading={createPlan.isPending || createTemplate.isPending || updateTemplate.isPending} onPress={() => void save()}>{t(isTemplateEditor ? "common.save" : "billing.savePlan")}</Button>
  </AppScreen>;
}

function templateToFields(template: ServicePlanTemplate): PlanFields {
  return { name: template.name, type: template.type, price: template.suggestedPrice?.toString() ?? "", credits: template.creditCount?.toString() ?? (template.type === "DAILY" ? "1" : ""), policy: template.unusedCreditPolicy ?? "EXPIRE", carryDays: template.carryForwardDays?.toString() ?? "30", capacity: template.dailyCapacity?.toString() ?? "" };
}

function toPlanInput(fields: PlanFields) {
  const price = fields.price.trim() ? Number(fields.price) : undefined;
  const creditCount = fields.type === "MONTHLY" ? undefined : Number(fields.credits);
  const dailyCapacity = fields.capacity.trim() ? Number(fields.capacity) : undefined;
  const carryForwardDays = fields.type === "WEEKLY" && fields.policy === "CARRY_FORWARD" ? Number(fields.carryDays) : undefined;
  if (!fields.name.trim() || (price !== undefined && (!Number.isFinite(price) || price <= 0)) || (creditCount !== undefined && (!Number.isInteger(creditCount) || creditCount < 1)) || (dailyCapacity !== undefined && (!Number.isInteger(dailyCapacity) || dailyCapacity < 1)) || (carryForwardDays !== undefined && (!Number.isInteger(carryForwardDays) || carryForwardDays < 1))) return undefined;
  return { name: fields.name.trim(), type: fields.type, price, creditCount, unusedCreditPolicy: fields.type === "WEEKLY" ? fields.policy : undefined, carryForwardDays, bookingRequiresApproval: true, dailyCapacity };
}

const styles = StyleSheet.create({ input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.surface }, options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm } });
