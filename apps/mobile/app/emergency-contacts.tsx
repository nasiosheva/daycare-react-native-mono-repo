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
import { DatePicker } from "@/date-picker/DatePicker";
import { formatIsoDate } from "@/date-picker/date";

export default function EmergencyContactsScreen() {
  const router = useRouter();
  const { childId: rawChildId } = useLocalSearchParams<{ childId?: string }>();
  const childId = typeof rawChildId === "string" ? rawChildId : null;
  const { api, organizationId, profile } = useAuth();
  const { t } = useI18n();
  const client = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const isParent = membership?.role === "PARENT";
  const [open, setOpen] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const contacts = useQuery({ queryKey: ["emergency-contacts", organizationId, childId], queryFn: () => api.emergencyContacts(childId!), enabled: Boolean(childId && (isParent || membership?.role === "STAFF_ADMIN")) });
  const create = useMutation({ mutationFn: () => api.createEmergencyContact(childId!, { name: name.trim(), relationship: relationship.trim(), phoneNumber: phoneNumber.trim(), effectiveUntil: expiresOn ? new Date(`${expiresOn}T23:59:59`).toISOString() : undefined }), onSuccess: async () => { await client.invalidateQueries({ queryKey: ["emergency-contacts", organizationId, childId] }); setOpen(false); setName(""); setRelationship(""); setPhoneNumber(""); setExpiresOn(""); } });
  const remove = useMutation({ mutationFn: (contactId: string) => api.removeEmergencyContact(childId!, contactId), onSuccess: () => void client.invalidateQueries({ queryKey: ["emergency-contacts", organizationId, childId] }) });
  const revoke = useMutation({ mutationFn: () => api.revokeEmergencyContact(childId!, revokeId!, revokeReason.trim()), onSuccess: async () => { await client.invalidateQueries({ queryKey: ["emergency-contacts", organizationId, childId] }); setRevokeId(null); setRevokeReason(""); } });
  if (!profile) return null;
  if (!childId || !(isParent || membership?.role === "STAFF_ADMIN")) return <Redirect href="/home" />;
  const submit = async () => { if (!name.trim() || !relationship.trim() || !phoneNumber.trim()) return; try { await create.mutateAsync(); } catch (error) { notify(t("auth.tryAgain"), error instanceof Error ? error.message : undefined); } };
  return <AppScreen showBottomNavigation={false} title={t("emergencyContacts.manage")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}><View style={styles.content}>
    {isParent && <Button onPress={() => setOpen(true)}>{t("emergencyContacts.add")}</Button>}
    {contacts.isLoading && <ShimmerList variant="tile" />}
    {contacts.data?.map((item) => <View key={item.id} style={styles.card}>
      <AppText variant="heading">{item.name}</AppText>
      <AppText tone="muted">{item.relationship}</AppText>
      <AppText tone="muted">{item.phoneNumber}</AppText>
      <AppText tone={item.status === "ACTIVE" ? "default" : "muted"}>{t(`emergencyContacts.status.${item.status}`)}</AppText>
      {item.canRevoke && <Button variant="secondary" onPress={() => { setRevokeId(item.id); setRevokeReason(""); }}>{t("emergencyContacts.revoke")}</Button>}
      {item.canRemove && <Button variant="danger" loading={remove.isPending} onPress={() => void remove.mutateAsync(item.id)}>{t("emergencyContacts.remove")}</Button>}
    </View>)}
    {!contacts.isLoading && !contacts.data?.length && <AppText tone="muted">{t("emergencyContacts.empty")}</AppText>}
  </View>
  <BottomSheet visible={open} onClose={() => setOpen(false)} closeAccessibilityLabel={t("common.close")} title={t("emergencyContacts.add")} negativeAction={{ label: t("common.cancel"), onPress: () => setOpen(false) }} positiveAction={{ label: t("common.save"), loading: create.isPending, disabled: !name.trim() || !relationship.trim() || !phoneNumber.trim(), onPress: () => void submit() }}><View style={styles.form}>
    <AppText variant="label">{t("emergencyContacts.name")}</AppText><TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t("emergencyContacts.name")} />
    <AppText variant="label">{t("emergencyContacts.relationship")}</AppText><TextInput style={styles.input} value={relationship} onChangeText={setRelationship} placeholder={t("emergencyContacts.relationship")} />
    <AppText variant="label">{t("emergencyContacts.phone")}</AppText><TextInput style={styles.input} value={phoneNumber} onChangeText={setPhoneNumber} placeholder={t("emergencyContacts.phone")} keyboardType="phone-pad" />
    <AppText variant="label">{t("emergencyContacts.expiresOn")}</AppText>
    <DatePicker placeholder={t("emergencyContacts.expiresOn")} value={expiresOn} minimumDate={formatIsoDate(new Date())} onChange={setExpiresOn} onClear={() => setExpiresOn("")} clearAccessibilityLabel={t("common.clear")} />
  </View></BottomSheet>
  <BottomSheet visible={Boolean(revokeId)} onClose={() => { setRevokeId(null); setRevokeReason(""); }} closeAccessibilityLabel={t("common.close")} title={t("emergencyContacts.revoke")} negativeAction={{ label: t("common.cancel"), onPress: () => { setRevokeId(null); setRevokeReason(""); } }} positiveAction={{ label: t("emergencyContacts.revoke"), loading: revoke.isPending, disabled: !revokeReason.trim(), onPress: () => void revoke.mutateAsync() }}><View style={styles.form}>
    <AppText variant="label">{t("emergencyContacts.revokeReason")}</AppText><TextInput style={[styles.input, styles.multiline]} value={revokeReason} onChangeText={setRevokeReason} placeholder={t("emergencyContacts.revokeReason")} multiline />
  </View></BottomSheet></AppScreen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.md }, card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, form: { gap: spacing.xs }, input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, multiline: { minHeight: 96, paddingTop: spacing.sm, textAlignVertical: "top" } });
