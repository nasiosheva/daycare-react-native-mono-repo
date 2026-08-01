import { useState } from "react";
import { Alert, Image, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, BackButton, Button, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useImagePicker, type PickedImage } from "@/image-picker";
import { parentEnrollmentQueryKey } from "@/parent-enrollment/queryKeys";
import { encodePaymentProofImage } from "@/payment-proof/encodeImage";

const acceptedTypes = new Set(["image/jpeg", "image/png"]);

export default function PaymentProofScreen() {
  const router = useRouter();
  const { invoiceId: rawInvoiceId, organizationId: rawOrganizationId } = useLocalSearchParams<{ invoiceId?: string; organizationId?: string }>();
  const invoiceId = typeof rawInvoiceId === "string" ? rawInvoiceId : "";
  const routeOrganizationId = typeof rawOrganizationId === "string" ? rawOrganizationId : null;
  const { api, user } = useAuth();
  const paymentOrganizationId = routeOrganizationId;
  const invoiceScope = paymentOrganizationId ?? user?.uid ?? "payer-self";
  const { t, formatCurrency, formatDate } = useI18n();
  const client = useQueryClient();
  const imagePicker = useImagePicker();
  const [image, setImage] = useState<PickedImage | null>(null);
  const [note, setNote] = useState("");
  const invoice = useQuery({ queryKey: ["invoice", invoiceScope, invoiceId], queryFn: () => api.invoice(invoiceId), enabled: Boolean(invoiceId) });
  const submit = useMutation({
    mutationFn: async () => {
      if (!image) throw new Error(t("paymentProof.imageRequired"));
      const contentType = acceptedTypes.has(image.mimeType ?? "") ? image.mimeType as "image/jpeg" | "image/png" : "image/jpeg";
      return api.submitPaymentProof(invoiceId, { fileName: image.fileName ?? "payment-proof.jpg", contentType, imageBase64: await encodePaymentProofImage(image), note: note.trim() || undefined });
    },
    onSuccess: () => {
      if (paymentOrganizationId) void client.invalidateQueries({ queryKey: ["invoices", paymentOrganizationId] });
      void client.invalidateQueries({ queryKey: ["invoice", invoiceScope, invoiceId] });
      void client.invalidateQueries({ queryKey: parentEnrollmentQueryKey(user?.uid) });
      Alert.alert(t("paymentProof.submitted"));
      router.back();
    },
  });
  const selectFromLibrary = async () => setImage((await imagePicker.pickFromLibrary())[0] ?? null);
  const takePhoto = async () => setImage(await imagePicker.takePhoto());
  const canSubmit = invoice.data?.status === "PENDING";

  if (!invoiceId) return null;
  return <AppScreen showBottomNavigation={false} title={t("paymentProof.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    {invoice.isLoading ? <AppText>{t("common.loading")}</AppText> : invoice.data && <View style={styles.card}>
      <AppText variant="h5">{invoice.data.invoiceNumber}</AppText>
      <AppText>{invoice.data.childName} · {formatCurrency(invoice.data.totalAmount)}</AppText>
      <AppText tone="muted">{t("tenant.dueDate", { date: formatDate(invoice.data.dueDate) })}</AppText>
      {invoice.data.paymentProof?.status === "SUBMITTED" && <AppText tone="muted">{t("paymentProof.awaitingReview")}</AppText>}
      {invoice.data.paymentProof?.status === "REJECTED" && <AppText tone="muted">{t("paymentProof.rejected", { reason: invoice.data.paymentProof.rejectionReason ?? t("common.noData") })}</AppText>}
    </View>}
    {canSubmit && <View style={styles.form}>
      <AppText tone="muted">{t("paymentProof.description")}</AppText>
      <View style={styles.actions}><Button variant="secondary" onPress={() => void selectFromLibrary()}>{t("paymentProof.upload")}</Button><Button variant="secondary" onPress={() => void takePhoto()}>{t("paymentProof.camera")}</Button></View>
      {image && <Image source={{ uri: image.uri }} style={styles.preview} resizeMode="contain" />}
      <TextInput style={styles.input} multiline placeholder={t("paymentProof.note")} value={note} onChangeText={setNote} />
      <Button loading={submit.isPending} disabled={!image} onPress={() => void submit.mutateAsync().catch((error: unknown) => Alert.alert(t("paymentProof.failed"), error instanceof Error ? error.message : t("auth.tryAgain")))}>{t("paymentProof.submit")}</Button>
      {imagePicker.error && <AppText tone="muted">{imagePicker.error.message}</AppText>}
    </View>}
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  form: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  preview: { width: "100%", height: 240, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  input: { minHeight: 96, padding: spacing.sm, textAlignVertical: "top", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
});
