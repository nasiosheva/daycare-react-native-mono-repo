import { useState } from "react";
import { Alert, Linking, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChildProgramStatus } from "@daycare/api-client";
import { AppText, BackButton, BottomSheet, Button, ShimmerList, colors, radius, spacing } from "@daycare/ui";
import { AppScreen } from "@/navigation/AppScreen";
import { SafeRedirect as Redirect } from "@/navigation/SafeRedirect";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { notify } from "@/notify/notify";

export default function ParentChildProfileScreen() {
  const router = useRouter();
  const { childId: rawChildId } = useLocalSearchParams<{ childId?: string }>();
  const childId = typeof rawChildId === "string" ? rawChildId : null;
  const { api, organizationId, profile } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const membership = profile?.memberships.find((item) => item.organizationId === organizationId);
  const childProfile = useQuery({ queryKey: ["parent-child-profile", organizationId, childId], queryFn: () => api.parentChildProfile(childId!), enabled: Boolean(childId && membership?.role === "PARENT") });
  const feedback = useMutation({ mutationFn: ({ programId, note }: { programId: string; note: string }) => api.addParentChildProgramFeedback(childId!, programId, note), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["parent-child-profile", organizationId, childId] }) });
  const [feedbackProgramId, setFeedbackProgramId] = useState<string | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");
  if (!profile) return null;
  if (!childId || membership?.role !== "PARENT") return <Redirect href="/home" />;
  const openMaps = async () => {
    const url = childProfile.data?.branch.googleMapsUrl;
    if (!url) return;
    try { await Linking.openURL(url); }
    catch { Alert.alert(t("branch.mapsOpenFailed")); }
  };
  const staffRole = (role: string) => role === "NURSE" ? t("children.nurse") : role === "MISS" ? t("children.miss") : t("children.staff");
  const statusLabel = (status: ChildProgramStatus) => t(status === "ACTIVE" ? "children.programStatus.ACTIVE" : status === "COMPLETED" ? "children.programStatus.COMPLETED" : "children.programStatus.DISCONTINUED");
  const submitFeedback = async () => {
    if (!feedbackProgramId || !feedbackNote.trim()) return;
    try { await feedback.mutateAsync({ programId: feedbackProgramId, note: feedbackNote.trim() }); setFeedbackNote(""); setFeedbackProgramId(null); notify(t("children.feedbackSent")); }
    catch (error) { notify(t("children.feedbackFailed"), error instanceof Error ? error.message : t("auth.tryAgain")); }
  };
  return <AppScreen showBottomNavigation={false} title={t("children.parentProfile")} header={<BackButton accessibilityLabel={t("common.back")} onPress={() => router.back()} />}><View style={styles.content}>
    {childProfile.isLoading && <ShimmerList variant="tile" />}
    {childProfile.isError && <View style={styles.feedback}><AppText tone="danger">{t("auth.profileLoadFailed")}</AppText><Button variant="secondary" onPress={() => void childProfile.refetch()}>{t("common.retry")}</Button></View>}
    {childProfile.data && <>
      <View style={styles.card}><AppText variant="h5">{childProfile.data.child.fullName}</AppText><AppText tone="muted">{childProfile.data.child.gender === "MALE" ? t("children.genderMale") : childProfile.data.child.gender === "FEMALE" ? t("children.genderFemale") : t("children.genderUnspecified")}</AppText><AppText tone="muted">{childProfile.data.child.dateOfBirth}</AppText>{childProfile.data.child.nisn && <AppText tone="muted">{t("children.nisn")}: {childProfile.data.child.nisn}</AppText>}</View>
      <View style={styles.card}><AppText variant="h5">{t("branch.location")}</AppText><AppText variant="label">{childProfile.data.branch.name}</AppText><AppText tone="muted">{childProfile.data.branch.fullAddress ?? t("branch.locationUnavailable")}</AppText>{childProfile.data.branch.googleMapsUrl && <Button variant="secondary" onPress={() => void openMaps()}>{t("branch.openGoogleMaps")}</Button>}</View>
      <View style={styles.card}><AppText variant="h5">{t("pickup.title")}</AppText><Button variant="secondary" onPress={() => router.push({ pathname: "/pickup-authorizations", params: { childId } } as never)}>{t("pickup.manage")}</Button></View>
      <View style={styles.card}><AppText variant="h5">{t("emergencyContacts.title")}</AppText><Button variant="secondary" onPress={() => router.push({ pathname: "/emergency-contacts", params: { childId } } as never)}>{t("emergencyContacts.manage")}</Button></View>
      <View style={styles.card}><AppText variant="h5">{t("children.classroom")}</AppText>{childProfile.data.placement ? <><AppText variant="label">{childProfile.data.placement.classroomName}</AppText><AppText tone="muted">{childProfile.data.placement.learningLevelName ?? t("common.noData")}</AppText></> : <AppText tone="muted">{t("common.noData")}</AppText>}</View>
      <View style={styles.card}><AppText variant="h5">{t("children.programs")}</AppText>{childProfile.data.programs.map((program) => <View key={program.id} style={styles.item}><AppText variant="label">{program.name}</AppText><AppText variant="caption" tone="muted">{statusLabel(program.status)}</AppText>{program.parentSummary && <AppText tone="muted">{program.parentSummary}</AppText>}{program.homeGuidance && <><AppText variant="label">{t("children.homeGuidance")}</AppText><AppText tone="muted">{program.homeGuidance}</AppText></>}{program.steps.map((step) => <View key={step.id} style={styles.step}><AppText variant="label">{step.title}</AppText>{step.homeGuidance && <AppText tone="muted">{step.homeGuidance}</AppText>}</View>)}{program.steps.length === 0 && !program.homeGuidance && <AppText tone="muted">{t("children.noSteps")}</AppText>}<Button variant="secondary" onPress={() => setFeedbackProgramId(program.id)}>{t("children.addFeedback")}</Button>{program.feedback.map((item) => <View key={item.id} style={styles.step}><AppText>{item.note}</AppText></View>)}</View>)}{childProfile.data.programs.length === 0 && <AppText tone="muted">{t("children.noPrograms")}</AppText>}</View>
      <View style={styles.card}><AppText variant="h5">{t("children.staffAssignments")}</AppText>{childProfile.data.staffAssignments.map((staff) => <View key={`${staff.displayName}-${staff.assignmentRole}`} style={styles.item}><AppText variant="label">{staff.displayName}</AppText><AppText tone="muted">{staffRole(staff.assignmentRole)}</AppText></View>)}{childProfile.data.staffAssignments.length === 0 && <AppText tone="muted">{t("children.noStaff")}</AppText>}</View>
    </>}
  </View><BottomSheet visible={Boolean(feedbackProgramId)} onClose={() => { setFeedbackProgramId(null); setFeedbackNote(""); }} closeAccessibilityLabel={t("common.close")} title={t("children.addFeedback")} negativeAction={{ label: t("common.cancel"), onPress: () => { setFeedbackProgramId(null); setFeedbackNote(""); } }} positiveAction={{ label: t("common.save"), loading: feedback.isPending, disabled: !feedbackNote.trim(), onPress: () => void submitFeedback() }}><TextInput style={[styles.input, styles.multiline]} placeholder={t("children.feedbackNote")} value={feedbackNote} onChangeText={setFeedbackNote} multiline /></BottomSheet></AppScreen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.md }, card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, item: { gap: spacing.xs, paddingTop: spacing.sm }, step: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceTint }, feedback: { gap: spacing.sm, alignItems: "flex-start" }, input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, multiline: { minHeight: 96, paddingTop: spacing.sm, textAlignVertical: "top" } });
