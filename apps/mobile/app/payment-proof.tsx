import { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, Badge, BackButton, Banner, Button, Card, InfoRow, ShimmerList, TextField, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useImagePicker, type PickedImage } from "@/image-picker";
import { parentEnrollmentQueryKey } from "@/parent-enrollment/queryKeys";
import { encodePaymentProofImage } from "@/payment-proof/encodeImage";
import { PaymentSteps, paymentStepForInvoice } from "@/payment-proof/PaymentSteps";
import { invoiceStatusKey } from "@/i18n/translations";
import { notify } from "@/notify/notify";
import { statusTone } from "@/ui/statusTone";

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
  const invoice = useQuery({ queryKey: ["invoice", invoiceScope, invoiceId], queryFn: () => api.invoice(invoiceId, paymentOrganizationId ?? undefined), enabled: Boolean(invoiceId && paymentOrganizationId) });
  const submit = useMutation({
    mutationFn: async () => {
      if (!image) throw new Error(t("paymentProof.imageRequired"));
      const contentType = acceptedTypes.has(image.mimeType ?? "") ? image.mimeType as "image/jpeg" | "image/png" : "image/jpeg";
      return api.submitPaymentProof(invoiceId, { fileName: image.fileName ?? "payment-proof.jpg", contentType, imageBase64: await encodePaymentProofImage(image), note: note.trim() || undefined }, paymentOrganizationId ?? undefined);
    },
    onSuccess: () => {
      if (paymentOrganizationId) void client.invalidateQueries({ queryKey: ["invoices", paymentOrganizationId] });
      void client.invalidateQueries({ queryKey: ["invoice", invoiceScope, invoiceId] });
      void client.invalidateQueries({ queryKey: parentEnrollmentQueryKey(user?.uid) });
      notify(t("paymentProof.submitted"), t("paymentProof.awaitingReview"), "success");
      router.back();
    },
  });
  const selectFromLibrary = async () => setImage((await imagePicker.pickFromLibrary())[0] ?? null);
  const takePhoto = async () => setImage(await imagePicker.takePhoto());
  const canSubmit = invoice.data?.status === "PENDING";

  if (!invoiceId) return null;
  return <AppScreen showBottomNavigation={false} title={t("paymentProof.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <PaymentSteps current={paymentStepForInvoice(invoice.data?.status, "upload")} labels={[t("parentEnrollment.payStepTransfer"), t("parentEnrollment.payStepUpload"), t("parentEnrollment.payStepVerify")]} />
    {invoice.isLoading ? <ShimmerList variant="tile" count={1} /> : invoice.data && <Card icon="receipt-outline" title={invoice.data.invoiceNumber} subtitle={invoice.data.childName} trailing={<Badge tone={statusTone(invoice.data.status)} label={t(invoiceStatusKey(invoice.data.status))} />}>
      <AppText variant="h4" style={styles.amount}>{formatCurrency(invoice.data.totalAmount)}</AppText>
      <InfoRow icon="calendar-outline" label={t("parentEnrollment.dueDateLabel")} value={formatDate(invoice.data.dueDate)} />
    </Card>}
    {invoice.data?.paymentProof?.status === "SUBMITTED" && <Banner tone="info" title={t("status.PAYMENT_SUBMITTED")} message={t("paymentProof.awaitingReview")} />}
    {invoice.data?.paymentProof?.status === "REJECTED" && <Banner tone="danger" title={t("status.REJECTED")} message={t("paymentProof.rejected", { reason: invoice.data.paymentProof.rejectionReason ?? t("common.noData") })} />}
    {canSubmit && <Card title={t("paymentProof.title")} subtitle={t("paymentProof.description")}>
      {image
        ? <View style={styles.previewWrap}>
          <Image source={{ uri: image.uri }} style={styles.preview} resizeMode="contain" accessibilityIgnoresInvertColors />
          <Button variant="ghost" leadingIcon={<Ionicons name="refresh" size={18} color={colors.primary} />} onPress={() => setImage(null)}>{t("paymentProof.changeImage")}</Button>
        </View>
        : <View style={styles.pickers}>
          <PickerTile icon="images-outline" label={t("paymentProof.upload")} onPress={() => void selectFromLibrary()} />
          <PickerTile icon="camera-outline" label={t("paymentProof.camera")} onPress={() => void takePhoto()} />
        </View>}
      {imagePicker.error && <Banner tone="danger" title={imagePicker.error.message} />}
      <TextField label={t("paymentProof.note")} multiline value={note} onChangeText={setNote} />
      <Button loading={submit.isPending} disabled={!image} leadingIcon={<Ionicons name="send" size={16} color={image ? colors.onPrimary : colors.muted} />} onPress={() => void submit.mutateAsync().catch((error: unknown) => notify(t("paymentProof.failed"), error instanceof Error ? error.message : t("auth.tryAgain"), "danger"))}>{t("paymentProof.submit")}</Button>
      {!image && <AppText variant="caption" tone="muted" style={styles.center}>{t("paymentProof.imageRequired")}</AppText>}
    </Card>}
  </AppScreen>;
}

function PickerTile({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.pickerTile, pressed && styles.pickerTilePressed]}>
    <Ionicons name={icon} size={28} color={colors.primary} />
    <AppText variant="label" style={styles.center}>{label}</AppText>
  </Pressable>;
}

const styles = StyleSheet.create({
  amount: { color: colors.primary },
  pickers: { flexDirection: "row", gap: spacing.sm },
  pickerTile: { flex: 1, minHeight: 104, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.primary, backgroundColor: colors.surfaceTint },
  pickerTilePressed: { opacity: 0.8 },
  previewWrap: { gap: spacing.xs },
  preview: { width: "100%", height: 240, borderRadius: radius.md, backgroundColor: colors.surfaceTint },
  center: { textAlign: "center" },
});
