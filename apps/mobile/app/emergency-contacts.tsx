import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, Badge, BackButton, Banner, BottomSheet, Button, Card, EmptyState, FloatingActionButton, InfoRow, ShimmerList, TextField, spacing } from "@daycare/ui";
import { statusTone } from "@/ui/statusTone";
import { pendingActionState } from "@/ui/pendingAction";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { notify } from "@/notify/notify";
import { DatePicker } from "@/date-picker/DatePicker";
import { formatIsoDate } from "@/date-picker/date";
import { useParentOperationalChild } from "@/parent/useParentOperationalChild";

export default function EmergencyContactsScreen() {
  const router = useRouter();
  const { childId: rawChildId, organizationId: routeOrganizationId } = useLocalSearchParams<{ childId?: string; organizationId?: string }>();
  const childId = typeof rawChildId === "string" ? rawChildId : null;
  const { api, organizationId: activeOrganizationId, profile } = useAuth();
  const organizationId = (typeof routeOrganizationId === "string" ? routeOrganizationId : undefined) ?? activeOrganizationId ?? undefined;
  const { t } = useI18n();
  const client = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const isParent = membership?.role === "PARENT";
  const { hasActiveEntitlement } = useParentOperationalChild(childId ?? undefined, organizationId);
  const parentCanMutate = isParent && membership?.active === true && hasActiveEntitlement;
  const [open, setOpen] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const contacts = useQuery({ queryKey: ["emergency-contacts", organizationId, childId], queryFn: () => api.emergencyContacts(childId!, organizationId), enabled: Boolean(childId && (isParent || membership?.role === "STAFF_ADMIN")) });
  const create = useMutation({ mutationFn: () => api.createEmergencyContact(childId!, { name: name.trim(), relationship: relationship.trim(), phoneNumber: phoneNumber.trim(), effectiveUntil: expiresOn ? new Date(`${expiresOn}T23:59:59`).toISOString() : undefined }, organizationId), onSuccess: async () => { await client.invalidateQueries({ queryKey: ["emergency-contacts", organizationId, childId] }); setOpen(false); setName(""); setRelationship(""); setPhoneNumber(""); setExpiresOn(""); } });
  const remove = useMutation({ mutationFn: (contactId: string) => api.removeEmergencyContact(childId!, contactId, organizationId), onSuccess: () => void client.invalidateQueries({ queryKey: ["emergency-contacts", organizationId, childId] }) });
  const revoke = useMutation({ mutationFn: () => api.revokeEmergencyContact(childId!, revokeId!, revokeReason.trim(), organizationId), onSuccess: async () => { await client.invalidateQueries({ queryKey: ["emergency-contacts", organizationId, childId] }); setRevokeId(null); setRevokeReason(""); } });
  if (!profile) return null;
  if (!childId || !(isParent || membership?.role === "STAFF_ADMIN")) return <Redirect href="/home" />;
  const submit = async () => { if (!name.trim() || !relationship.trim() || !phoneNumber.trim()) return; try { await create.mutateAsync(); } catch (error) { notify(t("auth.tryAgain"), error instanceof Error ? error.message : undefined, "danger"); } };
  return <AppScreen showBottomNavigation={false} title={t("emergencyContacts.manage")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />} floatingAction={parentCanMutate ? <FloatingActionButton icon="add" accessibilityLabel={t("emergencyContacts.add")} onPress={() => setOpen(true)}>{t("emergencyContacts.add")}</FloatingActionButton> : undefined}><View style={styles.content}>
    {contacts.isLoading && <ShimmerList variant="tile" />}
    {contacts.data?.map((item) => <Card key={item.id} icon="person-outline" title={item.name} subtitle={item.relationship} trailing={<Badge tone={statusTone(item.status)} label={t(`emergencyContacts.status.${item.status}`)} />}>
      <InfoRow icon="call-outline" label={t("emergencyContacts.phone")} value={<AppText variant="label" selectable>{item.phoneNumber}</AppText>} />
      {(item.canRevoke || item.canRemove) && <View style={styles.actions}>
        {item.canRevoke && (!isParent || parentCanMutate) && <Button style={styles.action} variant="secondary" onPress={() => { setRevokeId(item.id); setRevokeReason(""); }}>{t("emergencyContacts.revoke")}</Button>}
        {item.canRemove && (!isParent || parentCanMutate) && <Button style={styles.action} variant="danger" {...pendingActionState(remove, (contactId) => contactId === item.id)} onPress={() => void remove.mutateAsync(item.id)}>{t("emergencyContacts.remove")}</Button>}
      </View>}
    </Card>)}
    {!contacts.isLoading && !contacts.data?.length && <EmptyState icon="call-outline" title={t("emergencyContacts.empty")} action={parentCanMutate ? { label: t("emergencyContacts.add"), onPress: () => setOpen(true) } : undefined} />}
  </View>
  <BottomSheet visible={open} onClose={() => setOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("emergencyContacts.add")} negativeAction={{ label: t("common.cancel"), onPress: () => setOpen(false) }} positiveAction={{ label: t("common.save"), loading: create.isPending, disabled: !name.trim() || !relationship.trim() || !phoneNumber.trim(), onPress: () => void submit() }}><View style={styles.form}>
    <TextField label={t("emergencyContacts.name")} required autoCapitalize="words" value={name} onChangeText={setName} />
    <TextField label={t("emergencyContacts.relationship")} required value={relationship} onChangeText={setRelationship} />
    <TextField label={t("emergencyContacts.phone")} required leadingIcon="call-outline" value={phoneNumber} onChangeText={setPhoneNumber} placeholder="+628..." keyboardType="phone-pad" />
    <AppText variant="label">{t("emergencyContacts.expiresOn")}</AppText>
    <DatePicker placeholder={t("emergencyContacts.expiresOn")} value={expiresOn} minimumDate={formatIsoDate(new Date())} onChange={setExpiresOn} onClear={() => setExpiresOn("")} clearAccessibilityLabel={t("common.clear")} />
  </View></BottomSheet>
  <BottomSheet visible={Boolean(revokeId)} onClose={() => { setRevokeId(null); setRevokeReason(""); }} closeAccessibilityLabel={t("common.close")} title={t("emergencyContacts.revoke")} negativeAction={{ label: t("common.cancel"), onPress: () => { setRevokeId(null); setRevokeReason(""); } }} positiveAction={{ label: t("emergencyContacts.revoke"), loading: revoke.isPending, disabled: !revokeReason.trim(), onPress: () => void revoke.mutateAsync() }}><View style={styles.form}>
    <Banner tone="warning" title={t("emergencyContacts.revoke")} />
    <TextField label={t("emergencyContacts.revokeReason")} required value={revokeReason} onChangeText={setRevokeReason} multiline />
  </View></BottomSheet></AppScreen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.md }, form: { gap: spacing.md }, actions: { flexDirection: "row", gap: spacing.sm }, action: { flex: 1 } });
