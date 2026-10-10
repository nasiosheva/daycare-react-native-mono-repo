import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { AppText, BackButton, Button, Card, EmptyState, TextField, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { notify } from "@/notify/notify";

export default function ScreeningCatalogScreen() {
  const router = useRouter();
  const { api, profile } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [draftCode, setDraftCode] = useState("");
  const [draftMinAge, setDraftMinAge] = useState("0");
  const [draftMaxAge, setDraftMaxAge] = useState("60");
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});
  const catalog = useQuery({ queryKey: ["screening-catalog"], queryFn: () => api.screeningCatalogTemplates(), enabled: Boolean(profile?.isPlatformAdmin) });
  const create = useMutation({ mutationFn: () => api.createScreeningCatalogTemplate({ code: draftCode.trim(), version: 1, minAgeMonths: Number(draftMinAge), maxAgeMonths: Number(draftMaxAge), ruleVersion: 1, checksum: `manual-${Date.now()}`, questions: [], texts: [], ruleTriggers: [] }), onSuccess: () => { setDraftCode(""); queryClient.invalidateQueries({ queryKey: ["screening-catalog"] }); }, onError: (error) => notify(error instanceof Error ? error.message : t("screening.saveFailed"), undefined, "danger") });
  // Mories Deo Hutapea,S.E.,S.Kom
  const publish = useMutation({ mutationFn: async (id: string) => { const validation = await api.validateScreeningCatalogTemplate(id); setValidationErrors((current) => ({ ...current, [id]: validation.errors })); if (!validation.valid) throw new Error(t("screening.saveFailed")); return api.publishScreeningCatalogTemplate(id); }, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["screening-catalog"] }), onError: (error) => notify(error instanceof Error ? error.message : t("screening.saveFailed"), undefined, "danger") });
  const validate = useMutation({ mutationFn: (id: string) => api.validateScreeningCatalogTemplate(id), onSuccess: (result, id) => { setValidationErrors((current) => ({ ...current, [id]: result.errors })); if (result.valid) notify(t("screening.validationPassed"), undefined, "success"); }, onError: (error) => notify(error instanceof Error ? error.message : t("screening.saveFailed"), undefined, "danger") });
  const review = useMutation({ mutationFn: (id: string) => api.reviewScreeningCatalogTemplate(id, true), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["screening-catalog"] }), onError: (error) => notify(error instanceof Error ? error.message : t("screening.saveFailed"), undefined, "danger") });
  const retire = useMutation({ mutationFn: (id: string) => api.retireScreeningCatalogTemplate(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["screening-catalog"] }), onError: (error) => notify(error instanceof Error ? error.message : t("screening.saveFailed"), undefined, "danger") });
  const remove = useMutation({ mutationFn: (id: string) => api.deleteScreeningCatalogTemplate(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["screening-catalog"] }), onError: (error) => notify(error instanceof Error ? error.message : t("screening.saveFailed"), undefined, "danger") });
  if (!profile) return null;
  if (!profile.isPlatformAdmin) return <Redirect href="/home" />;
  return <AppScreen showBottomNavigation={false} title={t("screening.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}><View style={styles.content}><AppText tone="muted">{t("screening.description")}</AppText><Card><AppText variant="heading">{t("screening.addDraft")}</AppText><TextField label={t("screening.code")} value={draftCode} onChangeText={setDraftCode} /><TextField label={t("screening.minAge")} value={draftMinAge} onChangeText={setDraftMinAge} keyboardType="number-pad" /><TextField label={t("screening.maxAge")} value={draftMaxAge} onChangeText={setDraftMaxAge} keyboardType="number-pad" /><AppText tone="muted">{t("screening.draftNotice")}</AppText><Button disabled={!draftCode.trim() || create.isPending} loading={create.isPending} onPress={() => void create.mutateAsync()}>{t("screening.addDraft")}</Button></Card>{!catalog.data?.length && <EmptyState compact title={t("screening.empty")} />}{catalog.data?.map((item) => <Card key={item.id}><AppText variant="heading">{item.code} v{item.version}</AppText><AppText tone="muted">{item.minAgeMonths}–{item.maxAgeMonths} bulan · {item.status} · review {item.reviewStatus}</AppText><AppText tone="muted">{t("screening.catalogCounts", { questions: item.questions.length, texts: item.texts.length, rules: item.ruleTriggers.length })}</AppText>{validationErrors[item.id]?.map((error) => <AppText key={error} tone="danger">• {error}</AppText>)}<View style={styles.actions}>{item.status === "DRAFT" && <Button variant="secondary" loading={validate.isPending && validate.variables === item.id} onPress={() => void validate.mutateAsync(item.id)}>{t("screening.validate")}</Button>}{item.status === "DRAFT" && <Button variant="secondary" onPress={() => void review.mutateAsync(item.id)}>{t("screening.reviewApproved")}</Button>}{item.status === "DRAFT" && <Button variant="secondary" onPress={() => void publish.mutateAsync(item.id)}>{t("screening.publish")}</Button>}{item.status === "PUBLISHED" && <Button variant="secondary" onPress={() => void retire.mutateAsync(item.id)}>{t("screening.retire")}</Button>}{item.status === "DRAFT" && <Button variant="danger" onPress={() => void remove.mutateAsync(item.id)}>{t("screening.deleteDraft")}</Button>}</View></Card>)}</View></AppScreen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.md, paddingBottom: spacing.xl }, actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, card: { borderRadius: radius.md, backgroundColor: colors.surface } });
