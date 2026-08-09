import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, BottomSheet, Button, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { notify } from "@/notify/notify";
import { hasBranchOfferingCapability, useUiAccessContext } from "@/education/useUiAccessContext";

export default function PickupAuthorizationsScreen() {
  const router = useRouter();
  const { childId: rawChildId } = useLocalSearchParams<{ childId?: string }>();
  const childId = typeof rawChildId === "string" ? rawChildId : null;
  const { api, organizationId, profile } = useAuth();
  const { t } = useI18n();
  const client = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const access = useUiAccessContext(Boolean(membership));
  const staffChildProfile = useQuery({ queryKey: ["child-profile", organizationId, childId], queryFn: () => api.childProfile(childId!), enabled: Boolean(childId && membership?.role === "STAFF_ADMIN") });
  const parentChildProfile = useQuery({ queryKey: ["parent-child-profile", organizationId, childId], queryFn: () => api.parentChildProfile(childId!), enabled: Boolean(childId && membership?.role === "PARENT") });
  const childBranchId = staffChildProfile.data?.child.branchId ?? parentChildProfile.data?.child.branchId;
  const hasDaycareOperations = hasBranchOfferingCapability(access.data, childBranchId, "DAYCARE_OPERATIONS");
  const [open, setOpen] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const canManage = membership?.role === "STAFF_ADMIN" && membership.active && hasDaycareOperations;
  const canCreate = membership?.role === "PARENT" && membership.active && hasDaycareOperations;
  const pickupContextLoading = access.isLoading || staffChildProfile.isLoading || parentChildProfile.isLoading;
  const authorizations = useQuery({ queryKey: ["pickup-authorizations", organizationId, childId], queryFn: () => api.pickupAuthorizations(childId!), enabled: Boolean(childId && hasDaycareOperations && (membership?.role === "PARENT" || membership?.role === "STAFF_ADMIN")) });
  const create = useMutation({ mutationFn: () => api.createPickupAuthorization(childId!, { pickupPersonName: name.trim(), relationship: relationship.trim(), verificationMethod: "PHOTO_ID" }), onSuccess: async () => { await client.invalidateQueries({ queryKey: ["pickup-authorizations", organizationId, childId] }); setName(""); setRelationship(""); setOpen(false); } });
  const activate = useMutation({ mutationFn: (authorizationId: string) => api.activatePickupAuthorization(childId!, authorizationId), onSuccess: () => void client.invalidateQueries({ queryKey: ["pickup-authorizations", organizationId, childId] }) });
  const revoke = useMutation({ mutationFn: () => api.revokePickupAuthorization(childId!, revokeId!, revokeReason.trim()), onSuccess: async () => { await client.invalidateQueries({ queryKey: ["pickup-authorizations", organizationId, childId] }); setRevokeId(null); setRevokeReason(""); } });
  if (!profile) return null;
  if (!childId || !membership?.active || !["PARENT", "STAFF_ADMIN"].includes(membership.role)) return <Redirect href="/home" />;
  if (pickupContextLoading) return <AppScreen showBottomNavigation={false} title={t("pickup.manage")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}><ShimmerList variant="tile" /></AppScreen>;
  if (!hasDaycareOperations) return <Redirect href="/home" />;
  const submit = async () => {
    if (!name.trim() || !relationship.trim()) return;
    try { await create.mutateAsync(); }
    catch (error) { notify(t("auth.tryAgain"), error instanceof Error ? error.message : undefined); }
  };
  return <AppScreen showBottomNavigation={false} title={t("pickup.manage")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}><View style={styles.content}>
    {canCreate && <Button onPress={() => setOpen(true)}>{t("pickup.add")}</Button>}
    {authorizations.isLoading && <ShimmerList variant="tile" />}
    {authorizations.data?.map((item) => <View key={item.id} style={styles.card}><AppText variant="heading">{item.pickupPersonName}</AppText><AppText tone="muted">{item.relationship}</AppText><AppText tone={item.status === "ACTIVE" ? "default" : "muted"}>{t(`pickup.status.${item.status}`)}</AppText>{canManage && item.status === "PENDING_VERIFICATION" && <Button variant="secondary" loading={activate.isPending} onPress={() => void activate.mutateAsync(item.id)}>{t("pickup.activate")}</Button>}{item.canRevoke && <Button variant="danger" onPress={() => { setRevokeId(item.id); setRevokeReason(""); }}>{t("pickup.revoke")}</Button>}</View>)}
    {!authorizations.isLoading && !authorizations.data?.length && <AppText tone="muted">{t("pickup.empty")}</AppText>}
  </View><BottomSheet visible={open} onClose={() => setOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("pickup.add")} negativeAction={{ label: t("common.cancel"), onPress: () => setOpen(false) }} positiveAction={{ label: t("common.save"), loading: create.isPending, disabled: !name.trim() || !relationship.trim(), onPress: () => void submit() }}><View style={styles.form}><AppText variant="label">{t("pickup.name")}</AppText><TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t("pickup.name")} /><AppText variant="label">{t("pickup.relationship")}</AppText><TextInput style={styles.input} value={relationship} onChangeText={setRelationship} placeholder={t("pickup.relationship")} /></View></BottomSheet><BottomSheet visible={Boolean(revokeId)} onClose={() => { setRevokeId(null); setRevokeReason(""); }} closeAccessibilityLabel={t("common.close")} title={t("pickup.revoke")} negativeAction={{ label: t("common.cancel"), onPress: () => { setRevokeId(null); setRevokeReason(""); } }} positiveAction={{ label: t("pickup.revoke"), loading: revoke.isPending, disabled: !revokeReason.trim(), onPress: () => void revoke.mutateAsync() }}><View style={styles.form}><AppText variant="label">{t("pickup.revokeReason")}</AppText><TextInput style={[styles.input, styles.multiline]} value={revokeReason} onChangeText={setRevokeReason} placeholder={t("pickup.revokeReason")} multiline /></View></BottomSheet></AppScreen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.md }, card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, form: { gap: spacing.xs }, input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, multiline: { minHeight: 96, paddingTop: spacing.sm, textAlignVertical: "top" } });
