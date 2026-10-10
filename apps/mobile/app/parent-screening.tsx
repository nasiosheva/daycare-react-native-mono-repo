import { useEffect, useMemo, useState } from "react";

// Mories Deo Hutapea,S.E.,S.Kom
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { AppText, BackButton, Button, Card, Chip, EmptyState, MultiStepFormWizard, TextField, colors, radius, spacing, type MultiStepFormWizardStep } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { DatePicker } from "@/date-picker/DatePicker";
import { formatIsoDate } from "@/date-picker/date";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { notify } from "@/notify/notify";
import { previewDownloadedReport, saveDownloadedReport, shareDocumentExport } from "@/document-export";
import { resultGuidanceKey } from "@/screening/resultGuidance";

export default function ParentScreeningScreen() {
  const router = useRouter();
  const { api, profile } = useAuth();
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [resultSessionId, setResultSessionId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [premature, setPremature] = useState(false);
  const [linkedChild, setLinkedChild] = useState<{ childId: string; organizationId: string } | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const profiles = useQuery({ queryKey: ["screening-profiles"], queryFn: () => api.screeningProfiles(), enabled: profile?.registrationRole === "PARENT" });
  const linkedChildren = useQuery({ queryKey: ["screening-linked-children"], queryFn: () => api.screeningLinkedChildren(), enabled: profile?.registrationRole === "PARENT" });
  const templates = useQuery({ queryKey: ["screening-templates"], queryFn: () => api.screeningTemplates(), enabled: profile?.registrationRole === "PARENT" });
  const sessions = useQuery({ queryKey: ["screening-sessions"], queryFn: () => api.screeningSessions(), enabled: profile?.registrationRole === "PARENT" });
  const questionnaire = useQuery({ queryKey: ["screening-questionnaire", sessionId], queryFn: () => api.screeningQuestionnaire(sessionId!), enabled: Boolean(sessionId) });
  const result = useQuery({ queryKey: ["screening-result", resultSessionId], queryFn: () => api.screeningResult(resultSessionId!), enabled: Boolean(resultSessionId) });
  const selectedProfile = profiles.data?.find((item) => item.id === selectedProfileId);
  const selectedTemplate = templates.data?.find((item) => item.id === templateId);
  const requiredMissing = useMemo(() => questionnaire.data?.questions.filter((question) => question.required && !answers[question.id]) ?? [], [answers, questionnaire.data?.questions]);
  const observedItems = useMemo(() => result.data?.items.filter((item) => item.answerCode?.split(",").includes("YA_SUDAH") && item.answerLabelSnapshot) ?? [], [result.data?.items]);
  const wizardSteps: MultiStepFormWizardStep[] = [{ id: "profile", label: t("screening.addProfile") }, { id: "questions", label: t("screening.title") }, { id: "result", label: t("screening.result") }];
  const currentStep = resultSessionId ? 2 : sessionId ? 1 : 0;

  const createProfile = useMutation({ mutationFn: () => api.createScreeningProfile({ subjectName: name, dateOfBirth: birthDate, prematureBirth: premature }), onSuccess: (created) => { queryClient.invalidateQueries({ queryKey: ["screening-profiles"] }); setSelectedProfileId(created.id); setName(""); setBirthDate(""); setPremature(false); }, onError: (error) => notify(error instanceof Error ? error.message : t("screening.saveFailed"), undefined, "danger") });
  const start = useMutation({ mutationFn: () => api.startScreeningSession({ profileId: selectedProfileId!, templateId: templateId!, locale, consentVersion: "screening-v1", correctedAgeMonths: undefined, childId: linkedChild?.childId, organizationId: linkedChild?.organizationId }), onSuccess: (created) => { queryClient.invalidateQueries({ queryKey: ["screening-sessions"] }); setSessionId(created.id); }, onError: (error) => notify(error instanceof Error ? error.message : t("screening.saveFailed"), undefined, "danger") });
  const complete = useMutation({ mutationFn: async () => { await api.saveScreeningAnswers(sessionId!, Object.entries(answers).map(([questionId, answerCode]) => ({ questionId, answerCode }))); return api.completeScreening(sessionId!); }, onSuccess: (value) => { queryClient.invalidateQueries({ queryKey: ["screening-sessions"] }); if ("mainStatus" in value) setResultSessionId(value.sessionId); else notify(t("screening.answerRequired"), undefined, "warning"); }, onError: (error) => notify(error instanceof Error ? error.message : t("screening.saveFailed"), undefined, "danger") });

  useEffect(() => {
    if (!questionnaire.data) return;
    setAnswers((current) => questionnaire.data.questions.reduce((next, question) => {
      if (next[question.id] === undefined && question.currentAnswerCode) next[question.id] = question.currentAnswerCode;
      return next;
    }, { ...current } as Record<string, string>));
  }, [questionnaire.data]);

  if (!profile) return null;
  if (profile.registrationRole !== "PARENT") return <Redirect href="/home" />;
  const reset = () => { setSessionId(null); setResultSessionId(null); setAnswers({}); setTemplateId(null); };
  const previewPdf = async () => { if (!resultSessionId) return; try { const opened = await previewDownloadedReport(await api.downloadScreeningResult(resultSessionId)); if (!opened) notify(t("screening.previewPdfFailed"), undefined, "danger"); } catch { notify(t("screening.previewPdfFailed"), undefined, "danger"); } };
  const sharePdf = async () => { if (!resultSessionId) return; try { const file = await saveDownloadedReport(await api.downloadScreeningResult(resultSessionId)); await shareDocumentExport(file); } catch { notify(t("screening.saveFailed"), undefined, "danger"); } };

  return <AppScreen showBottomNavigation={false} title={t("screening.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <ScrollView contentContainerStyle={styles.content}><MultiStepFormWizard steps={wizardSteps} currentStep={currentStep} progressLabel={`${currentStep + 1} / ${wizardSteps.length}`} accessibilityLabel={t("screening.title")}>
      <AppText tone="muted">{t("screening.description")}</AppText>
      {!sessionId && !resultSessionId && <>
        <Card><AppText variant="heading">{t("screening.addProfile")}</AppText>{linkedChildren.data?.length ? <><AppText tone="muted">{t("screening.linkedChildHint")}</AppText>{linkedChildren.data.map((child) => <Chip key={child.childId} label={`${child.childName} · ${child.organizationName} / ${child.branchName}`} selected={linkedChild?.childId === child.childId} onPress={() => { setLinkedChild({ childId: child.childId, organizationId: child.organizationId }); setName(child.childName); setBirthDate(child.dateOfBirth); }} />)}</> : null}<TextField label={t("screening.name")} value={name} onChangeText={setName} /><DatePicker placeholder={t("screening.birthDate")} value={birthDate} maximumDate={formatIsoDate(new Date())} onChange={setBirthDate} onClear={() => setBirthDate("")} clearAccessibilityLabel={t("common.clear")} /><Chip label={t("screening.premature")} selected={premature} onPress={() => setPremature((value) => !value)} /><Button disabled={!name.trim() || !birthDate || createProfile.isPending} loading={createProfile.isPending} onPress={() => void createProfile.mutateAsync()}>{t("screening.addProfile")}</Button></Card>
        {!profiles.data?.length && <EmptyState compact title={t("screening.empty")} />}
        {sessions.data?.length ? <Card><AppText variant="heading">{t("screening.history")}</AppText>{sessions.data.map((item) => <View key={item.id} style={styles.historyRow}><AppText>{item.templateCode} v{item.templateVersion} · {item.status}</AppText>{(item.status === "DRAFT" || item.status === "IN_PROGRESS") && <Button variant="secondary" onPress={() => { setSelectedProfileId(item.profileId); setTemplateId(item.templateId); setSessionId(item.id); }}>{t("screening.resume")}</Button>}{item.status === "COMPLETED" && <Button variant="secondary" onPress={() => { setSelectedProfileId(item.profileId); setResultSessionId(item.id); }}>{t("screening.result")}</Button>}</View>)}</Card> : null}
        {profiles.data?.map((item) => <Pressable key={item.id} onPress={() => setSelectedProfileId(item.id)}><Card><AppText variant="heading">{item.subjectName}</AppText><AppText tone="muted">{item.dateOfBirth}</AppText><Chip label={item.id === selectedProfileId ? t("screening.start") : t("screening.chooseTemplate")} selected={item.id === selectedProfileId} onPress={() => setSelectedProfileId(item.id)} /></Card></Pressable>)}
        {selectedProfile && <Card><AppText variant="heading">{t("screening.chooseTemplate")}</AppText>{templates.data?.map((item) => <Chip key={item.id} label={`${item.minAgeMonths}–${item.maxAgeMonths} bulan`} selected={item.id === templateId} onPress={() => setTemplateId(item.id)} />)}{!templates.data?.length && <AppText tone="muted">{t("screening.unavailable")}</AppText>}<Chip label={t("screening.consent")} selected={consented} onPress={() => setConsented((value) => !value)} /><Button disabled={!selectedTemplate || !consented || start.isPending} loading={start.isPending} onPress={() => void start.mutateAsync()}>{t("screening.start")}</Button></Card>}
      </>}
      {sessionId && questionnaire.data && !resultSessionId && <Card><AppText variant="heading">{selectedProfile?.subjectName}</AppText>{questionnaire.data.questions.map((question) => <View key={question.id} style={styles.question}><AppText variant="label">{question.questionText || question.stableQuestionId}{question.required ? " *" : ""}</AppText>{question.answerType === "MULTI_CHOICE" && <AppText tone="muted">{t("screening.multiChoiceHint")}</AppText>}{question.choices.filter((choice) => choice.enabled).map((choice) => { const selectedCodes = new Set((answers[question.id] ?? "").split(",").filter(Boolean)); return <Chip key={choice.id} label={choice.label} selected={selectedCodes.has(choice.code)} onPress={() => setAnswers((current) => { if (question.answerType !== "MULTI_CHOICE") return { ...current, [question.id]: choice.code }; const next = new Set((current[question.id] ?? "").split(",").filter(Boolean)); if (next.has(choice.code)) next.delete(choice.code); else next.add(choice.code); return { ...current, [question.id]: Array.from(next).join(",") }; })} />; })}</View>)}<AppText tone="muted">{t("screening.disclaimer")}</AppText><Button disabled={requiredMissing.length > 0 || complete.isPending} loading={complete.isPending} onPress={() => void complete.mutateAsync()}>{t("screening.complete")}</Button></Card>}
      {resultSessionId && result.data && <Card><AppText variant="heading">{t("screening.result")}</AppText><View style={styles.summary}><AppText variant="label">{t("screening.usiaEmasSummary")}</AppText><AppText>{t("screening.usiaEmasSummaryText")}</AppText></View><AppText variant="title">{result.data.statusTitleSnapshot}</AppText><AppText>{result.data.statusSummarySnapshot}</AppText>{observedItems.length > 0 && <View style={styles.reasons}><AppText variant="label">{t("screening.observedItems")}</AppText>{observedItems.map((item) => <View key={item.questionId} style={styles.reason}><AppText>{item.questionTextSnapshot}</AppText><AppText tone="muted">{t("screening.answerPrefix", { answer: item.answerLabelSnapshot ?? "" })}</AppText></View>)}</View>}{result.data.reasons.length > 0 && <View style={styles.reasons}><AppText variant="label">{t("screening.attentionItems")}</AppText>{result.data.reasons.map((reason) => <View key={`${reason.reasonCode}-${reason.displayOrder}`} style={styles.reason}><AppText>{reason.questionTextSnapshot ?? t("screening.reasonGeneral")}</AppText>{reason.answerLabelSnapshot && <AppText tone="muted">{t("screening.answerPrefix", { answer: reason.answerLabelSnapshot })}</AppText>}</View>)}</View>}<View style={styles.guidance}><AppText variant="label">{t("screening.guidanceTitle")}</AppText><AppText>{t(resultGuidanceKey(result.data.mainStatus))}</AppText><AppText tone="muted">{result.data.nextStepSnapshot}</AppText></View><AppText tone="muted">{result.data.disclaimerTextSnapshot}</AppText><View style={styles.pdfActions}><Button variant="secondary" onPress={() => void previewPdf()}>{t("screening.previewPdf")}</Button><Button onPress={() => void sharePdf()}>{t("screening.download")}</Button></View><Button variant="secondary" onPress={reset}>{t("screening.start")}</Button></Card>}
    </MultiStepFormWizard></ScrollView>
  </AppScreen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.md, paddingBottom: spacing.xl }, question: { gap: spacing.xs, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, historyRow: { gap: spacing.xs, paddingVertical: spacing.xs }, summary: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface }, reasons: { gap: spacing.sm }, reason: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface }, guidance: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface }, pdfActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, grow: { flex: 1 }, card: { borderRadius: radius.md } });
