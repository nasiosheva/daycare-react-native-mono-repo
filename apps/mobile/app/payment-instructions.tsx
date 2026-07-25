import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PaymentInstruction, UpsertPaymentInstructionInput } from "@daycare/api-client";
import { AppText, BackButton, BottomSheet, Button, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";

const emptyDraft: UpsertPaymentInstructionInput = { name: "", accountHolder: "", accountNumber: "", note: "", active: true, displayOrder: 0 };

export default function PaymentInstructionsScreen() {
  const router = useRouter(); const { api, profile, organizationId } = useAuth(); const { t } = useI18n(); const client = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const [editing, setEditing] = useState<PaymentInstruction | null>(null); const [pendingDelete, setPendingDelete] = useState<PaymentInstruction | null>(null); const [draft, setDraft] = useState<UpsertPaymentInstructionInput>(emptyDraft); const [error, setError] = useState<string | null>(null);
  const instructions = useQuery({ queryKey: ["payment-instructions", "manage", organizationId], queryFn: () => api.managedPaymentInstructions(), enabled: membership?.role === "STAFF_ADMIN" });
  const close = () => { setEditing(null); setDraft(emptyDraft); setError(null); };
  const save = useMutation({ mutationFn: () => editing ? api.updatePaymentInstruction(editing.id, draft) : api.createPaymentInstruction(draft), onSuccess: () => { void client.invalidateQueries({ queryKey: ["payment-instructions"] }); close(); }, onError: (value) => setError(value instanceof Error ? value.message : t("paymentInstruction.saveFailed")) });
  const remove = useMutation({ mutationFn: (id: string) => api.deletePaymentInstruction(id), onSuccess: () => { void client.invalidateQueries({ queryKey: ["payment-instructions"] }); setPendingDelete(null); }, onError: (value) => setError(value instanceof Error ? value.message : t("paymentInstruction.saveFailed")) });
  if (!profile || membership?.role !== "STAFF_ADMIN") return null;
  return <AppScreen showBottomNavigation={false} title={t("paymentInstruction.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}><View style={styles.content}>
    <AppText variant="title">{t("paymentInstruction.title")}</AppText><AppText tone="muted">{t("paymentInstruction.managementDescription")}</AppText>
    {instructions.data?.map((instruction) => <View key={instruction.id} style={styles.card}><AppText variant="heading">{instruction.name}</AppText><AppText>{instruction.accountHolder} · {instruction.accountNumber}</AppText>{instruction.note && <AppText tone="muted">{instruction.note}</AppText>}<Button variant="secondary" onPress={() => { setEditing(instruction); setDraft({ name: instruction.name, accountHolder: instruction.accountHolder, accountNumber: instruction.accountNumber, note: instruction.note ?? "", active: instruction.active, displayOrder: instruction.displayOrder }); }}>{t("common.edit")}</Button><Button variant="danger" onPress={() => setPendingDelete(instruction)}>{t("common.delete")}</Button></View>)}
    {!instructions.isLoading && instructions.data?.length === 0 && <AppText tone="muted">{t("paymentInstruction.empty")}</AppText>}
    <Button onPress={() => { setEditing({ ...emptyDraft, id: "" }); setDraft(emptyDraft); }}>{t("paymentInstruction.add")}</Button>
    <BottomSheet visible={editing !== null} onClose={close} closeAccessibilityLabel={t("common.close")} title={editing?.id ? t("paymentInstruction.edit") : t("paymentInstruction.add")} negativeAction={{ label: t("common.cancel"), onPress: close }} positiveAction={{ label: t("common.save"), loading: save.isPending, onPress: () => save.mutate() }}>
      {error && <AppText tone="danger">{error}</AppText>}<TextInput style={styles.input} placeholder={t("paymentInstruction.name")} value={draft.name} onChangeText={(name) => setDraft((value) => ({ ...value, name }))} /><TextInput style={styles.input} placeholder={t("paymentInstruction.accountHolder")} value={draft.accountHolder} onChangeText={(accountHolder) => setDraft((value) => ({ ...value, accountHolder }))} /><TextInput style={styles.input} placeholder={t("paymentInstruction.accountNumber")} value={draft.accountNumber} onChangeText={(accountNumber) => setDraft((value) => ({ ...value, accountNumber }))} /><TextInput style={styles.input} placeholder={t("paymentInstruction.note")} value={draft.note ?? ""} onChangeText={(note) => setDraft((value) => ({ ...value, note }))} />
    </BottomSheet>
    <BottomSheet visible={pendingDelete !== null} onClose={() => setPendingDelete(null)} closeAccessibilityLabel={t("common.close")} title={t("paymentInstruction.delete")} negativeAction={{ label: t("common.cancel"), onPress: () => setPendingDelete(null) }} positiveAction={{ label: t("common.delete"), variant: "danger", loading: remove.isPending, onPress: () => pendingDelete && remove.mutate(pendingDelete.id) }}>
      <AppText tone="muted">{t("paymentInstruction.deleteConfirmation", { name: pendingDelete?.name ?? "" })}</AppText>
    </BottomSheet>
  </View></AppScreen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.md }, card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.surface } });
