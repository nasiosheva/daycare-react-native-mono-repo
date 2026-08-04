import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ConsentDefinition, ConsentPurpose, CreateConsentDefinitionInput } from "@daycare/api-client";
import { AppText, BackButton, BottomSheet, Button, FloatingActionButton, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { consentPurposeKey } from "@/i18n/translations";
import { hasInstitutionCapability } from "@daycare/core";

const purposes: ConsentPurpose[] = ["MEDIA_MARKETING", "HEALTH_EMERGENCY", "MEDICATION", "OUTING", "PICKUP"];
const emptyDraft: CreateConsentDefinitionInput = { purpose: "MEDIA_MARKETING", title: "", content: "" };

export default function ConsentDefinitionsScreen() {
  const router = useRouter();
  const { api, organizationId, profile } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.role === "STAFF_ADMIN" && hasInstitutionCapability(membership.capabilities, "DAYCARE_OPERATIONS") && membership.active !== false;
  const definitions = useQuery({ queryKey: ["consent-definitions", organizationId, "manage"], queryFn: () => api.managedConsentDefinitions(), enabled: Boolean(canManage) });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ConsentDefinition | null>(null);
  const [draft, setDraft] = useState<CreateConsentDefinitionInput>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const close = () => { setOpen(false); setEditing(null); setDraft(emptyDraft); setError(null); };
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["consent-definitions", organizationId] });
  const save = useMutation({ mutationFn: () => editing ? api.reviseConsentDefinition(editing.id, { title: draft.title, content: draft.content, expectedRevision: editing.revision }) : api.createConsentDefinition(draft), onSuccess: () => { refresh(); close(); }, onError: (value) => setError(value instanceof Error ? value.message : t("consent.definitionFailed")) });
  const setActive = useMutation({ mutationFn: (definition: ConsentDefinition) => api.setConsentDefinitionActive(definition.id, !definition.active, definition.revision), onSuccess: refresh, onError: (value) => setError(value instanceof Error ? value.message : t("consent.definitionFailed")) });
  const openCreate = () => { setEditing(null); setDraft(emptyDraft); setError(null); setOpen(true); };
  const openEdit = (definition: ConsentDefinition) => { setEditing(definition); setDraft({ purpose: definition.purpose, title: definition.title, content: definition.content }); setError(null); setOpen(true); };
  const submit = () => { if (!draft.title.trim() || !draft.content.trim()) { setError(t("consent.definitionFailed")); return; } save.mutate(); };

  if (!profile || !canManage) return <Redirect href="/home" />;
  return <AppScreen showBottomNavigation={false} title={t("consent.staffTitle")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={<FloatingActionButton accessibilityLabel={t("consent.add")} onPress={openCreate}>+ {t("consent.add")}</FloatingActionButton>}><View style={styles.content}>
    <AppText tone="muted">{t("consent.staffDescription")}</AppText>
    {error && <AppText tone="danger">{error}</AppText>}
    {definitions.isFetching && <ShimmerList />}
    {definitions.data?.map((definition) => <View key={definition.id} style={styles.card}><AppText variant="heading">{definition.title}</AppText><AppText variant="caption" tone="muted">{t(consentPurposeKey(definition.purpose))} · {t("consent.revision", { revision: definition.revision })}</AppText><AppText tone="muted">{definition.content}</AppText><AppText variant="label">{definition.active ? t("consent.active") : t("consent.inactive")}</AppText><Button variant="secondary" onPress={() => openEdit(definition)}>{t("consent.edit")}</Button><Button variant={definition.active ? "danger" : "secondary"} loading={setActive.isPending} onPress={() => void setActive.mutateAsync(definition)}>{definition.active ? t("consent.deactivate") : t("consent.activate")}</Button></View>)}
    {!definitions.isFetching && !definitions.data?.length && <AppText tone="muted">{t("consent.manageEmpty")}</AppText>}
  </View><BottomSheet visible={open} onClose={close} closeAccessibilityLabel={t("common.close")} title={editing ? t("consent.edit") : t("consent.add")} negativeAction={{ label: t("common.cancel"), onPress: close }} positiveAction={{ label: t("common.save"), loading: save.isPending, disabled: !draft.title.trim() || !draft.content.trim(), onPress: submit }}><View style={styles.form}>
    {error && <AppText tone="danger">{error}</AppText>}<AppText variant="label">{t("consent.purpose")}</AppText><View style={styles.purposes}>{purposes.map((purpose) => <Button key={purpose} variant={draft.purpose === purpose ? "primary" : "secondary"} disabled={editing !== null} onPress={() => setDraft((current) => ({ ...current, purpose }))}>{t(consentPurposeKey(purpose))}</Button>)}</View><TextInput style={styles.input} placeholder={t("consent.titleField")} value={draft.title} onChangeText={(title) => setDraft((current) => ({ ...current, title }))} /><TextInput style={[styles.input, styles.multiline]} placeholder={t("consent.content")} value={draft.content} onChangeText={(content) => setDraft((current) => ({ ...current, content }))} multiline />
  </View></BottomSheet></AppScreen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.md }, card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, form: { gap: spacing.sm }, purposes: { gap: spacing.xs }, input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, multiline: { minHeight: 120, paddingTop: spacing.sm, textAlignVertical: "top" } });
