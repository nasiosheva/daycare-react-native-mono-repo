import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import type { ChildProgramTemplate, ChildProgramTemplateStepInput } from "@daycare/api-client";
import { AppText, BackButton, BottomSheet, Button, FloatingActionButton, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { notify } from "@/notify/notify";
import { useChildProgramTemplates, useCreateChildProgramTemplate, useUpdateChildProgramTemplate, useRemoveChildProgramTemplate } from "@/children/useChildManagement";

export default function ChildProgramTemplatesScreen() {
  const router = useRouter();
  const { profile, organizationId } = useAuth();
  const { t } = useI18n();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.role === "STAFF_ADMIN" && membership.active;
  const templates = useChildProgramTemplates(canManage);
  const [editingId, setEditingId] = useState<string | null>(null);
  const createTemplate = useCreateChildProgramTemplate();
  const updateTemplate = useUpdateChildProgramTemplate(editingId ?? "");
  const removeTemplate = useRemoveChildProgramTemplate();
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<ChildProgramTemplateStepInput[]>([]);
  const [stepTitle, setStepTitle] = useState("");
  const [stepDescription, setStepDescription] = useState("");
  const [stepHomeGuidance, setStepHomeGuidance] = useState("");

  if (!profile) return null;
  if (!canManage) return <Redirect href="/home" />;

  const close = () => { setVisible(false); setEditingId(null); setName(""); setDescription(""); setSteps([]); clearStepForm(); };
  const clearStepForm = () => { setStepTitle(""); setStepDescription(""); setStepHomeGuidance(""); };
  const openCreate = () => { close(); setVisible(true); };
  const openEdit = (template: ChildProgramTemplate) => {
    setEditingId(template.id);
    setName(template.name);
    setDescription(template.description);
    setSteps(template.steps.map((step) => ({ title: step.title, description: step.description, homeGuidance: step.homeGuidance ?? undefined })));
    setVisible(true);
  };
  const addStep = () => {
    if (!stepTitle.trim()) return;
    setSteps((current) => [...current, { title: stepTitle.trim(), description: stepDescription.trim() || undefined, homeGuidance: stepHomeGuidance.trim() || undefined }]);
    clearStepForm();
  };
  const removeStep = (index: number) => setSteps((current) => current.filter((_, itemIndex) => itemIndex !== index));
  const errorMessage = (error: unknown) => error instanceof Error ? error.message : t("auth.tryAgain");
  const save = async () => {
    if (!name.trim()) return;
    const input = { name: name.trim(), description: description.trim() || undefined, steps };
    try {
      if (editingId) await updateTemplate.mutateAsync(input); else await createTemplate.mutateAsync(input);
      close();
    } catch (error) { notify(t("children.programFailed"), errorMessage(error)); }
  };
  const remove = (templateId: string) => {
    Alert.alert(t("children.removeTemplate"), t("children.removeTemplateConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("children.remove"), style: "destructive", onPress: () => void removeTemplate.mutateAsync(templateId).catch((error: unknown) => notify(t("children.programFailed"), errorMessage(error))) },
    ]);
  };

  return <AppScreen showBottomNavigation={false} title={t("children.programTemplates")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={<FloatingActionButton accessibilityLabel={t("children.addTemplate")} onPress={openCreate}>+ {t("children.addTemplate")}</FloatingActionButton>}>
    <AppText tone="muted">{t("children.programTemplatesSubtitle")}</AppText>
    {templates.isFetching && <ShimmerList variant="row" />}
    {templates.isError && <View style={styles.errorState}><AppText tone="muted">{t("common.error")}</AppText><Button variant="secondary" onPress={() => void templates.refetch()}>{t("common.retry")}</Button></View>}
    {!templates.isFetching && templates.data?.map((template) => <View key={template.id} style={styles.item}>
      <View style={styles.itemContent}>
        <AppText variant="label">{template.name}</AppText>
        {template.description && <AppText tone="muted">{template.description}</AppText>}
        <AppText variant="caption" tone="muted">{t("children.templateStepsSummary", { count: template.steps.length })}</AppText>
      </View>
      <View style={styles.actions}>
        <Button variant="secondary" onPress={() => openEdit(template)}>{t("common.edit")}</Button>
        <Button variant="danger" loading={removeTemplate.isPending} onPress={() => remove(template.id)}>{t("children.remove")}</Button>
      </View>
    </View>)}
    {!templates.isFetching && templates.data?.length === 0 && <AppText tone="muted">{t("children.noTemplates")}</AppText>}

    <BottomSheet visible={visible} onClose={close} closeAccessibilityLabel={t("common.close")} title={t(editingId ? "children.editTemplate" : "children.addTemplate")} negativeAction={{ label: t("common.cancel"), onPress: close }} positiveAction={{ label: t("common.save"), loading: createTemplate.isPending || updateTemplate.isPending, disabled: !name.trim(), onPress: () => void save() }}>
      <TextInput style={styles.input} placeholder={t("children.templateName")} value={name} onChangeText={setName} />
      <TextInput style={[styles.input, styles.multiline]} placeholder={t("children.templateDescription")} value={description} onChangeText={setDescription} multiline />
      <AppText variant="label">{t("children.steps")}</AppText>
      {steps.map((step, index) => <View key={`${step.title}-${index}`} style={styles.stepRow}>
        <View style={styles.itemContent}><AppText variant="label">{step.title}</AppText>{step.description && <AppText variant="bodySmall" tone="muted">{step.description}</AppText>}</View>
        <Button variant="danger" onPress={() => removeStep(index)}>{t("children.remove")}</Button>
      </View>)}
      <TextInput style={styles.input} placeholder={t("children.stepTitle")} value={stepTitle} onChangeText={setStepTitle} />
      <TextInput style={[styles.input, styles.multiline]} placeholder={t("children.stepDescription")} value={stepDescription} onChangeText={setStepDescription} multiline />
      <TextInput style={[styles.input, styles.multiline]} placeholder={t("children.homeGuidance")} value={stepHomeGuidance} onChangeText={setStepHomeGuidance} multiline />
      <Button variant="secondary" disabled={!stepTitle.trim()} onPress={addStep}>{t("children.addTemplateStep")}</Button>
    </BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({
  item: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  itemContent: { flex: 1, gap: spacing.xs },
  actions: { gap: spacing.xs, alignItems: "flex-end" },
  errorState: { gap: spacing.sm, alignItems: "flex-start" },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  multiline: { minHeight: 80, paddingTop: spacing.sm, textAlignVertical: "top" },
  stepRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceTint },
});
