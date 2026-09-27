import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, BackButton, Banner, BottomSheet, Button, Card, EmptyState, FloatingActionButton, ShimmerList, TextField, spacing } from "@daycare/ui";
import { statusTone } from "@/ui/statusTone";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { notify } from "@/notify/notify";
import { hasBranchOfferingCapability, useUiAccessContext } from "@/education/useUiAccessContext";

export default function PickupAuthorizationsScreen() {
  const router = useRouter();
  const { childId: rawChildId, organizationId: routeOrganizationId } = useLocalSearchParams<{ childId?: string; organizationId?: string }>();
  const childId = typeof rawChildId === "string" ? rawChildId : null;
  const { api, organizationId: activeOrganizationId, profile } = useAuth();
  const organizationId = (typeof routeOrganizationId === "string" ? routeOrganizationId : undefined) ?? activeOrganizationId ?? undefined;
  const { t } = useI18n();
  const client = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const access = useUiAccessContext(Boolean(membership), organizationId);
  const staffChildProfile = useQuery({ queryKey: ["child-profile", organizationId, childId], queryFn: () => api.childProfile(childId!), enabled: Boolean(childId && membership?.role === "STAFF_ADMIN") });
  const parentChildProfile = useQuery({ queryKey: ["parent-child-profile", organizationId, childId], queryFn: () => api.parentChildProfile(childId!, organizationId), enabled: Boolean(childId && membership?.role === "PARENT") });
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
  const authorizations = useQuery({ queryKey: ["pickup-authorizations", organizationId, childId], queryFn: () => api.pickupAuthorizations(childId!, organizationId), enabled: Boolean(childId && hasDaycareOperations && (membership?.role === "PARENT" || membership?.role === "STAFF_ADMIN")) });
  const create = useMutation({ mutationFn: () => api.createPickupAuthorization(childId!, { pickupPersonName: name.trim(), relationship: relationship.trim(), verificationMethod: "PHOTO_ID" }, organizationId), onSuccess: async () => { await client.invalidateQueries({ queryKey: ["pickup-authorizations", organizationId, childId] }); setName(""); setRelationship(""); setOpen(false); } });
  const activate = useMutation({ mutationFn: (authorizationId: string) => api.activatePickupAuthorization(childId!, authorizationId, organizationId), onSuccess: () => void client.invalidateQueries({ queryKey: ["pickup-authorizations", organizationId, childId] }) });
  const revoke = useMutation({ mutationFn: () => api.revokePickupAuthorization(childId!, revokeId!, revokeReason.trim(), organizationId), onSuccess: async () => { await client.invalidateQueries({ queryKey: ["pickup-authorizations", organizationId, childId] }); setRevokeId(null); setRevokeReason(""); } });
  if (!profile) return null;
  if (!childId || !membership?.active || !["PARENT", "STAFF_ADMIN"].includes(membership.role)) return <Redirect href="/home" />;
  if (pickupContextLoading) return <AppScreen showBottomNavigation={false} title={t("pickup.manage")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}><ShimmerList variant="tile" /></AppScreen>;
  if (!hasDaycareOperations) return <Redirect href="/home" />;
  const submit = async () => {
    if (!name.trim() || !relationship.trim()) return;
    try { await create.mutateAsync(); }
    catch (error) { notify(t("auth.tryAgain"), error instanceof Error ? error.message : undefined, "danger"); }
  };
  return <AppScreen showBottomNavigation={false} title={t("pickup.manage")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={canCreate ? <FloatingActionButton icon="add" accessibilityLabel={t("pickup.add")} onPress={() => setOpen(true)}>{t("pickup.add")}</FloatingActionButton> : undefined}><View style={styles.content}>
    {authorizations.isLoading && <ShimmerList variant="tile" />}
    {authorizations.data?.map((item) => <Card key={item.id} icon="person-outline" title={item.pickupPersonName} subtitle={item.relationship} trailing={<Badge tone={statusTone(item.status)} label={t(`pickup.status.${item.status}`)} />}>{canManage && item.status === "PENDING_VERIFICATION" && <Button variant="secondary" loading={activate.isPending} onPress={() => void activate.mutateAsync(item.id)}>{t("pickup.activate")}</Button>}{item.canRevoke && <Button variant="danger" onPress={() => { setRevokeId(item.id); setRevokeReason(""); }}>{t("pickup.revoke")}</Button>}</Card>)}
    {!authorizations.isLoading && !authorizations.data?.length && <EmptyState icon="car-outline" title={t("pickup.empty")} action={canCreate ? { label: t("pickup.add"), onPress: () => setOpen(true) } : undefined} />}
  </View><BottomSheet visible={open} onClose={() => setOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("pickup.add")} negativeAction={{ label: t("common.cancel"), onPress: () => setOpen(false) }} positiveAction={{ label: t("common.save"), loading: create.isPending, disabled: !name.trim() || !relationship.trim(), onPress: () => void submit() }}><View style={styles.form}><TextField label={t("pickup.name")} required autoCapitalize="words" value={name} onChangeText={setName} /><TextField label={t("pickup.relationship")} required value={relationship} onChangeText={setRelationship} /></View></BottomSheet><BottomSheet visible={Boolean(revokeId)} onClose={() => { setRevokeId(null); setRevokeReason(""); }} closeAccessibilityLabel={t("common.close")} title={t("pickup.revoke")} negativeAction={{ label: t("common.cancel"), onPress: () => { setRevokeId(null); setRevokeReason(""); } }} positiveAction={{ label: t("pickup.revoke"), loading: revoke.isPending, disabled: !revokeReason.trim(), onPress: () => void revoke.mutateAsync() }}><View style={styles.form}><Banner tone="warning" title={t("pickup.revoke")} /><TextField label={t("pickup.revokeReason")} required value={revokeReason} onChangeText={setRevokeReason} multiline /></View></BottomSheet></AppScreen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.md }, form: { gap: spacing.md } });
