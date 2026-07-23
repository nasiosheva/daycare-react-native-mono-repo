import { useEffect, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { childGoalOutcomes, goalCheckInOutcomes, type ChildGoalOutcome } from "@daycare/core";
import { AppText, BackButton, BottomSheet, Button, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useChildren } from "@/attendance/useAttendance";
import { useI18n } from "@/i18n/I18nProvider";
import { formatIsoDate } from "@/date-picker/date";

type Sheet = "assign" | "finalize" | null;

export default function GoalsScreen() {
  const router = useRouter();
  const { childId: routeChildId } = useLocalSearchParams<{ childId?: string }>();
  const { api, profile, organizationId } = useAuth();
  const { t, formatDate } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const canAdmin = membership?.role === "STAFF_ADMIN" && membership.active;
  const canWrite = Boolean(membership?.active && (membership.role === "STAFF_ADMIN" || membership.role === "STAFF"));
  const children = useChildren();
  const [childId, setChildId] = useState<string | null>(typeof routeChildId === "string" ? routeChildId : null);
  useEffect(() => { if (!childId && children.data?.[0]) setChildId(children.data[0].id); }, [childId, children.data]);
  const selectedChild = children.data?.find((child) => child.id === childId) ?? null;
  const templates = useQuery({ queryKey: ["goal-templates", organizationId], queryFn: () => api.goalTemplates(), enabled: canAdmin });
  const classrooms = useQuery({ queryKey: ["classrooms", organizationId], queryFn: () => api.classrooms(), enabled: canAdmin });
  const goals = useQuery({ queryKey: ["child-goals", organizationId, childId], queryFn: () => api.childGoals(childId!), enabled: Boolean(childId && membership) });
  const refreshGoals = () => { void queryClient.invalidateQueries({ queryKey: ["goal-templates", organizationId] }); void queryClient.invalidateQueries({ queryKey: ["child-goals", organizationId, childId] }); };
  const [sheet, setSheet] = useState<Sheet>(null);
  const [templateId, setTemplateId] = useState<string>(); const [finalGoalId, setFinalGoalId] = useState<string>(); const [finalOutcome, setFinalOutcome] = useState<ChildGoalOutcome>("ACHIEVED"); const [finalSummary, setFinalSummary] = useState("");
  const assign = useMutation({ mutationFn: () => api.assignChildGoal(childId!, { templateId: templateId! }), onSuccess: () => { refreshGoals(); setSheet(null); setTemplateId(undefined); } });
  const finalize = useMutation({ mutationFn: () => api.finalizeChildGoal(finalGoalId!, { outcome: finalOutcome, summary: finalSummary.trim() }), onSuccess: () => { refreshGoals(); setSheet(null); setFinalGoalId(undefined); setFinalSummary(""); } });
  const checkIn = useMutation({ mutationFn: ({ goalId, outcome }: { goalId: string; outcome: (typeof goalCheckInOutcomes)[number] }) => api.recordGoalCheckIn(goalId, formatIsoDate(new Date()), outcome), onSuccess: refreshGoals });
  const archiveTemplate = useMutation({ mutationFn: api.archiveGoalTemplate.bind(api), onSuccess: refreshGoals });
  const selectedClassroom = classrooms.data?.find((classroom) => classroom.id === selectedChild?.classroomId);
  const availableTemplates = templates.data?.filter((template) => template.active
    && (!template.classroomId || template.classroomId === selectedChild?.classroomId)
    && (!template.learningLevelId || template.learningLevelId === selectedClassroom?.learningLevelId)) ?? [];
  if (!profile || !membership) return null;

  return <AppScreen showBottomNavigation={false} title={t("goals.title")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}>
    <AppText tone="muted">{t("goals.subtitle")}</AppText>
    {canAdmin && <View style={styles.section}><View style={styles.row}><AppText variant="heading">{t("goals.templates")}</AppText><Button onPress={() => router.push("/goal-template")}>{t("goals.addTemplate")}</Button></View>{templates.data?.map((template) => <View key={template.id} style={styles.card}><AppText variant="label">{template.name}</AppText><AppText tone="muted">{t("goals.target", { days: template.durationDays, percent: template.minimumYesPercent, streak: template.minimumYesStreak })}</AppText><View style={styles.options}><Button variant="secondary" onPress={() => router.push({ pathname: "/goal-template", params: { templateId: template.id } })}>{t("common.edit")}</Button>{template.active && <Button variant="danger" onPress={() => void archiveTemplate.mutateAsync(template.id)}>{t("goals.archive")}</Button>}</View></View>)}{templates.data?.length === 0 && <AppText tone="muted">{t("goals.noTemplates")}</AppText>}</View>}
    <View style={styles.section}><AppText variant="heading">{t("goals.childGoals")}</AppText><View style={styles.options}>{children.data?.map((child) => <Button key={child.id} variant={child.id === childId ? "primary" : "secondary"} onPress={() => setChildId(child.id)}>{child.fullName}</Button>)}</View>
      {selectedChild && canAdmin && <Button onPress={() => setSheet("assign")}>{t("goals.assign")}</Button>}
      {goals.data?.map((goal) => <View key={goal.id} style={styles.card}><AppText variant="label">{goal.name}</AppText><AppText tone="muted">{formatDate(goal.startsOn)} – {formatDate(goal.targetEndsOn)}</AppText><AppText>{t("goals.progress", { yes: goal.yesDays, recorded: goal.recordedDays, percent: goal.yesPercent ?? 0, streak: goal.longestYesStreak })}</AppText><AppText tone="muted">{t(goal.meetsYesPercent && goal.meetsYesStreak ? "goals.targetsMet" : "goals.targetsPending")}</AppText><View style={styles.checkIns}>{goal.checkIns.map((checkInItem) => <View key={checkInItem.date} style={styles.checkIn}><AppText tone="muted">{formatDate(checkInItem.date)}</AppText><AppText>{t(checkInItem.outcome === "YES" ? "goals.yes" : "goals.no")}</AppText></View>)}</View>{goal.status === "ACTIVE" && canWrite && <View style={styles.options}>{goalCheckInOutcomes.map((outcome) => <Button key={outcome} variant="secondary" loading={checkIn.isPending} onPress={() => void checkIn.mutateAsync({ goalId: goal.id, outcome }).catch((error: unknown) => Alert.alert(t("goals.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")))}>{t(outcome === "YES" ? "goals.yes" : "goals.no")}</Button>)}<Button onPress={() => { setFinalGoalId(goal.id); setSheet("finalize"); }}>{t("goals.finalize")}</Button></View>}{goal.status === "COMPLETED" && <><AppText>{t(goal.finalOutcome === "ACHIEVED" ? "goals.achieved" : "goals.notAchieved")}</AppText><AppText tone="muted">{goal.finalSummary}</AppText></>}</View>)}{selectedChild && goals.data?.length === 0 && <AppText tone="muted">{t("goals.empty")}</AppText>}</View>
    <BottomSheet visible={sheet === "assign"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("goals.assign")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("goals.assign"), disabled: !templateId, loading: assign.isPending, onPress: () => void assign.mutateAsync().catch((error: unknown) => Alert.alert(t("goals.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")) ) }}><View style={styles.options}>{availableTemplates.map((template) => <Button key={template.id} variant={templateId === template.id ? "primary" : "secondary"} onPress={() => setTemplateId(template.id)}>{template.name}</Button>)}</View></BottomSheet>
    <BottomSheet visible={sheet === "finalize"} onClose={() => setSheet(null)} closeAccessibilityLabel={t("common.close")} title={t("goals.finalize")} negativeAction={{ label: t("common.cancel"), onPress: () => setSheet(null) }} positiveAction={{ label: t("goals.finalize"), disabled: !finalSummary.trim(), loading: finalize.isPending, onPress: () => void finalize.mutateAsync().catch((error: unknown) => Alert.alert(t("goals.saveFailed"), error instanceof Error ? error.message : t("auth.tryAgain")) ) }}><View style={styles.options}>{childGoalOutcomes.map((outcome) => <Button key={outcome} variant={finalOutcome === outcome ? "primary" : "secondary"} onPress={() => setFinalOutcome(outcome)}>{t(outcome === "ACHIEVED" ? "goals.achieved" : "goals.notAchieved")}</Button>)}</View><TextInput style={[styles.input, styles.summaryInput]} multiline placeholder={t("goals.finalSummary")} value={finalSummary} onChangeText={setFinalSummary} /></BottomSheet>
  </AppScreen>;
}

const styles = StyleSheet.create({ section: { gap: spacing.sm }, row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }, card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, checkIns: { gap: spacing.xs }, checkIn: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.surface }, summaryInput: { minHeight: 100, paddingTop: spacing.sm, textAlignVertical: "top" } });
