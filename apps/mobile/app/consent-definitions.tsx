import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ConsentDefinition, ConsentDefinitionScope, ConsentPurpose, CreateConsentDefinitionInput } from "@daycare/api-client";
import { AppText, BackButton, BottomSheet, Button, FloatingActionButton, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { consentPurposeKey, consentScopeKey } from "@/i18n/translations";
import { hasOfferingCapability, useUiAccessContext } from "@/education/useUiAccessContext";
import { DatePicker } from "@/date-picker/DatePicker";
import { formatIsoDate } from "@/date-picker/date";

const purposes: ConsentPurpose[] = ["MEDIA_MARKETING", "HEALTH_EMERGENCY", "MEDICATION", "OUTING", "PICKUP"];
const scopes: ConsentDefinitionScope[] = ["TENANT", "BRANCH", "OFFERING"];
const emptyDraft: CreateConsentDefinitionInput = { purpose: "MEDIA_MARKETING", title: "", content: "", scope: "TENANT" };

export default function ConsentDefinitionsScreen() {
  const router = useRouter();
  const { api, organizationId, profile } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const access = useUiAccessContext(Boolean(membership));
  const canManage = membership?.role === "STAFF_ADMIN" && hasOfferingCapability(access.data, "DAYCARE_OPERATIONS") && membership.active !== false;
  const definitions = useQuery({ queryKey: ["consent-definitions", organizationId, "manage"], queryFn: () => api.managedConsentDefinitions(), enabled: Boolean(canManage) });
  const branches = useQuery({ queryKey: ["branches", organizationId], queryFn: () => api.branches(), enabled: Boolean(canManage) });
  const offerings = useQuery({ queryKey: ["education-offerings", organizationId], queryFn: () => api.educationOfferings(), enabled: Boolean(canManage) });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ConsentDefinition | null>(null);
  const [draft, setDraft] = useState<CreateConsentDefinitionInput>(emptyDraft);
  const [effectiveUntilDate, setEffectiveUntilDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const close = () => { setOpen(false); setEditing(null); setDraft(emptyDraft); setEffectiveUntilDate(""); setError(null); };
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["consent-definitions", organizationId] });
  const save = useMutation({ mutationFn: () => editing ? api.reviseConsentDefinition(editing.id, { title: draft.title, content: draft.content, expectedRevision: editing.revision }) : api.createConsentDefinition({ ...draft, effectiveUntil: effectiveUntilDate ? `${effectiveUntilDate}T23:59:59` : undefined }), onSuccess: () => { refresh(); close(); }, onError: (value) => setError(value instanceof Error ? value.message : t("consent.definitionFailed")) });
  const setActive = useMutation({ mutationFn: (definition: ConsentDefinition) => api.setConsentDefinitionActive(definition.id, !definition.active, definition.revision), onSuccess: refresh, onError: (value) => setError(value instanceof Error ? value.message : t("consent.definitionFailed")) });
  const openCreate = () => { setEditing(null); setDraft(emptyDraft); setEffectiveUntilDate(""); setError(null); setOpen(true); };
  const openEdit = (definition: ConsentDefinition) => { setEditing(definition); setDraft({ purpose: definition.purpose, title: definition.title, content: definition.content, scope: definition.scope, branchId: definition.branchId ?? undefined, offeringId: definition.offeringId ?? undefined }); setEffectiveUntilDate(definition.effectiveUntil ? definition.effectiveUntil.slice(0, 10) : ""); setError(null); setOpen(true); };
  const branchName = (branchId?: string | null) => branches.data?.find((item) => item.id === branchId)?.name;
  const offeringLabel = (offeringId?: string | null) => { const offering = offerings.data?.find((item) => item.id === offeringId); return offering ? `${offering.institutionType} · ${offering.programCode}` : undefined; };
  const scopeDetail = (definition: ConsentDefinition) => definition.scope === "BRANCH" ? branchName(definition.branchId) : definition.scope === "OFFERING" ? offeringLabel(definition.offeringId) : undefined;
  const submit = () => {
    if (!draft.title.trim() || !draft.content.trim()) { setError(t("consent.definitionFailed")); return; }
    if (draft.scope === "BRANCH" && !draft.branchId) { setError(t("consent.definitionFailed")); return; }
    if (draft.scope === "OFFERING" && !draft.offeringId) { setError(t("consent.definitionFailed")); return; }
    save.mutate();
  };
  const submitDisabled = !draft.title.trim() || !draft.content.trim() || (draft.scope === "BRANCH" && !draft.branchId) || (draft.scope === "OFFERING" && !draft.offeringId);

  if (!profile || access.isLoading) return null;
  if (!canManage) return <Redirect href="/home" />;
  return <AppScreen showBottomNavigation={false} title={t("consent.staffTitle")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} headerAction={<Pressable accessibilityRole="button" accessibilityLabel={t("consent.informationAction")} hitSlop={spacing.sm} onPress={() => router.push("/consent-information" as never)} style={({ pressed }) => [styles.informationAction, pressed && styles.informationActionPressed]}><Ionicons name="information-circle-outline" size={28} color={colors.primary} /></Pressable>} floatingAction={<FloatingActionButton accessibilityLabel={t("consent.add")} onPress={openCreate}>+ {t("consent.add")}</FloatingActionButton>}><View style={styles.content}>
    <AppText tone="muted">{t("consent.staffDescription")}</AppText>
    {error && <AppText tone="danger">{error}</AppText>}
    {definitions.isFetching && <ShimmerList />}
    {definitions.data?.map((definition) => <View key={definition.id} style={styles.card}><AppText variant="heading">{definition.title}</AppText><AppText variant="caption" tone="muted">{t(consentPurposeKey(definition.purpose))} · {t("consent.revision", { revision: definition.revision })}</AppText><AppText variant="caption" tone="muted">{t(consentScopeKey(definition.scope))}{scopeDetail(definition) ? ` · ${scopeDetail(definition)}` : ""}</AppText><AppText tone="muted">{definition.content}</AppText><AppText variant="label">{definition.active ? t("consent.active") : t("consent.inactive")}</AppText><Button variant="secondary" onPress={() => openEdit(definition)}>{t("consent.edit")}</Button><Button variant={definition.active ? "danger" : "secondary"} loading={setActive.isPending} onPress={() => void setActive.mutateAsync(definition)}>{definition.active ? t("consent.deactivate") : t("consent.activate")}</Button></View>)}
    {!definitions.isFetching && !definitions.data?.length && <AppText tone="muted">{t("consent.manageEmpty")}</AppText>}
  </View><BottomSheet visible={open} onClose={close} closeAccessibilityLabel={t("common.close")} title={editing ? t("consent.edit") : t("consent.add")} negativeAction={{ label: t("common.cancel"), onPress: close }} positiveAction={{ label: t("common.save"), loading: save.isPending, disabled: submitDisabled, onPress: submit }}><View style={styles.form}>
    {error && <AppText tone="danger">{error}</AppText>}<AppText variant="label">{t("consent.purpose")}</AppText><View style={styles.purposes}>{purposes.map((purpose) => <Button key={purpose} variant={draft.purpose === purpose ? "primary" : "secondary"} disabled={editing !== null} onPress={() => setDraft((current) => ({ ...current, purpose }))}>{t(consentPurposeKey(purpose))}</Button>)}</View><TextInput style={styles.input} placeholder={t("consent.titleField")} value={draft.title} onChangeText={(title) => setDraft((current) => ({ ...current, title }))} /><TextInput style={[styles.input, styles.multiline]} placeholder={t("consent.content")} value={draft.content} onChangeText={(content) => setDraft((current) => ({ ...current, content }))} multiline />
    <AppText variant="label">{t("consent.scope")}</AppText><View style={styles.purposes}>{scopes.map((item) => <Button key={item} variant={draft.scope === item ? "primary" : "secondary"} disabled={editing !== null} onPress={() => setDraft((current) => ({ ...current, scope: item, branchId: undefined, offeringId: undefined }))}>{t(consentScopeKey(item))}</Button>)}</View>
    {draft.scope === "BRANCH" && <View style={styles.purposes}>{branches.data?.map((branch) => <Button key={branch.id} variant={draft.branchId === branch.id ? "primary" : "secondary"} disabled={editing !== null} onPress={() => setDraft((current) => ({ ...current, branchId: branch.id }))}>{branch.name}</Button>)}</View>}
    {draft.scope === "OFFERING" && <View style={styles.purposes}>{offerings.data?.map((offering) => <Button key={offering.id} variant={draft.offeringId === offering.id ? "primary" : "secondary"} disabled={editing !== null} onPress={() => setDraft((current) => ({ ...current, offeringId: offering.id }))}>{offering.institutionType} · {offering.programCode}</Button>)}</View>}
    <AppText variant="label">{t("consent.effectiveUntil")}</AppText>
    <DatePicker placeholder={t("consent.effectiveUntil")} value={effectiveUntilDate} minimumDate={formatIsoDate(new Date())} onChange={setEffectiveUntilDate} onClear={() => setEffectiveUntilDate("")} clearAccessibilityLabel={t("common.clear")} disabled={editing !== null} />
  </View></BottomSheet></AppScreen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.md }, card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, form: { gap: spacing.sm }, purposes: { gap: spacing.xs }, input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, multiline: { minHeight: 120, paddingTop: spacing.sm, textAlignVertical: "top" }, informationAction: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.pill }, informationActionPressed: { opacity: 0.76, backgroundColor: colors.surfaceTint } });
